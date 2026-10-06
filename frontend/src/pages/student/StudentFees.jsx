import React, { useState, useEffect } from 'react';
import { CreditCard, CheckCircle, Clock, AlertTriangle, Download, ArrowRight, X, Loader2 } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { loadRazorpay, RAZORPAY_KEY_ID } from '../../utils/razorpay';
import { downloadReceiptPDF } from '../../utils/receipt';

export default function StudentFees() {
  const { user } = useAuth();
  const [fees, setFees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingFeeId, setProcessingFeeId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
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
    setProcessingFeeId(fee.id);
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
          message: `Payment of ₹${Number(fee.amount).toLocaleString('en-IN')} for ${fee.month || 'Current Month'} verified! Payment ID: ${response.razorpay_payment_id}`,
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
      setProcessingFeeId(null);
    }
  };

  const handlePay = async (fee) => {
    if (!fee) return;
    setProcessingFeeId(fee.id);
    setPaymentStatus(null);

    try {
      const Razorpay = await loadRazorpay();

      // 1. Create order on the backend (amount is derived from the fee record server-side)
      const payload = (fee.id && !String(fee.id).startsWith('pending-fee') && !String(fee.id).startsWith('mock'))
        ? { fee_id: fee.id }
        : {};
      const orderRes = await api.post('/create-order', payload);
      const { order_id, amount, currency, key_id } = orderRes.data.data;

      // 2. Open Razorpay Standard Checkout modal directly
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
            setProcessingFeeId(null);
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

      rzp.open();
    } catch (err) {
      console.error('Payment initiation failed:', err);
      setPaymentStatus({ type: 'error', message: getErrorMessage(err, 'Unable to start payment. Please try again.') });
      setProcessingFeeId(null);
    }
  };

  const handleDownloadReceipt = async (fee) => {
    setDownloadingId(fee.id);
    try {
      await downloadReceiptPDF(fee.id, fee.month || 'Tuition_Fee');
    } catch (err) {
      alert(err.message || 'Failed to download receipt PDF.');
    } finally {
      setDownloadingId(null);
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
          className={`flex items-start gap-3 p-4 rounded-2xl border text-xs sm:text-sm ${paymentStatus.type === 'success'
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
                      <button
                        onClick={() => handleDownloadReceipt(fee)}
                        disabled={downloadingId === fee.id}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#0f0f0f] border border-[#d4af37] text-[#d4af37] hover:bg-[#d4af37] hover:text-[#111111] text-xs font-cinzel font-bold shadow transition-all disabled:opacity-50"
                        title="Download verified academy PDF receipt"
                      >
                        {downloadingId === fee.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#d4af37]" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        <span>{downloadingId === fee.id ? 'Downloading...' : 'Download PDF'}</span>
                      </button>
                    ) : (
                      <button
                        id={`pay-fee-${fee.id}`}
                        onClick={() => handlePay(fee)}
                        disabled={processingFeeId === fee.id}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#d4af37] text-[#111111] hover:bg-[#ffd700] text-xs font-cinzel font-bold shadow hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                        title="Pay tuition fee securely using Razorpay (UPI / Card / NetBanking)"
                      >
                        {processingFeeId === fee.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#111111]" />
                        ) : (
                          <CreditCard className="w-3.5 h-3.5" />
                        )}
                        <span>{processingFeeId === fee.id ? 'Opening Razorpay...' : 'Pay via Razorpay'}</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
