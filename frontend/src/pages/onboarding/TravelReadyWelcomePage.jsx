import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  User,
  HeartPulse,
  FileText,
  ShieldCheck,
  BellRing,
  ArrowRight,
  Plane,
  Sparkles,
} from 'lucide-react';

const BENEFITS = [
  {
    icon: User,
    title: 'Personal Details',
    desc: 'Store verified passenger details for rapid ticket and hotel rebooking.',
  },
  {
    icon: HeartPulse,
    title: 'Emergency Contact',
    desc: 'Reach trusted family or companions instantly during unexpected travel emergencies.',
  },
  {
    icon: FileText,
    title: 'Travel Documents',
    desc: 'Keep Passport, Aadhaar, and identity records encrypted and available offline.',
  },
  {
    icon: ShieldCheck,
    title: 'Health Insurance',
    desc: 'Attach policy coverage details for medical emergencies and hospital assistance.',
  },
  {
    icon: BellRing,
    title: 'Document Expiry Alerts',
    desc: 'Get notified well before passports, visas, or policies expire.',
  },
];

export default function TravelReadyWelcomePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50/30 to-indigo-50/30 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden flex flex-col justify-center">
      {/* Decorative gradient accents */}
      <div className="absolute top-10 left-10 w-80 h-80 bg-sky-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-indigo-200/40 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-2xl mx-auto w-full relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-100 text-sky-700 text-xs font-bold mb-4">
            <Sparkles size={14} />
            <span>Intelligent Travel Resilience</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-navy tracking-tight">
            Let&apos;s Get You Travel-Ready
          </h1>
          <p className="mt-2.5 text-xs sm:text-sm font-medium text-ink-soft max-w-lg mx-auto leading-relaxed">
            Before you plan your first trip, set up your travel profile. It helps TripSync keep you safe, organized and ready for any situation.
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-8">
          {BENEFITS.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                className={`bg-white rounded-3xl p-5 border border-navy/10 shadow-sm hover:shadow-md transition-shadow flex items-start gap-4 ${
                  index === 4 ? 'sm:col-span-2 sm:max-w-md sm:mx-auto w-full' : ''
                }`}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                  <Icon size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-navy">{item.title}</h3>
                  <p className="mt-1 text-xs text-ink-soft leading-relaxed">{item.desc}</p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Primary CTA */}
        <div className="text-center">
          <button
            type="button"
            onClick={() => navigate('/profile/setup')}
            className="btn-primary px-8 py-4 rounded-2xl text-sm font-black shadow-xl shadow-sky-500/25 inline-flex items-center gap-2 hover:shadow-2xl active:scale-95 transition-all"
          >
            Start Travel Profile Setup
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
