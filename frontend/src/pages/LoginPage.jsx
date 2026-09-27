import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plane,
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
  User,
  ShieldCheck,
} from 'lucide-react';
import { supabase } from '../services/supabase.js';
import { AUTH_REDIRECT_URL } from '../services/supabase.js';
import { useTrip } from '../context/TripContext.jsx';
import { getProfileSetupStatus } from '../services/onboardingService.js';

export default function LoginPage() {
  const navigate = useNavigate();
  const { enableDemoMode } = useTrip();

  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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

    if (mode === 'signup') {
      if (!fullName.trim()) {
        setError('Please enter your full legal name.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      if (!agreeTerms) {
        setError('Please agree to the Terms of Service & Privacy Policy.');
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === 'login') {
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (authError) throw authError;

        if (data?.user) {
          // Check profile setup status for returning vs new user
          const status = await getProfileSetupStatus(data.user);
          if (status === 'completed') {
            navigate('/app');
          } else {
            navigate('/profile/check');
          }
        }
      } else {
        // Sign up flow
        const nameParts = fullName.trim().split(' ');
        const firstName = nameParts[0] || 'Traveler';
        const lastName = nameParts.slice(1).join(' ') || '';

        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: AUTH_REDIRECT_URL,
            data: {
              full_name: fullName.trim(),
              first_name: firstName,
              last_name: lastName,
              display_name: firstName,
            },
          },
        });

        if (authError) {
          const msg = authError.message.toLowerCase();
          if (msg.includes('already registered') || msg.includes('already been registered') || msg.includes('user already')) {
            setError('This email is already registered. Please sign in instead.');
            setMode('login');
            return;
          }
          if (msg.includes('rate') || msg.includes('limit') || msg.includes('email')) {
            setError(
              '⚠️ Sign-up limit reached on free email delivery.\n' +
              'Turn off "Confirm email" in Supabase Dashboard → Authentication → Providers → Email for instant access, or retry in a few moments.'
            );
            return;
          }
          throw authError;
        }

        // Initialize profile row with profile_setup_status: 'not_started'
        if (data?.user) {
          try {
            await supabase.from('profiles').upsert(
              {
                id: data.user.id,
                first_name: firstName,
                last_name: lastName,
                display_name: firstName,
                email: email.trim(),
                profile_setup_status: 'not_started',
              },
              { onConflict: 'id' }
            );
          } catch (profileErr) {
            console.warn('Profile initialization note:', profileErr.message);
          }
        }

        // Check if email confirmation is required
        const emailConfirmationRequired = data?.user && !data?.session;

        if (emailConfirmationRequired) {
          // Email confirmation is required — user must verify before signing in
          setMessage(
            '✉️ Account created! Please check your email to confirm your account, then sign in below.'
          );
          setMode('login');
          return;
        }

        // Session immediately active (Confirm email off) -> Transition to first-time onboarding
        if (data?.session) {
          navigate('/profile/check');
          return;
        }
      }
    } catch (err) {
      console.error('Auth error:', err);
      setError(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    enableDemoMode();
    navigate('/app');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/30 to-indigo-50/40 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Decorative Gradient Blobs */}
      <div className="absolute -top-32 -left-32 w-80 h-80 bg-sky-200/50 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-indigo-200/40 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4">
        {/* Back Link */}
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-navy-soft hover:text-sky-600 transition-colors mb-6"
        >
          <ArrowLeft size={16} /> Back to TripSync Home
        </Link>

        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500 text-white shadow-xl shadow-sky-500/25 mb-3">
            <Plane size={28} className="rotate-[-15deg]" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-navy sm:text-3xl">
            {mode === 'login' ? 'Welcome Back' : 'Create an Account'}
          </h1>
          <p className="mt-1 text-xs font-medium text-ink-soft">
            {mode === 'login'
              ? 'Continue your journey with TripSync'
              : 'Join TripSync and travel with confidence'}
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-white py-8 px-6 shadow-xl shadow-slate-200/50 rounded-3xl border border-navy/10 sm:px-10">
          {/* Mode Switcher Tabs */}
          <div className="flex rounded-2xl bg-slate-100 p-1 mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError('');
                setMessage('');
              }}
              className={`flex-1 py-2 text-xs font-black rounded-xl transition-all ${
                mode === 'login' ? 'bg-white text-navy shadow-sm' : 'text-ink-soft hover:text-navy'
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
                mode === 'signup' ? 'bg-white text-navy shadow-sm' : 'text-ink-soft hover:text-navy'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Feedback Alerts */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-4 flex items-start gap-2.5 rounded-2xl bg-rose-50 p-3.5 text-xs font-semibold text-rose-700 border border-rose-200"
              >
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span className="whitespace-pre-line">{error}</span>
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
            {/* Full Name for Signup */}
            <AnimatePresence>
              {mode === 'signup' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-1.5"
                >
                  <label className="block text-xs font-bold text-navy">Full Name</label>
                  <div className="relative rounded-2xl">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <User size={16} />
                    </div>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Sneha Mathur"
                      className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-navy placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-navy">Email Address</label>
              <div className="relative rounded-2xl">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail size={16} />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="block w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-navy placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-navy">Password</label>
              <div className="relative rounded-2xl">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
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
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-navy"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm Password for Signup */}
            <AnimatePresence>
              {mode === 'signup' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-1.5"
                >
                  <label className="block text-xs font-bold text-navy">Confirm Password</label>
                  <div className="relative rounded-2xl">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock size={16} />
                    </div>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="block w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-navy placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:bg-white transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-navy"
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Options: Remember me & Forgot Password for Login */}
            {mode === 'login' ? (
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-navy-soft">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                  Remember me
                </label>
                <a
                  href="#forgot"
                  onClick={(e) => {
                    e.preventDefault();
                    setMessage('Password reset instructions will be sent to your email.');
                  }}
                  className="font-bold text-sky-600 hover:underline"
                >
                  Forgot password?
                </a>
              </div>
            ) : (
              /* Terms & Privacy checkbox for Signup */
              <div className="pt-1">
                <label className="flex items-start gap-2 cursor-pointer text-xs font-medium text-ink-soft">
                  <input
                    type="checkbox"
                    required
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                  />
                  <span>
                    I agree to the{' '}
                    <span className="text-sky-600 font-bold">Terms of Service</span> and{' '}
                    <span className="text-sky-600 font-bold">Privacy Policy</span>.
                  </span>
                </label>
              </div>
            )}

            {/* Submit CTA */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 rounded-2xl text-xs font-black shadow-md flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  {mode === 'login' ? 'Signing in…' : 'Creating account…'}
                </span>
              ) : mode === 'login' ? (
                <>
                  <LogIn size={16} /> Login
                </>
              ) : (
                <>
                  <UserPlus size={16} /> Sign Up
                </>
              )}
            </button>
          </form>

          {/* Footer Navigation Link */}
          <div className="mt-5 text-center text-xs font-medium text-ink-soft">
            {mode === 'login' ? (
              <>
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setError('');
                    setMessage('');
                  }}
                  className="font-bold text-sky-600 hover:underline"
                >
                  Sign Up
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                    setMessage('');
                  }}
                  className="font-bold text-sky-600 hover:underline"
                >
                  Login
                </button>
              </>
            )}
          </div>

          {/* Demo Sandbox Quick Access */}
          <div className="mt-6 pt-5 border-t border-navy/10 text-center">
            <p className="text-[11px] font-semibold text-ink-soft mb-2">
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
  );
}
