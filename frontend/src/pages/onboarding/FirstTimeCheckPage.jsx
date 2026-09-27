import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plane, CheckCircle2, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { getProfileSetupStatus } from '../../services/onboardingService.js';

export default function FirstTimeCheckPage() {
  const { user, profile, displayName } = useAuth();
  const navigate = useNavigate();

  const [step1, setStep1] = useState(false);
  const [step2, setStep2] = useState(false);
  const [step3, setStep3] = useState(false);
  const [ready, setReady] = useState(false);

  const firstName =
    profile?.first_name ||
    user?.user_metadata?.first_name ||
    displayName?.split(' ')[0] ||
    'Traveler';

  useEffect(() => {
    // If returning user already completed profile, bypass straight to /app
    async function checkStatus() {
      if (user) {
        const status = await getProfileSetupStatus(user);
        if (status === 'completed') {
          navigate('/app', { replace: true });
          return;
        }
      }
    }
    checkStatus();

    // Sequence subtle verification checks
    const t1 = setTimeout(() => setStep1(true), 500);
    const t2 = setTimeout(() => setStep2(true), 1300);
    const t3 = setTimeout(() => setStep3(true), 2100);
    const t4 = setTimeout(() => setReady(true), 2800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [user, navigate]);

  const handleContinue = () => {
    navigate('/profile/welcome');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/40 to-indigo-50/30 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Soft gradient background accents */}
      <div className="absolute top-1/4 -left-20 w-72 h-72 bg-sky-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-72 h-72 bg-indigo-200/40 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md bg-white rounded-3xl p-8 sm:p-10 shadow-xl shadow-slate-200/60 border border-navy/10 text-center relative z-10"
      >
        {/* Brand Icon */}
        <motion.div
          initial={{ rotate: -20, scale: 0.8 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-500 text-white shadow-xl shadow-sky-500/30 mb-6"
        >
          <Plane size={32} />
        </motion.div>

        {/* Welcome Headers */}
        <h1 className="text-2xl sm:text-3xl font-black text-navy tracking-tight">
          Welcome to TripSync, {firstName}! 👋
        </h1>
        <p className="mt-2 text-xs sm:text-sm font-medium text-ink-soft leading-relaxed">
          Let&apos;s get you travel-ready before your first trip.
        </p>

        {/* Checklist Animation */}
        <div className="my-8 text-left space-y-3.5 bg-slate-50 p-5 rounded-2xl border border-slate-100">
          {/* Step 1 */}
          <div className="flex items-center gap-3">
            {step1 ? (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
              </motion.div>
            ) : (
              <span className="h-4 w-4 rounded-full border-2 border-slate-300 animate-spin border-t-transparent shrink-0" />
            )}
            <span
              className={`text-xs font-bold transition-colors ${
                step1 ? 'text-navy' : 'text-slate-400'
              }`}
            >
              Account created successfully
            </span>
          </div>

          {/* Step 2 */}
          <div className="flex items-center gap-3">
            {step2 ? (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
              </motion.div>
            ) : step1 ? (
              <span className="h-4 w-4 rounded-full border-2 border-sky-400 animate-spin border-t-transparent shrink-0" />
            ) : (
              <span className="h-4 w-4 rounded-full border border-slate-300 shrink-0" />
            )}
            <span
              className={`text-xs font-bold transition-colors ${
                step2 ? 'text-navy' : 'text-slate-400'
              }`}
            >
              Checking your travel profile
            </span>
          </div>

          {/* Step 3 */}
          <div className="flex items-center gap-3">
            {step3 ? (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
              </motion.div>
            ) : step2 ? (
              <span className="h-4 w-4 rounded-full border-2 border-sky-400 animate-spin border-t-transparent shrink-0" />
            ) : (
              <span className="h-4 w-4 rounded-full border border-slate-300 shrink-0" />
            )}
            <span
              className={`text-xs font-bold transition-colors ${
                step3 ? 'text-navy' : 'text-slate-400'
              }`}
            >
              Preparing your travel profile setup
            </span>
          </div>
        </div>

        {/* CTA Button */}
        <motion.button
          type="button"
          onClick={handleContinue}
          disabled={!ready}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: ready ? 1 : 0.6, y: ready ? 0 : 5 }}
          className="btn-primary w-full py-3.5 rounded-2xl text-xs font-black shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          Get Started
          <ArrowRight size={16} />
        </motion.button>
      </motion.div>
    </div>
  );
}
