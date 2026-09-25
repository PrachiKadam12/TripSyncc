import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Compass,
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  UserPlus,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Plane,
  ShieldCheck,
} from 'lucide-react';
import { supabase } from '../services/supabase.js';

export default function LoginPage({ onLoginSuccess }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!email.trim() || !password.trim()) {
      setError('Please fill in both email and password.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'login') {
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });

        if (authError) {
          throw authError;
        }

        if (data?.user) {
          if (onLoginSuccess) onLoginSuccess(data.user);
          navigate('/app');
        }
      } else {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password: password,
        });

        if (authError) {
          throw authError;
        }

        if (data?.session) {
          if (onLoginSuccess) onLoginSuccess(data.user);
          navigate('/app');
        } else if (data?.user) {
          setMessage('Account created! Please check your email inbox to confirm your registration.');
          setMode('login');
        }
      }
    } catch (err) {
      console.error('Supabase Auth error:', err);
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    // Quick Demo Mode bypass
    navigate('/app');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Decorative Blobs */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-sky-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-primary-soft/50 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
        {/* Back Link */}
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-navy-soft hover:text-primary transition-colors mb-6"
        >
          <ArrowLeft size={16} /> Back to TripSync Home
        </Link>

        {/* Brand Header */}
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-sky-500/20 mb-3">
            <Plane size={26} className="rotate-[-20deg]" />
          </div>
          <h2 className="text-2xl font-black tracking-tight text-navy sm:text-3xl">
            {mode === 'login' ? 'Welcome back to TripSync' : 'Create your TripSync account'}
          </h2>
          <p className="mt-1.5 text-xs text-ink-soft">
            {mode === 'login'
              ? 'Sign in to access your connected trip, documents, and real-time recovery.'
              : 'Join TripSync to experience intelligent travel disruption recovery.'}
          </p>
        </div>

        {/* Auth Card */}
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-6 shadow-float rounded-3xl border border-navy/10 sm:px-10">
            {/* Mode Toggle Tabs */}
            <div className="flex rounded-2xl bg-slate-100 p-1 mb-6">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                  setMessage('');
                }}
                className={`flex-1 py-2 text-xs font-black rounded-xl transition-all ${
                  mode === 'login'
                    ? 'bg-white text-navy shadow-sm'
                    : 'text-ink-soft hover:text-navy'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError('');
                  setMessage('');
                }}
                className={`flex-1 py-2 text-xs font-black rounded-xl transition-all ${
                  mode === 'signup'
                    ? 'bg-white text-navy shadow-sm'
                    : 'text-ink-soft hover:text-navy'
                }`}
              >
                Create Account
              </button>
            </div>

            {/* Error / Success Notifications */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="mb-4 flex items-start gap-2.5 rounded-2xl bg-critical-light p-3.5 text-xs font-semibold text-critical border border-critical/20"
                >
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </motion.div>
              )}

              {message && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="mb-4 flex items-start gap-2.5 rounded-2xl bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-800 border border-emerald-200"
                >
                  <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-600" />
                  <span>{message}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-navy uppercase tracking-wider mb-1.5">
                  Email address
                </label>
                <div className="relative rounded-2xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ink-faint">
                    <Mail size={16} />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tanvi@tripsync.app"
                    className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-navy placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-navy uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative rounded-2xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ink-faint">
                    <Lock size={16} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-navy placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-ink-faint hover:text-navy"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-3 rounded-2xl text-xs font-black shadow-md flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Connecting...
                  </span>
                ) : mode === 'login' ? (
                  <>
                    <LogIn size={16} /> Sign In
                  </>
                ) : (
                  <>
                    <UserPlus size={16} /> Create Account
                  </>
                )}
              </button>
            </form>

            {/* Quick Demo Bypass Button */}
            <div className="mt-6 pt-5 border-t border-navy/10 text-center">
              <p className="text-[11px] font-semibold text-ink-soft mb-2.5">
                Exploring for HackCelestial demonstration?
              </p>
              <button
                type="button"
                onClick={handleDemoLogin}
                className="w-full py-2.5 px-4 rounded-2xl bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold text-xs border border-sky-200 transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <Sparkles size={15} /> Continue as Demo Traveler (Tanvi)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
