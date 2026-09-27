/**
 * DeadlinePolicyCard.jsx — TripSync Stage 21 Deadline & Policy Card
 * 
 * Displays actionable travel deadlines with:
 * - Urgency states: Critical, Due Soon, Upcoming, Completed, Unknown
 * - Real-time countdown & remaining time
 * - Linked itinerary item & provider policy source
 * - Clear, non-technical instructions for what the traveler should do
 */

import {
  AlarmClock, Clock, Hotel, Plane, Car, Ticket, AlertTriangle,
  CheckCircle2, ShieldCheck, HelpCircle, ArrowRight, ExternalLink
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const URGENCY_CONFIG = {
  critical: {
    badge: 'bg-rose-100 text-rose-800 border-rose-200',
    dot: 'bg-rose-500 animate-pulse',
    border: 'border-rose-300 ring-1 ring-rose-200',
    label: 'Critical / Action Required',
    iconColor: 'text-rose-600',
  },
  due_soon: {
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
    border: 'border-amber-300 ring-1 ring-amber-100',
    label: 'Due Soon (< 24h)',
    iconColor: 'text-amber-600',
  },
  upcoming: {
    badge: 'bg-sky-100 text-sky-800 border-sky-200',
    dot: 'bg-sky-500',
    border: 'border-navy/10',
    label: 'Upcoming',
    iconColor: 'text-sky-600',
  },
  completed: {
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-400',
    border: 'border-navy/5 opacity-75',
    label: 'Window Passed / Closed',
    iconColor: 'text-slate-500',
  },
  unknown: {
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-400',
    border: 'border-navy/10',
    label: 'Policy Unknown',
    iconColor: 'text-slate-400',
  },
};

const CATEGORY_ICONS = {
  hotel: Hotel,
  hotel_checkin: Hotel,
  flight: Plane,
  flight_checkin: Plane,
  flight_gate: Plane,
  transfer: Car,
  activity: Ticket,
  other: AlarmClock,
};

export default function DeadlinePolicyCard({
  deadline,
  tripId = null,
  onReview = null,
}) {
  const navigate = useNavigate();
  const urg = URGENCY_CONFIG[deadline.urgency] || URGENCY_CONFIG.unknown;
  const CategoryIcon = CATEGORY_ICONS[deadline.category] || AlarmClock;

  return (
    <div className={`rounded-3xl border bg-white p-5 sm:p-6 shadow-sm transition-all hover:shadow-md ${urg.border}`}>
      {/* Header Badge Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-navy/5 pb-3">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${urg.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${urg.dot}`} />
            {urg.label}
          </span>
          {deadline.isRecalculated && (
            <span className="rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold">
              Recovery Recalculated ✓
            </span>
          )}
        </div>

        <span className="text-xs font-semibold text-ink-faint flex items-center gap-1">
          <CategoryIcon size={13} className={urg.iconColor} />
          <span className="capitalize">{deadline.category.replace('_', ' ')}</span>
        </span>
      </div>

      {/* Main Content */}
      <div className="mt-3.5 space-y-2.5">
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider text-ink-faint block">
            {deadline.actionRequired}
          </span>
          <h3 className="text-base sm:text-lg font-black text-navy mt-0.5">
            {deadline.title}
          </h3>
          <p className="text-xs text-ink-soft font-medium flex items-center gap-1 mt-0.5">
            <span>Linked Booking:</span>
            <strong className="text-navy">{deadline.itemTitle}</strong>
          </p>
        </div>

        {/* Remaining Time Banner */}
        <div className="rounded-2xl bg-slate-50/90 border border-navy/5 p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint block">
              ⏰ Exact Deadline Time
            </span>
            <span className="text-sm font-bold text-navy">
              {deadline.deadlineFormatted}
            </span>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint block">
              Time Remaining
            </span>
            <span className={`text-base font-black tabular-nums ${deadline.urgency === 'critical' ? 'text-rose-600' : 'text-navy'}`}>
              {deadline.remainingText}
            </span>
          </div>
        </div>

        {/* Policy Details Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl bg-periwinkle/40 p-2.5">
            <span className="text-[10px] font-bold uppercase text-ink-faint block">Policy Source</span>
            <span className="font-semibold text-navy block text-[11px] mt-0.5">{deadline.policySource}</span>
            <span className="text-[10px] text-ink-soft block">{deadline.policyType}</span>
          </div>

          <div className="rounded-xl bg-periwinkle/40 p-2.5">
            <span className="text-[10px] font-bold uppercase text-ink-faint block">Terms / Fee Schedule</span>
            <span className="font-semibold text-navy block text-[11px] mt-0.5">{deadline.applicableFee}</span>
            {deadline.potentialRefund && (
              <span className="text-[10px] text-emerald-700 font-bold block">
                Protected Value: ₹{deadline.potentialRefund.toLocaleString('en-IN')}
              </span>
            )}
          </div>
        </div>

        {/* What the traveler should do */}
        <div className="rounded-2xl bg-emerald-50/70 border border-emerald-200/80 p-3 text-xs text-emerald-950 flex items-start gap-2.5">
          <ShieldCheck size={16} className="text-emerald-700 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold text-[11px]">Recommended Traveler Action:</p>
            <p className="text-[11px] leading-relaxed text-emerald-900">{deadline.recommendedAction}</p>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="mt-4 pt-3 border-t border-navy/5 flex items-center justify-between gap-2">
        <button
          onClick={() => {
            if (tripId) {
              navigate(`/app/trip/${tripId}/timeline`);
            } else {
              navigate('/app/trip');
            }
          }}
          className="text-xs font-semibold text-primary hover:text-primary-dark flex items-center gap-1 transition"
        >
          <span>View in Connected Itinerary</span>
          <ArrowRight size={12} />
        </button>

        {onReview && (
          <button
            onClick={() => onReview(deadline)}
            className="btn-primary text-xs py-1.5 px-3.5 shadow-2xs"
          >
            Review Policy
          </button>
        )}
      </div>
    </div>
  );
}
