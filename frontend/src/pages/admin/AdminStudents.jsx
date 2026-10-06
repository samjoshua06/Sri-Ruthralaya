import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  UserPlus, 
  Check, 
  X, 
  Edit2, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  Phone, 
  Mail,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import api from '../../services/api';

export default function AdminStudents() {
  const [students, setStudents] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [deletingStudentId, setDeletingStudentId] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    batch_id: '',
    status: 'active',
  });

  useEffect(() => {
    loadData();
  }, [statusFilter, batchFilter, search]);

  async function loadData() {
    try {
      const queryParams = new URLSearchParams();
      if (statusFilter) queryParams.append('status', statusFilter);
      if (batchFilter) queryParams.append('batch_id', batchFilter);
      if (search) queryParams.append('search', search);

      const [stuRes, batchRes] = await Promise.all([
        api.get(`/students?${queryParams.toString()}`),
        api.get('/batches'),
      ]);

      if (stuRes.data.success) setStudents(stuRes.data.data);
      if (batchRes.data.success) setBatches(batchRes.data.data);
    } catch (err) {
      console.error('Error loading students:', err);
    } finally {
      setLoading(false);
    }
  }

  // 1-Click Approve Registration
  const handleApprove = async (studentId, preferredBatchId) => {
    try {
      const res = await api.put(`/students/${studentId}/approve`, {
        batch_id: preferredBatchId || batches[0]?.id,
      });
      if (res.data.success) {
        await loadData();
      }
    } catch (err) {
      console.error('Approve error:', err);
    }
  };

  // Toggle Active/Inactive status
  const handleToggleStatus = async (studentId) => {
    try {
      await api.patch(`/students/${studentId}/status`);
      await loadData();
    } catch (err) {
      console.error('Toggle status error:', err);
    }
  };

  const handleDeleteStudent = async (student) => {
    const confirmMsg = `Are you sure you want to permanently delete the student account for "${student.name}" (${student.email})?\n\nThis will remove their profile and login access.`;
    if (!window.confirm(confirmMsg)) return;

    setDeletingStudentId(student.id);
    try {
      const res = await api.delete(`/students/${student.id}`);
      if (res.data.success) {
        await loadData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete student account.');
    } finally {
      setDeletingStudentId(null);
    }
  };

  const handleCreateStudent = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/students', formData);
      if (res.data.success) {
        setShowAddModal(false);
        setFormData({ name: '', email: '', phone: '', batch_id: '', status: 'active' });
        await loadData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create student.');
    }
  };

  const handleUpdateStudent = async (e) => {
    e.preventDefault();
    try {
      const res = await api.put(`/students/${editingStudent.id}`, editingStudent);
      if (res.data.success) {
        setEditingStudent(null);
        await loadData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update student.');
    }
  };

  return (
    <div className="space-y-6 font-outfit text-white">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-[#111111] border border-[#333333] shadow-xl">
        <div>
          <h1 className="font-cinzel text-2xl sm:text-3xl font-bold text-white">
            Student &amp; <span className="text-[#d4af37]">Disciple Management</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#bdbdbd] mt-1">
            Review admissions, approve pending registrations, assign batches, and view attendance metrics.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="primary-btn self-start sm:self-auto flex items-center gap-2 text-xs"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add New Disciple</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-[#111111] border border-[#333333] shadow-md flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-[#888888] absolute left-3.5 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search disciples by name, email, or phone number..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-[#333333] text-xs sm:text-sm focus:outline-none focus:border-[#d4af37] bg-[#0f0f0f] text-white placeholder-[#666666]"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-[#333333] text-xs focus:outline-none focus:border-[#d4af37] bg-[#0f0f0f] text-[#bdbdbd] font-cinzel"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending Approval</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <select
            value={batchFilter}
            onChange={(e) => setBatchFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-[#333333] text-xs focus:outline-none focus:border-[#d4af37] bg-[#0f0f0f] text-[#bdbdbd] font-cinzel"
          >
            <option value="">All Batches</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-[#111111] rounded-3xl border border-[#333333] shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-[#0a0a0a] border-b border-[#333333] font-cinzel font-bold text-[#d4af37]">
                <th className="p-4">Disciple Name &amp; Contact</th>
                <th className="p-4">Enrolled Batch</th>
                <th className="p-4">Attendance %</th>
                <th className="p-4">Status</th>
                <th className="p-4">Joining Date</th>
                <th className="p-4 text-right">Administrative Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222222]">
              {students.map((student) => (
                <tr key={student.id} className="hover:bg-[#161616] transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={student.profile_photo_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'}
                        alt={student.name}
                        className="w-10 h-10 rounded-full object-cover border border-[#d4af37] flex-shrink-0"
                      />
                      <div>
                        <div className="font-bold text-white font-cinzel">{student.name}</div>
                        <div className="text-[11px] text-[#888888] font-outfit">{student.email}</div>
                        {student.phone && <div className="text-[11px] text-[#666666] font-outfit">{student.phone}</div>}
                      </div>
                    </div>
                  </td>

                  <td className="p-4">
                    {student.batch ? (
                      <div>
                        <span className="font-semibold text-white block">{student.batch.name}</span>
                        <span className="text-[10px] text-[#d4af37] uppercase font-cinzel">{student.batch.level}</span>
                      </div>
                    ) : (
                      <span className="text-[#666666] italic">Unassigned</span>
                    )}
                  </td>

                  <td className="p-4 font-cinzel font-bold text-[#d4af37]">
                    {student.attendancePct}%
                  </td>

                  <td className="p-4">
                    {student.status === 'active' && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                        Active
                      </span>
                    )}
                    {student.status === 'pending' && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse">
                        Pending Approval
                      </span>
                    )}
                    {student.status === 'inactive' && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-[#1a1a1a] text-[#777777] border border-[#333333]">
                        Inactive
                      </span>
                    )}
                  </td>

                  <td className="p-4 text-[#888888] text-xs">
                    {new Date(student.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>

                  <td className="p-4 text-right space-x-2 whitespace-nowrap">
                    {student.status === 'pending' ? (
                      <>
                        <button
                          onClick={() => handleApprove(student.id, batches[0]?.id)}
                          className="px-3 py-1.5 rounded-lg bg-[#d4af37] text-[#111111] hover:brightness-110 text-xs font-cinzel font-bold shadow inline-flex items-center gap-1 transition-all"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                        <button
                          onClick={() => handleDeleteStudent(student)}
                          disabled={deletingStudentId === student.id}
                          className="p-1.5 rounded-lg border border-rose-900/40 text-rose-400 bg-rose-950/20 hover:bg-rose-950/50 hover:border-rose-700 transition-all inline-flex items-center justify-center disabled:opacity-50"
                          title="Reject / Delete registration"
                        >
                          {deletingStudentId === student.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setEditingStudent(student)}
                          className="p-1.5 rounded-lg border border-[#333333] hover:border-[#d4af37] bg-[#0f0f0f] text-[#bdbdbd] hover:text-[#d4af37] transition-all"
                          title="Edit Student"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(student.id)}
                          className={`p-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            student.status === 'active'
                              ? 'border-amber-900/40 text-amber-400 bg-amber-950/20 hover:bg-amber-950/40'
                              : 'border-emerald-900/40 text-emerald-400 bg-emerald-950/20 hover:bg-emerald-950/40'
                          }`}
                          title={student.status === 'active' ? 'Deactivate' : 'Reactivate'}
                        >
                          {student.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleDeleteStudent(student)}
                          disabled={deletingStudentId === student.id}
                          className="p-1.5 rounded-lg border border-rose-900/40 text-rose-400 bg-rose-950/20 hover:bg-rose-950/50 hover:border-rose-700 transition-all inline-flex items-center justify-center disabled:opacity-50"
                          title="Delete student account permanently"
                        >
                          {deletingStudentId === student.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Student Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#111111] rounded-3xl border border-[#d4af37] max-w-md w-full p-6 sm:p-8 shadow-2xl relative text-white">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-[#222222] text-[#888888] hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-cinzel font-bold text-xl text-[#d4af37] mb-4">
              Add New Disciple
            </h3>

            <form onSubmit={handleCreateStudent} className="space-y-4 font-outfit">
              <div>
                <label className="block text-xs font-semibold text-[#bdbdbd] mb-1 font-cinzel">Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Disciple name"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#0f0f0f] border border-[#333333] text-white text-xs sm:text-sm focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#bdbdbd] mb-1 font-cinzel">Email Address *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="student@example.com"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#0f0f0f] border border-[#333333] text-white text-xs sm:text-sm focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#bdbdbd] mb-1 font-cinzel">Phone Number</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91 98421 23456"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#0f0f0f] border border-[#333333] text-white text-xs sm:text-sm focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#bdbdbd] mb-1 font-cinzel">Assign Batch</label>
                <select
                  value={formData.batch_id}
                  onChange={(e) => setFormData({ ...formData, batch_id: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#0f0f0f] border border-[#333333] text-white text-xs sm:text-sm focus:outline-none focus:border-[#d4af37]"
                >
                  <option value="">Select training batch...</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} ({b.level})</option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="secondary-btn text-xs py-2 px-4"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-btn text-xs py-2 px-5"
                >
                  Save Disciple
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#111111] rounded-3xl border border-[#d4af37] max-w-md w-full p-6 sm:p-8 shadow-2xl relative text-white">
            <button
              onClick={() => setEditingStudent(null)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-[#222222] text-[#888888] hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-cinzel font-bold text-xl text-[#d4af37] mb-4">
              Edit Disciple Details
            </h3>

            <form onSubmit={handleUpdateStudent} className="space-y-4 font-outfit">
              <div>
                <label className="block text-xs font-semibold text-[#bdbdbd] mb-1 font-cinzel">Full Name</label>
                <input
                  type="text"
                  required
                  value={editingStudent.name}
                  onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#0f0f0f] border border-[#333333] text-white text-xs sm:text-sm focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#bdbdbd] mb-1 font-cinzel">Phone Number</label>
                <input
                  type="tel"
                  value={editingStudent.phone || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, phone: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#0f0f0f] border border-[#333333] text-white text-xs sm:text-sm focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#bdbdbd] mb-1 font-cinzel">Assign Batch</label>
                <select
                  value={editingStudent.batch_id || editingStudent.batch?.id || ''}
                  onChange={(e) => setEditingStudent({ ...editingStudent, batch_id: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#0f0f0f] border border-[#333333] text-white text-xs sm:text-sm focus:outline-none focus:border-[#d4af37]"
                >
                  <option value="">Select batch...</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} ({b.level})</option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="secondary-btn text-xs py-2 px-4"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-btn text-xs py-2 px-5"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
