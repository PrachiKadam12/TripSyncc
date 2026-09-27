import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  UserCheck,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  FileWarning,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { fetchProfileCompletion } from '../../services/profileService.js';

const STATUS_CONFIG = {
  travel_ready: {
    label: 'Travel Ready',
    bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    barColor: 'from-emerald-500 to-teal-500',
    badgeIcon: CheckCircle2,
  },
  almost_ready: {
    label: 'Almost Ready',
    bg: 'bg-amber-50 text-amber-700 border-amber-200',
    barColor: 'from-amber-400 to-orange-400',
    badgeIcon: Clock,
  },
  action_required: {
    label: 'Action Required',
    bg: 'bg-rose-50 text-rose-700 border-rose-200',
    barColor: 'from-rose-500 to-red-500',
    badgeIcon: AlertTriangle,
  },
};

export default function ProfileCompletionCard({ className = '' }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetchProfileCompletion(user);
        if (mounted) setData(res);
      } catch (err) {
        console.error('Error loading profile card data:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [user]);

  if (!user) return null; // Don't show unauthenticated

  const percentage = data?.percentage ?? 0;
  const statusKey = data?.status || 'action_required';
  const statusInfo = STATUS_CONFIG[statusKey] || STATUS_CONFIG.action_required;
  const StatusIcon = statusInfo.badgeIcon;
  const itemsRemaining = data?.items_remaining ?? 6;

  // Derive document alerts
  const alerts = [];
  if (data?.documents && data.documents.length > 0) {
    const now = new Date();
    data.documents.forEach((doc) => {
      if (doc.expires_at || doc.expiry_date) {
        const expDate = new Date(doc.expires_at || doc.expiry_date);
        const daysLeft = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));
        if (daysLeft > 0 && daysLeft <= 60) {
          alerts.push({
            title: `${doc.title || doc.file_name} expires soon`,
            desc: `Expires in ${daysLeft} days. Renewal recommended before international travel.`,
            type: 'warning',
          });
        }
      }
    });
  }

  // If passport or insurance is missing, surface helpful alert
  if (data?.sections?.travel_identity?.status !== 'complete') {
    alerts.push({
      title: 'Missing Travel Identity',
      desc: 'Upload a valid government passport or national ID for swift recovery access.',
      type: 'info',
    });
  }
  if (data?.sections?.health_insurance?.status !== 'complete') {
    alerts.push({
      title: 'Health Insurance Not Attached',
      desc: 'Add travel medical coverage to protect against health emergency disruptions.',
      type: 'info',
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-3xl bg-white border border-navy/10 p-5 sm:p-6 shadow-sm hover:shadow-md transition-all ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
            <UserCheck size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-navy">Travel Profile</h3>
              <span className={`inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-full border ${statusInfo.bg}`}>
                <StatusIcon size={12} />
                {statusInfo.label}
              </span>
            </div>
            <p className="text-xs text-ink-soft">
              {itemsRemaining === 0
                ? 'All travel readiness categories completed'
                : `${itemsRemaining} ${itemsRemaining === 1 ? 'category' : 'categories'} remaining`}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate('/app/profile')}
          className="btn-primary self-start sm:self-auto flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold shadow-sm active:scale-95 transition-all"
        >
          Complete Profile
          <ArrowRight size={14} />
        </button>
      </div>

      {/* Progress Bar & Percentage */}
      <div className="space-y-1.5 mb-4">
        <div className="flex justify-between text-xs font-bold text-navy-soft">
          <span>Readiness Score</span>
          <span className="font-black text-navy">{percentage}%</span>
        </div>
        <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden p-0.5">
          <motion.div
            className={`h-full rounded-full bg-gradient-to-r ${statusInfo.barColor}`}
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Upcoming Document Alerts */}
      {alerts.length > 0 && (
        <div className="pt-3 border-t border-navy/5 space-y-2">
          <div className="text-[11px] font-black text-navy uppercase tracking-wider flex items-center gap-1.5">
            <ShieldAlert size={13} className="text-amber-500" />
            Upcoming Document Alerts
          </div>
          <div className="space-y-1.5">
            {alerts.slice(0, 2).map((alert, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 p-2.5 rounded-2xl bg-amber-50/70 border border-amber-200/60 text-amber-900 text-xs"
              >
                <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-[11px] text-amber-950">{alert.title}</p>
                  <p className="text-[11px] text-amber-800 leading-tight mt-0.5">{alert.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
