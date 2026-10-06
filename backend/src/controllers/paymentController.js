const crypto = require('crypto');
const Razorpay = require('razorpay');
const { db, fallbackStore, getIsDbConnected, isProduction, recordAdminActivity, getAdminInfoFromReq } = require('../config/db');

const MIN_AMOUNT_PAISE = 100;

// Lazily initialised so a missing key does not crash the whole API on boot
let razorpayInstance = null;
function getRazorpay() {
  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env;
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) return null;
  if (!razorpayInstance) {
    razorpayInstance = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });
  }
  return razorpayInstance;
}

function gatewayNotConfigured(res) {
  return res.status(500).json({
    success: false,
    data: null,
    message: 'Online payments are not configured on the server. Please contact the academy office.',
  });
}

/**
 * Maps Razorpay SDK errors to API responses (401 for key/auth failures, 500 otherwise)
 */
function handleGatewayError(err, res) {
  const description = err?.error?.description || err?.message || 'Payment gateway error.';
  console.error('❌ Razorpay API Error:', err?.statusCode, description);

  if (err?.statusCode === 401) {
    return res.status(401).json({
      success: false,
      data: null,
      code: 'GATEWAY_AUTH_FAILED',
      message: 'Payment gateway authentication failed. Please contact the academy office.',
    });
  }

  return res.status(500).json({
    success: false,
    data: null,
    message: `Unable to process payment with gateway: ${description}`,
  });
}

async function findFee(id) {
  if (getIsDbConnected()) {
    return await db.fee.findUnique({ where: { id } });
  }
  return fallbackStore.fees.find(f => f.id === id) || null;
}

async function markFeePaid(id, paymentRef) {
  if (getIsDbConnected()) {
    return await db.fee.update({
      where: { id },
      data: {
        status: 'paid',
        paid_date: new Date(),
        payment_ref: paymentRef,
        receipt_url: `/api/v1/fees/receipt/${id}`,
      },
    });
  }

  const fee = fallbackStore.fees.find(f => f.id === id);
  if (!fee) return null;
  fee.status = 'paid';
  fee.paid_date = new Date().toISOString().split('T')[0];
  fee.payment_ref = paymentRef;
  fee.receipt_url = `/api/v1/fees/receipt/${id}`;
  return fee;
}

/**
 * Create a Razorpay order
 * Body: { fee_id } for academy fee invoices (amount is read from the fee record server-side)
 *   or: { amount (paise), currency, receipt } for a generic order
 */
