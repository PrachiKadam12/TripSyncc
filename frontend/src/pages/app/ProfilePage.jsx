import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Phone,
  HeartPulse,
  Fingerprint,
  FileText,
  ShieldCheck,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ChevronRight,
  Info,
  X,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { fetchProfileCompletion } from '../../services/profileService.js';
import { loadOnboardingData } from '../../services/onboardingService.js';

const STATUS_CONFIG = {
  travel_ready: {
    label: 'Travel Ready',
    bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    barColor: 'from-emerald-500 to-teal-500',
    ringColor: '#10b981',
    badgeIcon: CheckCircle2,
  },
  almost_ready: {
    label: 'Almost Ready',
    bg: 'bg-amber-50 text-amber-700 border-amber-200',
    barColor: 'from-amber-400 to-orange-400',
    ringColor: '#f59e0b',
    badgeIcon: Clock,
  },
  action_required: {
    label: 'Action Required',
    bg: 'bg-rose-50 text-rose-700 border-rose-200',
    barColor: 'from-rose-500 to-red-500',
    ringColor: '#f43f5e',
    badgeIcon: AlertCircle,
  },
};

const CATEGORY_ICONS = {
  personal_details: User,
  contact_details: Phone,
  emergency_contact: HeartPulse,
  travel_identity: Fingerprint,
  travel_documents: FileText,
  health_insurance: ShieldCheck,
};

