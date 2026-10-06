import React, { useState, useEffect } from 'react';
import { CalendarCheck, CheckCircle2, XCircle, Clock, Calendar as CalIcon, ChevronLeft, ChevronRight, Sparkles, Check, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import MudraIcon from '../../components/common/MudraIcon';

export default function StudentAttendance() {
  const [attendanceData, setAttendanceData] = useState({ records: [], stats: {}, todayRecord: null });
  const [loading, setLoading] = useState(true);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [checkInMessage, setCheckInMessage] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  const loadAttendance = async () => {
    try {
      const res = await api.get('/attendance/student');
      if (res.data.success) {
        setAttendanceData(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load attendance:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttendance();
  }, []);

  const handleSelfCheckIn = async () => {
    setCheckInLoading(true);
    setCheckInMessage(null);
    try {
      const res = await api.post('/attendance/checkin');
      if (res.data.success) {
        setCheckInMessage({
          type: res.data.alreadyMarked ? 'info' : 'success',
          text: res.data.message || 'Sadhana presence recorded live!',
        });
        await loadAttendance();
      }
    } catch (err) {
      setCheckInMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to record attendance. Please try again.',
      });
    } finally {
      setCheckInLoading(false);
      setTimeout(() => setCheckInMessage(null), 5000);
    }
  };

  const records = attendanceData.records || [];
  const stats = attendanceData.stats || {
    total: records.length,
    present: records.filter(r => r.status === 'present').length,
    absent: records.filter(r => r.status === 'absent').length,
    late: records.filter(r => r.status === 'late').length,
    attendancePercentage: records.length > 0
      ? Math.round((records.filter(r => r.status === 'present').length / records.length) * 100)
      : 0,
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const isTodayMarked = attendanceData.todayRecord || records.some(r => (r.date || '').split('T')[0] === todayStr);

  // Generate days in month
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay(); // 0 is Sunday

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  // Map dates to attendance status reliably without timezone offset bugs
  const getRecordForDay = (day) => {
    const formattedDay = day < 10 ? `0${day}` : `${day}`;
    const formattedMonth = (currentMonth + 1) < 10 ? `0${currentMonth + 1}` : `${currentMonth + 1}`;
    const targetDateStr = `${currentYear}-${formattedMonth}-${formattedDay}`;

    return records.find(r => {
      const dStr = (r.date || '').split('T')[0];
      return dStr === targetDateStr;
    });
  };

  return (
    <div className="space-y-8 font-outfit text-[#bdbdbd]">
      
      {/* Header & Live Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#161616] border border-[#d4af37]/40 text-xs text-[#d4af37] font-cinzel font-semibold mb-2 shadow">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Live Academy Sadhana Ledger</span>
          </div>
          <h1 className="font-cinzel text-2xl sm:text-3xl font-bold text-white tracking-wide">
            Attendance Record &amp; Sadhana Calendar
          </h1>
          <p className="text-xs sm:text-sm text-[#aaaaaa] mt-1 max-w-2xl">
            Live database verification of your classes. Disciples require a minimum 85% attendance for Tamil Nadu Music &amp; Fine Arts University grade examination eligibility.
          </p>
        </div>

        {/* Live Check-in Card */}
        <div className="p-4 rounded-2xl bg-[#111111] border border-[#333333] shadow-xl flex items-center gap-3">
          <div className={`p-3 rounded-xl border ${isTodayMarked ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-400' : 'bg-[#181818] border-[#d4af37]/40 text-[#d4af37]'}`}>
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-cinzel text-[#888888] uppercase tracking-wider block">
              Today's Sadhana Status
            </span>
            {isTodayMarked ? (
              <div className="flex items-center gap-1.5 mt-0.5">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-400">Present (Recorded)</span>
              </div>
            ) : (
              <button
                onClick={handleSelfCheckIn}
                disabled={checkInLoading}
                className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#d4af37] hover:bg-[#ffd700] text-[#111111] text-xs font-cinzel font-bold shadow hover:scale-105 transition-all disabled:opacity-50"
              >
                <Sparkles className="w-3 h-3 text-[#111111]" />
                <span>{checkInLoading ? 'Recording...' : 'Mark Present Today'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Alert toast for self check-in */}
      {checkInMessage && (
        <div className={`p-4 rounded-2xl border text-xs flex items-center gap-2.5 transition-all ${
          checkInMessage.type === 'success' 
            ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300' 
            : checkInMessage.type === 'error'
            ? 'bg-rose-950/80 border-rose-700 text-rose-300'
            : 'bg-[#161616] border-[#d4af37] text-[#ffd700]'
        }`}>
          {checkInMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-[#ffd700] flex-shrink-0" />
          )}
          <span>{checkInMessage.text}</span>
        </div>
      )}

      {/* Stats Counter Bar (Live DB Metrics) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        
        {/* Overall Attendance */}
        <div className="p-5 rounded-2xl bg-[#111111] border border-[#333333] hover:border-[#d4af37]/60 shadow-xl transition-all">
          <span className="text-xs font-cinzel text-[#888888] uppercase tracking-wider block">
            Overall Attendance
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-cinzel font-bold text-3xl text-white block">
              {stats.total === 0 ? '--' : `${stats.attendancePercentage}%`}
            </span>
          </div>
          <span className={`text-[11px] font-semibold block mt-1 ${
            stats.total === 0 ? 'text-[#888888]' : stats.attendancePercentage >= 85 ? 'text-emerald-400' : 'text-amber-400'
          }`}>
            {stats.total === 0
              ? 'Awaiting first marked class by Guru'
              : stats.attendancePercentage >= 85
              ? '✓ Eligible for University Exams'
              : '⚠ Below 85% Benchmark'}
          </span>
        </div>

        {/* Classes Present */}
        <div className="p-5 rounded-2xl bg-[#111111] border border-[#333333] hover:border-[#d4af37]/60 shadow-xl transition-all">
          <span className="text-xs font-cinzel text-[#888888] uppercase tracking-wider block">
            Classes Present
          </span>
          <span className="font-cinzel font-bold text-3xl text-emerald-400 mt-1 block">
            {stats.present}
          </span>
          <span className="text-[11px] text-[#888888] block mt-1">Verified Sadhana Sessions</span>
        </div>

        {/* Classes Absent */}
        <div className="p-5 rounded-2xl bg-[#111111] border border-[#333333] hover:border-[#d4af37]/60 shadow-xl transition-all">
          <span className="text-xs font-cinzel text-[#888888] uppercase tracking-wider block">
            Classes Absent
          </span>
          <span className="font-cinzel font-bold text-3xl text-rose-400 mt-1 block">
            {stats.absent}
          </span>
          <span className="text-[11px] text-[#888888] block mt-1">Informed Leaves Logged</span>
        </div>

        {/* Total Sessions */}
        <div className="p-5 rounded-2xl bg-[#111111] border border-[#333333] hover:border-[#d4af37]/60 shadow-xl transition-all">
          <span className="text-xs font-cinzel text-[#888888] uppercase tracking-wider block">
            Total Sessions
          </span>
          <span className="font-cinzel font-bold text-3xl text-white mt-1 block">
            {stats.total}
          </span>
          <span className="text-[11px] text-[#888888] block mt-1">Academy Term Count</span>
        </div>
      </div>

      {/* Calendar View */}
      <div className="bg-[#111111] rounded-3xl border border-[#333333] shadow-xl p-6 sm:p-8">
        
        {/* Month Navigation */}
        <div className="flex items-center justify-between pb-6 border-b border-[#222222]">
          <div className="flex items-center gap-2">
            <CalIcon className="w-5 h-5 text-[#d4af37]" />
            <h2 className="font-cinzel font-bold text-lg sm:text-xl text-white">
              {monthNames[currentMonth]} {currentYear}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevMonth}
              className="p-2 rounded-xl border border-[#333333] hover:border-[#d4af37] bg-[#161616] text-[#d4af37] hover:bg-[#1a1a1a] transition-all"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextMonth}
              className="p-2 rounded-xl border border-[#333333] hover:border-[#d4af37] bg-[#161616] text-[#d4af37] hover:bg-[#1a1a1a] transition-all"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Days of week header */}
        <div className="grid grid-cols-7 gap-2 text-center text-xs font-cinzel font-bold text-[#888888] py-4">
          <span>Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-2">
          {/* Empty cells before month starts */}
          {[...Array(firstDayOfWeek)].map((_, i) => (
            <div key={`empty-${i}`} className="h-16 sm:h-20 rounded-xl bg-[#141414]/40 border border-[#1f1f1f]"></div>
          ))}

          {/* Actual days */}
          {[...Array(daysInMonth)].map((_, i) => {
            const dayNum = i + 1;
            const rec = getRecordForDay(dayNum);
            const status = rec ? rec.status : null;
            const formattedDay = dayNum < 10 ? `0${dayNum}` : `${dayNum}`;
            const formattedMonth = (currentMonth + 1) < 10 ? `0${currentMonth + 1}` : `${currentMonth + 1}`;
            const isToday = `${currentYear}-${formattedMonth}-${formattedDay}` === todayStr;

            return (
              <div
                key={dayNum}
                className={`h-16 sm:h-20 p-2 rounded-xl border flex flex-col justify-between transition-all ${
                  isToday ? 'ring-2 ring-[#d4af37]/80' : ''
                } ${
                  status === 'present'
                    ? 'bg-emerald-950/70 border-emerald-600/80 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                    : status === 'absent'
                    ? 'bg-rose-950/70 border-rose-600/80 shadow-[0_0_12px_rgba(244,63,94,0.2)]'
                    : status === 'late'
                    ? 'bg-amber-950/70 border-amber-600/80'
                    : 'bg-[#161616] border-[#262626] hover:border-[#333333]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-cinzel text-xs font-semibold ${isToday ? 'text-[#ffd700] font-bold' : 'text-white'}`}>
                    {dayNum}
                  </span>
                  {isToday && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#ffd700] animate-ping"></span>
                  )}
                </div>

                {status === 'present' && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-300 bg-emerald-900/80 px-1.5 py-0.5 rounded border border-emerald-700/60">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                    <span className="hidden sm:inline">Present</span>
                  </span>
                )}

                {status === 'absent' && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-300 bg-rose-900/80 px-1.5 py-0.5 rounded border border-rose-700/60">
                    <XCircle className="w-3 h-3 text-rose-400 flex-shrink-0" />
                    <span className="hidden sm:inline">Absent</span>
                  </span>
                )}

                {status === 'late' && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-300 bg-amber-900/80 px-1.5 py-0.5 rounded border border-amber-700/60">
                    <Clock className="w-3 h-3 text-amber-400 flex-shrink-0" />
                    <span className="hidden sm:inline">Late</span>
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-8 pt-4 border-t border-[#222222] flex flex-wrap items-center gap-6 text-xs text-[#aaaaaa]">
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
            <span className="text-white">Present in Sadhana Class</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"></span>
            <span className="text-white">Informed Leave / Absent</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded bg-[#161616] border border-[#333333]"></span>
            <span>Non-Class Day</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded ring-2 ring-[#d4af37]"></span>
            <span className="text-[#ffd700]">Today's Date</span>
          </div>
        </div>

      </div>

      {/* Detailed Live Session Logs Table */}
      <div className="bg-[#111111] rounded-3xl border border-[#333333] shadow-xl p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-[#222222] gap-2">
          <div>
            <h3 className="font-cinzel text-lg font-bold text-white flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-[#d4af37]" />
              Disciple Sadhana Ledger &amp; Session Records
            </h3>
            <p className="text-xs text-[#888888] mt-0.5">
              Chronological log of verified dance sessions and curriculum progress notes.
            </p>
          </div>
          <span className="text-xs font-cinzel text-[#d4af37] px-3 py-1 rounded-full bg-[#181818] border border-[#d4af37]/30 self-start sm:self-auto">
            {records.length} Recorded Sessions
          </span>
        </div>

        {records.length === 0 ? (
          <div className="py-12 text-center text-[#888888]">
            <MudraIcon name="nataraja" className="w-12 h-12 text-[#444444] mx-auto mb-3" />
            <p className="text-sm font-cinzel text-white">No attendance records yet</p>
            <p className="text-xs text-[#666666] mt-1 max-w-sm mx-auto">
              Your attendance will appear here once verified by your Guru or when you check in to your first sadhana session.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#222222] text-[#888888] font-cinzel uppercase text-[11px] tracking-wider">
                  <th className="py-3.5 px-4">Session Date</th>
                  <th className="py-3.5 px-4">Training Batch</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Curriculum &amp; Sadhana Remarks</th>
                  <th className="py-3.5 px-4 text-right">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e1e1e]">
                {records.map((rec) => {
                  const dStr = (rec.date || '').split('T')[0];
                  let formattedDate = dStr;
                  let dayOfWeek = '';
                  try {
                    const parts = dStr.split('-');
                    if (parts.length === 3) {
                      const dObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                      formattedDate = dObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
                      dayOfWeek = dObj.toLocaleDateString('en-IN', { weekday: 'short' });
                    }
                  } catch (e) {
                    // fallback
                  }

                  return (
                    <tr key={rec.id} className="hover:bg-[#161616]/80 transition-colors">
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-semibold text-white">{formattedDate}</div>
                        <span className="text-[10px] text-[#888888]">{dayOfWeek}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[#e0e0e0]">{rec.batch?.name || 'Bharatanatyam Core'}</div>
                        <div className="text-[10px] text-[#888888] flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 text-[#d4af37]" />
                          <span>{rec.batch?.schedule_time || 'Class Timings'}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {rec.status === 'present' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 shadow-[0_0_8px_rgba(16,185,129,0.15)]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Present</span>
                          </span>
                        )}
                        {rec.status === 'absent' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-950/80 text-rose-300 border border-rose-700/60 shadow-[0_0_8px_rgba(244,63,94,0.15)]">
                            <XCircle className="w-3.5 h-3.5 text-rose-400" />
                            <span>Informed Leave</span>
                          </span>
                        )}
                        {rec.status === 'late' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-950/80 text-amber-300 border border-amber-700/60">
                            <Clock className="w-3.5 h-3.5 text-amber-400" />
                            <span>Late</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-[#bdbdbd] max-w-xs">
                        <p className="line-clamp-2">{rec.remarks || 'Standard studio class session'}</p>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-[11px] text-[#d4af37] bg-[#1a1a1a] border border-[#333333] px-2 py-0.5 rounded-lg">
                          <Check className="w-3 h-3 text-[#d4af37]" />
                          <span>Verified</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