async function createOrder(req, res, next) {
  try {
    const razorpay = getRazorpay();
    if (!razorpay) return gatewayNotConfigured(res);

    if (isProduction && !getIsDbConnected()) {
      return res.status(503).json({
        success: false,
        data: null,
        message: 'Database service is currently unavailable. Please try again shortly.',
      });
    }

    const { fee_id, currency = 'INR' } = req.body || {};
    let amount;
    let receipt = req.body?.receipt;
    const notes = { user_id: req.user.id };

    if (fee_id) {
      const fee = await findFee(fee_id);
      if (!fee) {
        return res.status(404).json({ success: false, data: null, message: 'Fee record not found.' });
      }
      if (req.user.role !== 'admin' && fee.student_id !== req.user.id) {
        return res.status(403).json({ success: false, data: null, message: 'You can only pay your own fee invoices.' });
      }
      if (fee.status === 'paid') {
        return res.status(400).json({ success: false, data: null, message: 'This fee invoice has already been paid.' });
      }

      // Never trust a client-supplied amount for a fee invoice
      amount = Math.round(Number(fee.amount) * 100);
      receipt = `fee_${fee.id}`;
      notes.fee_id = fee.id;
      notes.student_id = fee.student_id;
      notes.month = fee.month || 'Current Month';
    } else {
      amount = Number(req.body?.amount);
    }

    if (!Number.isInteger(amount) || amount < MIN_AMOUNT_PAISE) {
      return res.status(400).json({
        success: false,
        data: null,
        message: `Invalid amount. Amount must be an integer in paise and at least ${MIN_AMOUNT_PAISE} (₹1).`,
      });
    }

    let order;
    try {
      order = await razorpay.orders.create({
        amount,
        currency,
        // Razorpay limits receipt to 40 characters
        receipt: String(receipt || `rcpt_${Date.now()}`).slice(0, 40),
        notes,
      });
    } catch (gatewayErr) {
      return handleGatewayError(gatewayErr, res);
    }

    return res.status(200).json({
      success: true,
      data: {
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id: process.env.RAZORPAY_KEY_ID, // public key only, safe for the browser
      },
      message: 'Payment order created successfully.',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Verify Razorpay payment signature and, for fee invoices, mark the fee as paid.
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 */
async function verifyPayment(req, res, next) {
  try {
    const razorpay = getRazorpay();
    if (!razorpay) return gatewayNotConfigured(res);

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Missing required fields: razorpay_order_id, razorpay_payment_id and razorpay_signature are all required.',
      });
    }

    // HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    const expectedBuf = Buffer.from(expectedSignature, 'utf8');
    const receivedBuf = Buffer.from(String(razorpay_signature), 'utf8');
    const isValid = expectedBuf.length === receivedBuf.length && crypto.timingSafeEqual(expectedBuf, receivedBuf);

    if (!isValid) {
      console.warn(`⚠️ Razorpay signature mismatch for order ${razorpay_order_id} / payment ${razorpay_payment_id}`);
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Payment verification failed: invalid signature. Your fee has not been marked as paid.',
      });
    }

    // Signature is valid - look up which fee invoice this order belongs to (stored in order notes)
    let order;
    try {
      order = await razorpay.orders.fetch(razorpay_order_id);
    } catch (gatewayErr) {
      return handleGatewayError(gatewayErr, res);
    }

    const feeId = order?.notes?.fee_id;
    if (!feeId) {
      // Generic (non-fee) order - signature verified, nothing to update
      return res.status(200).json({
        success: true,
        data: { order_id: razorpay_order_id, payment_id: razorpay_payment_id, fee: null },
        message: 'Payment verified successfully.',
      });
    }

    if (req.user.role !== 'admin' && order.notes.student_id !== req.user.id) {
      return res.status(403).json({ success: false, data: null, message: 'This payment does not belong to your account.' });
    }

    const fee = await findFee(feeId);
    if (!fee) {
      return res.status(404).json({ success: false, data: null, message: 'Fee record not found.' });
    }

    // Idempotent: a retried verification should not double-record
    if (fee.status === 'paid') {
      return res.status(200).json({
        success: true,
        data: { order_id: razorpay_order_id, payment_id: razorpay_payment_id, fee: { ...fee, amount: Number(fee.amount) } },
        message: 'Payment already verified for this invoice.',
      });
    }

    if (Number(order.amount) !== Math.round(Number(fee.amount) * 100)) {
      console.error(`❌ Razorpay amount mismatch for fee ${feeId}: order=${order.amount} fee=${fee.amount}`);
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Payment amount does not match the invoice amount. Please contact the academy office.',
      });
    }

    const feePaid = await markFeePaid(feeId, razorpay_payment_id);

    await recordAdminActivity({
      ...getAdminInfoFromReq(req),
      action: 'RECORD_PAYMENT',
      entity_type: 'fee',
      entity_id: feeId,
      title: 'Online Fee Payment (Razorpay)',
      details: `Razorpay payment of ₹${Number(fee.amount)} verified (Payment: ${razorpay_payment_id}, Order: ${razorpay_order_id})`,
    });

    return res.status(200).json({
      success: true,
      data: {
        order_id: razorpay_order_id,
        payment_id: razorpay_payment_id,
        fee: { ...feePaid, amount: Number(feePaid.amount) },
      },
      message: 'Payment verified successfully! Receipt generated.',
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createOrder,
  verifyPayment,
};