export default function ProfilePage() {
  const { user, profile, displayName } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [saved, setSaved] = useState({ profile: null, emergency: null, extras: {} });
  const [selectedSection, setSelectedSection] = useState(null);

  const goToEdit = (step) => {
    const qs = step ? `?mode=edit&step=${step}` : '?mode=edit';
    navigate(`/profile/setup${qs}`);
  };

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const [result, onboard] = await Promise.all([
          fetchProfileCompletion(user),
          user?.id ? loadOnboardingData(user.id) : null,
        ]);
        if (mounted) {
          setData(result);
          if (onboard) setSaved(onboard);
        }
      } catch (err) {
        console.error('Failed to load profile completion:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, [user, profile]);

  const percentage = data?.percentage ?? 0;
  const statusKey = data?.status || 'action_required';
  const statusInfo = STATUS_CONFIG[statusKey] || STATUS_CONFIG.action_required;
  const StatusIcon = statusInfo.badgeIcon;
  const itemsRemaining = data?.items_remaining ?? 6;

  // Circular progress calculations
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const handleCardClick = (key) => {
    if (key === 'travel_documents') {
      navigate('/app/documents');
      return;
    }
    const stepMap = {
      personal_details: 'personal',
      contact_details: 'contact',
      emergency_contact: 'emergency',
      travel_identity: 'identity',
      health_insurance: 'insurance',
    };
    if (stepMap[key]) {
      goToEdit(stepMap[key]);
      return;
    }
    setSelectedSection(data?.sections?.[key] || null);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-navy/10 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-navy tracking-tight">Travel Profile</h1>
          <p className="text-sm font-medium text-ink-soft mt-1">
            Manage your personal information and travel documents.
          </p>
        </div>
        <button
          type="button"
          onClick={() => goToEdit()}
          className="btn-primary self-start sm:self-auto flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold shadow-sm hover:shadow active:scale-95 transition-all"
        >
          <Edit3 size={15} />
          Edit profile
        </button>
      </div>

      {/* Completion Indicator Hero Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-3xl bg-white border border-navy/10 p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
      >
        <div className="flex flex-col md:flex-row items-center gap-8 justify-between">
          {/* Circular Indicator */}
          <div className="relative flex items-center justify-center shrink-0">
            <svg className="w-36 h-36 -rotate-90 transform" viewBox="0 0 128 128">
              <circle
                cx="64"
                cy="64"
                r={radius}
                className="text-slate-100"
                strokeWidth="10"
                stroke="currentColor"
                fill="transparent"
              />
              <motion.circle
                cx="64"
                cy="64"
                r={radius}
                stroke={statusInfo.ringColor}
                strokeWidth="10"
                strokeLinecap="round"
                fill="transparent"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-black text-navy">{percentage}%</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-soft">Completed</span>
            </div>
          </div>

          {/* Details & Status */}
          <div className="flex-1 w-full text-center md:text-left space-y-4">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border ${statusInfo.bg}`}
              >
                <StatusIcon size={14} />
                {statusInfo.label}
              </span>
              <span className="text-xs font-bold text-ink-soft">
                {itemsRemaining === 0
                  ? 'All categories completed'
                  : `${itemsRemaining} ${itemsRemaining === 1 ? 'category' : 'categories'} remaining`}
              </span>
            </div>

            <p className="text-xs text-ink-soft leading-relaxed max-w-xl">
              {percentage >= 90
                ? 'Your travel profile is in great shape! You have the necessary personal and document requirements for seamless journey disruption protection.'
                : percentage >= 70
                ? 'You are almost ready. Complete the remaining travel details and documents to guarantee instant recovery during unexpected schedule disruptions.'
                : 'Action required: Complete your profile information and upload essential documents to ensure rapid rebooking and refund processing.'}
            </p>

            {/* Linear Progress Bar */}
            <div className="space-y-1.5 w-full">
              <div className="flex justify-between text-[11px] font-bold text-navy-soft">
                <span>Profile Completion</span>
                <span>{percentage}% / 100%</span>
              </div>
              <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden p-0.5">
                <motion.div
                  className={`h-full rounded-full bg-gradient-to-r ${statusInfo.barColor}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Saved details from first-time setup */}
      <div className="rounded-3xl bg-white border border-navy/10 p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-black text-navy">Your details</h2>
            <p className="text-xs text-ink-soft mt-0.5">These are the same fields you filled when you first signed in.</p>
          </div>
          <button
            type="button"
            onClick={() => goToEdit()}
            className="text-sm font-semibold text-sky-600 hover:underline inline-flex items-center gap-1"
          >
            <Edit3 size={14} /> Edit
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          {[
            { label: 'Full name', value: [saved.profile?.first_name, saved.profile?.last_name].filter(Boolean).join(' ') || displayName },
            { label: 'Date of birth', value: saved.profile?.date_of_birth ? String(saved.profile.date_of_birth).slice(0, 10) : saved.extras?.dateOfBirth },
            { label: 'Nationality', value: saved.profile?.nationality || saved.extras?.nationality },
            { label: 'City', value: saved.profile?.home_city || saved.extras?.city },
            { label: 'Country', value: saved.profile?.home_country || saved.extras?.country },
            { label: 'Phone', value: saved.profile?.phone || saved.extras?.phone },
            { label: 'Email', value: saved.profile?.email || user?.email || saved.extras?.email },
            { label: 'Emergency contact', value: saved.emergency?.name ? `${saved.emergency.name} · ${saved.emergency.phone || ''}` : null },
          ].map((row) => (
            <div key={row.label} className="rounded-2xl bg-slate-50 border border-navy/5 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{row.label}</p>
              <p className="mt-1 font-semibold text-navy">{row.value || 'Not added yet'}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Completion Category Cards Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-navy">Completion Categories</h2>
          <span className="text-xs font-bold text-ink-soft">6 Categories Total</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.sections &&
            Object.entries(data.sections).map(([key, sec], index) => {
              const Icon = CATEGORY_ICONS[key] || FileText;
              const isComplete = sec.status === 'complete';
              const isPartial = sec.status === 'partially_complete';

              let badgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
              let badgeText = 'Missing';
              let StatusBadgeIcon = AlertCircle;

              if (isComplete) {
                badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                badgeText = 'Complete';
                StatusBadgeIcon = CheckCircle2;
              } else if (isPartial) {
                badgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
                badgeText = 'Partially Complete';
                StatusBadgeIcon = Clock;
              }

              return (
                <motion.div
                  key={key}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleCardClick(key)}
                  className="group rounded-3xl bg-white border border-navy/10 p-5 shadow-sm hover:shadow-md hover:border-sky-300 transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 group-hover:bg-sky-500 group-hover:text-white transition-colors">
                        <Icon size={20} />
                      </div>
                      <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600">
                        Weight: {sec.weight}%
                      </span>
                    </div>

                    <div>
                      <h3 className="text-sm font-black text-navy group-hover:text-sky-600 transition-colors">
                        {sec.name}
                      </h3>
                      <p className="text-xs text-ink-soft mt-0.5 line-clamp-2">{sec.details}</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-navy/5 mt-4 flex items-center justify-between">
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-full border ${badgeClass}`}
                    >
                      <StatusBadgeIcon size={12} />
                      {badgeText}
                    </span>

                    <span className="text-xs font-bold text-sky-600 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                      {key.includes('documents')
                        ? 'Manage'
                        : 'Edit'}
                      <ChevronRight size={14} />
                    </span>
                  </div>
                </motion.div>
              );
            })}
        </div>
      </div>

      {/* Section Details Modal */}
      <AnimatePresence>
        {selectedSection && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 border border-navy/10"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-navy">{selectedSection.name}</h3>
                  <p className="text-xs text-ink-soft">Weight: {selectedSection.weight}% of travel readiness</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSection(null)}
                  className="p-1 rounded-full text-ink-soft hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-navy/5">
                  <span className="font-bold text-navy-soft">Status</span>
                  <span
                    className={`font-black px-2.5 py-0.5 rounded-full text-[11px] ${
                      selectedSection.status === 'complete'
                        ? 'bg-emerald-100 text-emerald-800'
                        : selectedSection.status === 'partially_complete'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {selectedSection.status === 'complete'
                      ? 'Complete'
                      : selectedSection.status === 'partially_complete'
                      ? 'Partially Complete'
                      : 'Missing'}
                  </span>
                </div>

                {selectedSection.missingFields && selectedSection.missingFields.length > 0 ? (
                  <div className="rounded-2xl bg-rose-50 border border-rose-100 p-3.5 space-y-1.5 text-rose-900">
                    <p className="font-bold text-[11px] flex items-center gap-1.5">
                      <AlertCircle size={14} className="text-rose-600" />
                      Items needed to complete this category:
                    </p>
                    <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                      {selectedSection.missingFields.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-3.5 text-emerald-900 text-[11px] flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span>All requirements for {selectedSection.name} are verified and complete.</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedSection(null)}
                  className="btn-primary px-4 py-2 text-xs font-bold rounded-xl"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
