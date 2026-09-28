import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, KeyRound, Lock, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import MudraIcon from '../../components/common/MudraIcon';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState(1); // 1: Email, 2: OTP + New Password
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (!email) return;
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/forgot-password', { email });
      if (res.data.success) {
        setMessage(res.data.message);
        if (res.data.data?.devOtp) {
          setOtp(res.data.data.devOtp);
        }
        setStep(2);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to request reset OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!otp || !newPassword) return;
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/reset-password', { email, otp, newPassword });
      if (res.data.success) {
        setMessage('Password reset successfully! Redirecting to login...');
        setTimeout(() => navigate('/login'), 2000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password. Check OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-160px)] relative flex items-center justify-center py-12 sm:py-16 px-4 sm:px-6 lg:px-8 overflow-hidden bg-temple-maroon-deep">
      {/* Background BG1.png & Temple Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-luminosity scale-105 pointer-events-none"
        style={{ backgroundImage: `url('/BG1.png')` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-temple-maroon-deep via-temple-maroon/90 to-temple-maroon-deep/95 pointer-events-none" />
      <div className="absolute inset-0 opacity-10 bg-kolam-pattern pointer-events-none" />

      <div className="max-w-md w-full space-y-6 bg-white/95 backdrop-blur-sm p-8 sm:p-10 rounded-3xl border-2 border-temple-gold shadow-2xl relative z-10 overflow-hidden">
        
        {/* Top Gold Ornament */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-temple-maroon via-temple-gold to-temple-maroon"></div>

        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-temple-maroon text-temple-gold border-2 border-temple-gold flex items-center justify-center mx-auto shadow-gold-glow p-2 overflow-hidden">
            <img src="/logo.png" alt="Sri Ruthralaya" className="w-full h-full object-contain" />
          </div>
          <h2 className="mt-3 font-cinzel text-xl font-bold text-temple-maroon tracking-wide">
            Password Recovery
          </h2>
          <p className="text-xs text-stone-500 font-outfit mt-0.5">
            Sri Ruthralaya Student &amp; Staff Portal
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <span>{message}</span>
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleRequestOtp} className="space-y-4 font-outfit">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1 font-cinzel">
                Registered Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="your.email@example.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-300 text-xs sm:text-sm focus:outline-none focus:border-temple-gold bg-temple-cream/30"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-temple-maroon text-temple-gold hover:bg-temple-maroon-dark text-xs sm:text-sm font-cinzel font-bold shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <span>{loading ? 'Sending Code...' : 'Request Verification OTP'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4 font-outfit">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1 font-cinzel">
                Verification OTP Code
              </label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                placeholder="Enter 6-digit OTP"
                maxLength={6}
                className="w-full px-4 py-2.5 rounded-xl border border-stone-300 text-xs sm:text-sm focus:outline-none focus:border-temple-gold bg-temple-cream/30 text-center tracking-widest font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1 font-cinzel">
                New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  placeholder="New password (min 6 characters)"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-300 text-xs sm:text-sm focus:outline-none focus:border-temple-gold bg-temple-cream/30"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-temple-maroon text-temple-gold hover:bg-temple-maroon-dark text-xs sm:text-sm font-cinzel font-bold shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <span>{loading ? 'Updating Password...' : 'Save New Password & Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        <div className="text-center pt-2">
          <Link to="/login" className="text-xs text-temple-maroon font-semibold hover:underline">
            ← Return to Sign In
          </Link>
        </div>

      </div>
    </div>
  );
}
