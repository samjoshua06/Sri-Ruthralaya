import React, { useState, useEffect } from 'react';
import { CreditCard, Plus, Download, CheckCircle, Clock, AlertTriangle, Search, Filter, X, Trash2, Loader2 } from 'lucide-react';
import api from '../../services/api';
import { downloadReceiptPDF } from '../../utils/receipt';

export default function AdminFees() {
  const [fees, setFees] = useState([]);
  const [students, setStudents] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  const [newFee, setNewFee] = useState({
    student_id: '',
    amount: 2400,
    month: 'November 2026',
    due_date: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
    status: 'pending',
  });

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  async function loadData() {
    try {
      const q = statusFilter ? `?status=${statusFilter}` : '';
      const [feeRes, stuRes] = await Promise.all([
        api.get(`/fees${q}`),
        api.get('/students'),
      ]);

      if (feeRes.data.success) setFees(feeRes.data.data);
      if (stuRes.data.success) {
        setStudents(stuRes.data.data);
        if (stuRes.data.data.length > 0 && !newFee.student_id) {
          setNewFee((prev) => ({ ...prev, student_id: stuRes.data.data[0].id }));
        }
      }
    } catch (err) {
      console.error('Error loading fees:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleCreateFee = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/fees', {
        ...newFee,
        amount: Number(newFee.amount),
      });
      if (res.data.success) {
        setModalOpen(false);
        await loadData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to record fee entry.');
    }
  };

  const handleMarkPaid = async (feeId) => {
    try {
      await api.post(`/fees/pay/${feeId}`, {
        payment_ref: `CASH-REC-${Math.floor(100000 + Math.random() * 900000)}`,
      });
      await loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Payment mark failed.');
    }
  };

  const handleDeleteFee = async (fee) => {
    const studentName = fee.student?.name || 'this disciple';
    const confirmMsg = `Are you sure you want to permanently delete this fee invoice of ₹${Number(fee.amount).toLocaleString('en-IN')} for ${studentName} (${fee.month || 'Current Term'})?`;
    if (!window.confirm(confirmMsg)) return;

    setDeletingId(fee.id);
    try {
      const res = await api.delete(`/fees/${fee.id}`);
      if (res.data.success) {
        await loadData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete fee invoice.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownloadReceipt = async (fee) => {
    setDownloadingId(fee.id);
    try {
      await downloadReceiptPDF(fee.id, `${fee.student?.name || 'Student'}_${fee.month || 'Tuition'}`);
    } catch (err) {
      alert(err.message || 'Failed to download receipt PDF.');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-6 font-outfit text-white">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-[#111111] border border-[#333333] shadow-xl">
        <div>
          <h1 className="font-cinzel text-2xl sm:text-3xl font-bold text-white">
            Fee Ledger &amp; <span className="text-[#d4af37]">Invoice Management</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#bdbdbd] mt-1">
            Track student tuition collections, record direct cash/UPI payments, and issue official receipts.
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="primary-btn self-start sm:self-auto flex items-center gap-2 text-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Record New Fee Invoice</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-[#111111] border border-[#333333] shadow-md flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-cinzel font-bold text-[#bdbdbd]">Filter By Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-[#333333] text-xs focus:outline-none focus:border-[#d4af37] bg-[#0f0f0f] text-[#bdbdbd] font-cinzel"
          >
            <option value="">All Fee Entries</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>

        <span className="text-xs text-[#888888]">
          Total Records: <strong className="text-white">{fees.length}</strong>
        </span>
      </div>

      {/* Fee Table */}
      <div className="bg-[#111111] rounded-3xl border border-[#333333] shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-[#0a0a0a] border-b border-[#333333] font-cinzel font-bold text-[#d4af37]">
                <th className="p-4">Disciple Details</th>
                <th className="p-4">Billing Month</th>
                <th className="p-4">Fee Amount</th>
                <th className="p-4">Due Date</th>
                <th className="p-4">Status</th>
                <th className="p-4">Transaction Ref</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222222]">
              {fees.map((fee) => (
                <tr key={fee.id} className="hover:bg-[#161616] transition-colors">
                  <td className="p-4 font-semibold text-white">
                    <span className="font-cinzel block text-sm text-white">{fee.student?.name || 'Disciple'}</span>
                    <span className="text-[11px] text-[#888888] font-normal">{fee.student?.email}</span>
                  </td>

                  <td className="p-4 font-outfit text-[#bdbdbd]">
                    {fee.month || 'Current Term'}
                  </td>

                  <td className="p-4 font-cinzel font-bold text-[#d4af37]">
                    ₹{Number(fee.amount).toLocaleString('en-IN')}
                  </td>

                  <td className="p-4 text-[#888888]">
                    {new Date(fee.due_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>

                  <td className="p-4">
                    {fee.status === 'paid' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                        <CheckCircle className="w-3 h-3" />
                        Paid
                      </span>
                    )}
                    {fee.status === 'pending' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/40">
                        <Clock className="w-3 h-3" />
                        Pending
                      </span>
                    )}
                    {fee.status === 'overdue' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/40">
                        <AlertTriangle className="w-3 h-3" />
                        Overdue
                      </span>
                    )}
                  </td>

                  <td className="p-4 font-mono text-xs text-[#888888]">
                    {fee.payment_ref || '—'}
                  </td>

                  <td className="p-4 text-right space-x-2 whitespace-nowrap">
                    {fee.status === 'paid' ? (
                      <button
                        onClick={() => handleDownloadReceipt(fee)}
                        disabled={downloadingId === fee.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0f0f0f] border border-[#333333] hover:border-[#d4af37] text-[#d4af37] text-xs font-cinzel font-bold transition-all disabled:opacity-50"
                        title="Download official PDF receipt"
                      >
                        {downloadingId === fee.id ? (
                          <Loader2 className="w-3 h-3 animate-spin text-[#d4af37]" />
                        ) : (
                          <Download className="w-3 h-3" />
                        )}
                        <span>{downloadingId === fee.id ? 'Loading...' : 'PDF'}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleMarkPaid(fee.id)}
                        className="px-3 py-1.5 rounded-lg bg-[#d4af37] text-[#111111] hover:brightness-110 text-xs font-cinzel font-bold shadow transition-all"
                      >
                        Mark Paid
                      </button>
                    )}

                    <button
                      onClick={() => handleDeleteFee(fee)}
                      disabled={deletingId === fee.id}
                      className="p-1.5 rounded-lg border border-rose-900/40 text-rose-400 bg-rose-950/20 hover:bg-rose-950/50 hover:border-rose-700 transition-all inline-flex items-center justify-center disabled:opacity-50"
                      title="Delete fee invoice"
                    >
                      {deletingId === fee.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Fee Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#111111] rounded-3xl border border-[#d4af37] max-w-md w-full p-6 sm:p-8 shadow-2xl relative text-white">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-[#222222] text-[#888888] hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-cinzel font-bold text-xl text-[#d4af37] mb-4">
              Record New Fee Entry
            </h3>

            <form onSubmit={handleCreateFee} className="space-y-4 font-outfit">
              <div>
                <label className="block text-xs font-semibold text-[#bdbdbd] mb-1 font-cinzel">Select Disciple *</label>
                <select
                  required
                  value={newFee.student_id}
                  onChange={(e) => setNewFee({ ...newFee, student_id: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#0f0f0f] border border-[#333333] text-white text-xs sm:text-sm focus:outline-none focus:border-[#d4af37]"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.email})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#bdbdbd] mb-1 font-cinzel">Billing Term / Month *</label>
                <input
                  type="text"
                  required
                  value={newFee.month}
                  onChange={(e) => setNewFee({ ...newFee, month: e.target.value })}
                  placeholder="e.g. November 2026"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#0f0f0f] border border-[#333333] text-white text-xs sm:text-sm focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#bdbdbd] mb-1 font-cinzel">Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    value={newFee.amount}
                    onChange={(e) => setNewFee({ ...newFee, amount: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#0f0f0f] border border-[#333333] text-white text-xs sm:text-sm focus:outline-none focus:border-[#d4af37]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#bdbdbd] mb-1 font-cinzel">Due Date *</label>
                  <input
                    type="date"
                    required
                    value={newFee.due_date}
                    onChange={(e) => setNewFee({ ...newFee, due_date: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-[#0f0f0f] border border-[#333333] text-white text-xs sm:text-sm focus:outline-none focus:border-[#d4af37]"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="secondary-btn text-xs py-2 px-4"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-btn text-xs py-2 px-5"
                >
                  Save Fee Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
