import React, { useState, useEffect } from 'react';
import { CreditCard, CheckCircle, Clock, AlertTriangle, Download, ArrowRight, X } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { loadRazorpay, RAZORPAY_KEY_ID } from '../../utils/razorpay';

export default function StudentFees() {
  const { user } = useAuth();
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payingFee, setPayingFee] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(null); // { type: 'success' | 'error' | 'info', message }

  useEffect(() => {
    loadFees();
  }, []);

  async function loadFees() {
    try {
      const res = await api.get('/fees/my-fees');
      if (res.data.success) {
        setFees(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load fees:', err);
    } finally {
      setLoading(false);
    }
  }

  const getErrorMessage = (err, fallback) =>
    err?.response?.data?.message || err?.message || fallback;

  const verifyPayment = async (response, fee) => {
    setIsProcessing(true);
    setPaymentStatus({ type: 'info', message: 'Verifying your payment with the academy server...' });
    try {
      const res = await api.post('/verify-payment', {
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
      });
      if (res.data.success) {
        setPaymentStatus({
          type: 'success',
          message: `Payment of ₹${Number(fee.amount).toLocaleString('en-IN')} for ${fee.month || 'Current Month'} verified. Payment ID: ${response.razorpay_payment_id}`,
        });
        await loadFees();
      }
    } catch (err) {
      console.error('Payment verification failed:', err);
      setPaymentStatus({
        type: 'error',
        message: `${getErrorMessage(err, 'Payment verification failed.')} If money was debited, please share Payment ID ${response.razorpay_payment_id} with the academy office.`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePay = async () => {
    if (!payingFee) return;
    const fee = payingFee;
    setIsProcessing(true);
    setPaymentStatus(null);

    try {
      const Razorpay = await loadRazorpay();

      // 1. Create order on the backend (amount is derived from the fee record server-side)
      const orderRes = await api.post('/create-order', { fee_id: fee.id });
      const { order_id, amount, currency, key_id } = orderRes.data.data;

      // 2. Open Razorpay Standard Checkout modal
      const rzp = new Razorpay({
        key: RAZORPAY_KEY_ID || key_id,
        amount,
        currency,
        order_id,
        name: 'Sri Ruthralaya Academy',
        description: `Tuition Fee - ${fee.month || 'Current Month'}`,
        image: `${window.location.origin}/logo.png`,
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: user?.phone ? String(user.phone).replace(/[^\d+]/g, '') : '',
        },
        notes: { fee_id: fee.id },
        theme: { color: '#d4af37' },
        // 3. On success, send all three values to the backend for signature verification
        handler: (response) => verifyPayment(response, fee),
        modal: {
          ondismiss: () => {
            setIsProcessing(false);
            setPaymentStatus((prev) =>
              prev?.type === 'error' ? prev : { type: 'info', message: 'Payment cancelled. Your fee is still pending - you can retry anytime.' }
            );
          },
        },
      });

      rzp.on('payment.failed', (response) => {
        const reason = response?.error?.description || 'The payment could not be completed.';
        setPaymentStatus({
          type: 'error',
          message: `Payment failed: ${reason}${response?.error?.metadata?.payment_id ? ` (Payment ID: ${response.error.metadata.payment_id})` : ''}`,
        });
      });

      setPayingFee(null);
      rzp.open();
    } catch (err) {
      console.error('Payment initiation failed:', err);
      setPaymentStatus({ type: 'error', message: getErrorMessage(err, 'Unable to start payment. Please try again.') });
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-8 font-outfit text-[#bdbdbd]">
      
      {/* Header */}
      <div>
        <h1 className="font-cinzel text-2xl sm:text-3xl font-bold text-white">
          Fee Invoices &amp; Receipts
        </h1>
        <p className="text-xs sm:text-sm text-[#aaaaaa] mt-1">
          Review your tuition payment history, complete monthly term payments, and download certified GST-exempt academy PDF receipts.
        </p>
      </div>

      {/* Payment Status Banner */}
      {paymentStatus && (
        <div
          id="payment-status-banner"
          role="status"
          className={`flex items-start gap-3 p-4 rounded-2xl border text-xs sm:text-sm ${
            paymentStatus.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
              : paymentStatus.type === 'error'
              ? 'bg-red-950/60 border-red-800 text-red-300'
              : 'bg-amber-950/40 border-amber-700/60 text-amber-200'
          }`}
        >
          {paymentStatus.type === 'success' ? (
            <CheckCircle className="w-5 h-5 shrink-0" />
          ) : paymentStatus.type === 'error' ? (
            <AlertTriangle className="w-5 h-5 shrink-0" />
          ) : (
            <Clock className="w-5 h-5 shrink-0" />
          )}
          <p className="flex-1">{paymentStatus.message}</p>
          <button
            id="payment-status-dismiss"
            onClick={() => setPaymentStatus(null)}
            className="p-1 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Fee Records Table */}
      <div className="bg-[#111111] rounded-3xl border border-[#333333] shadow-xl overflow-hidden">
        <div className="p-6 border-b border-[#222222] flex items-center justify-between">
          <h2 className="font-cinzel font-bold text-lg text-white">
            Tuition Ledger
          </h2>
          <span className="text-xs text-[#888888] font-cinzel">
            Academy Year 2026
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-[#161616] border-b border-[#262626] font-cinzel font-bold text-[#aaaaaa]">
                <th className="p-4">Billing Month</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Due Date</th>
                <th className="p-4">Payment Status</th>
                <th className="p-4">Transaction Ref</th>
                <th className="p-4 text-right">Receipt / Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222222]">
              {fees.map((fee) => (
                <tr key={fee.id} className="hover:bg-[#161616]/60 transition-colors">
                  <td className="p-4 font-semibold text-white">
                    {fee.month || 'Current Month'}
                  </td>
                  <td className="p-4 font-cinzel font-bold text-[#ffd700]">
                    ₹{Number(fee.amount).toLocaleString('en-IN')}
                  </td>
                  <td className="p-4 text-[#888888]">
                    {new Date(fee.due_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="p-4">
                    {fee.status === 'paid' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Paid
                      </span>
                    )}
                    {fee.status === 'pending' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/80 text-amber-400 border border-amber-800">
                        <Clock className="w-3.5 h-3.5" />
                        Due Soon
                      </span>
                    )}
                    {fee.status === 'overdue' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-950/80 text-red-400 border border-red-800">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Overdue
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-[#888888] font-mono text-xs">
                    {fee.payment_ref || '—'}
                  </td>
                  <td className="p-4 text-right">
                    {fee.status === 'paid' ? (
                      <a
                        href={`/api/v1/fees/receipt/${fee.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#0f0f0f] border border-[#d4af37] text-[#d4af37] hover:bg-[#d4af37] hover:text-[#111111] text-xs font-cinzel font-bold shadow transition-all"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download PDF</span>
                      </a>
                    ) : (
                      <button
                        id={`pay-fee-${fee.id}`}
                        onClick={() => setPayingFee(fee)}
                        disabled={isProcessing}
                        className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-[#d4af37] text-[#111111] hover:bg-[#ffd700] text-xs font-cinzel font-bold shadow transition-all disabled:opacity-50"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>Pay Online</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Online Payment Modal */}
      {payingFee && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111111] rounded-3xl border-2 border-[#d4af37] max-w-md w-full p-6 sm:p-8 shadow-2xl relative text-white">
            <button
              onClick={() => setPayingFee(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-[#1a1a1a] text-[#888888] hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-full bg-[#1a1a1a] text-[#d4af37] border border-[#d4af37] flex items-center justify-center mx-auto mb-2 shadow">
                <CreditCard className="w-6 h-6" />
              </div>
              <h3 className="font-cinzel font-bold text-xl text-white">
                Tuition Fee Payment
              </h3>
              <p className="text-xs text-[#888888] font-outfit mt-0.5">
                Sri Ruthraalayaa Bharathanatyam Academy
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#161616] border border-[#262626] space-y-2 mb-6 text-xs text-[#e0e0e0]">
              <div className="flex justify-between">
                <span className="text-[#888888]">Term / Month:</span>
                <span className="font-bold text-white">{payingFee.month || 'Current Month'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#888888]">Total Due Amount:</span>
                <span className="font-cinzel font-bold text-base text-[#ffd700]">
                  ₹{Number(payingFee.amount).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#888888]">Payment Channel:</span>
                <span className="font-semibold text-emerald-400">UPI / Cards / NetBanking (Razorpay)</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/30 text-center mb-6">
              <p className="text-xs font-semibold text-[#ffd700] font-cinzel">
                Secure Online Payment
              </p>
              <p className="text-[11px] text-[#aaaaaa] mt-1">
                You will be redirected to Razorpay's secure checkout. Once your payment is verified, your official academy PDF receipt is generated automatically.
              </p>
            </div>

            <button
              id="razorpay-checkout-button"
              onClick={handlePay}
              disabled={isProcessing}
              className="w-full py-3.5 rounded-xl bg-[#d4af37] text-[#111111] hover:bg-[#ffd700] font-cinzel font-bold text-xs uppercase tracking-wider shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <span>{isProcessing ? 'Opening Secure Checkout...' : `Pay ₹${Number(payingFee.amount).toLocaleString('en-IN')} Securely`}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
