/**
 * TravelAlertsAndActions.jsx — Combined Stage 21 + 22 Traveler Action Center
 * 
 * Unifies Critical Deadlines and Live Weather Advisories into one clear,
 * actionable view answering:
 * - WHAT is happening
 * - WHEN action is required
 * - WHICH itinerary item is affected
 * - WHY it matters
 * - WHAT the traveler can do
 */

import { AlertTriangle, Clock, CloudRain, ShieldCheck, ArrowRight, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TravelAlertsAndActions({
  deadlines = [],
  weatherAlerts = [],
  tripId = null,
}) {
  const navigate = useNavigate();

  const urgentDeadlines = deadlines.filter((d) => d.urgency === 'critical' || d.urgency === 'due_soon');
  const hasItems = urgentDeadlines.length > 0 || weatherAlerts.length > 0;

  if (!hasItems) {
    return (
      <div className="rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/70 via-white to-sky-50/50 p-6 sm:p-7 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-navy">All Deadlines & Weather Stable</h3>
            <p className="text-xs text-ink-soft mt-0.5">
              No immediate policy deadlines or adverse weather conditions require urgent traveler action.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-navy/10 bg-gradient-to-br from-white via-periwinkle/30 to-slate-50 p-5 sm:p-7 space-y-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy/5 pb-4">
        <div>
          <span className="rounded-full bg-rose-100 text-rose-800 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider">
            Travel Alerts & Actions
          </span>
          <h2 className="text-lg sm:text-xl font-black text-navy mt-1">
            Immediate Actions & Journey Advisories
          </h2>
        </div>

        <span className="text-xs font-bold text-ink-soft">
          {urgentDeadlines.length} Action{urgentDeadlines.length === 1 ? '' : 's'} · {weatherAlerts.length} Weather Alert{weatherAlerts.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Urgent Deadlines Column */}
        {urgentDeadlines.map((dl) => (
          <div
            key={dl.id}
            className={`rounded-2xl border p-4.5 space-y-3 bg-white shadow-xs ${
              dl.urgency === 'critical' ? 'border-rose-300 ring-1 ring-rose-100' : 'border-amber-300 ring-1 ring-amber-50'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                dl.urgency === 'critical' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
              }`}>
                <AlertTriangle size={11} />
                <span>ACTION REQUIRED</span>
              </span>

              <span className="text-xs font-black tabular-nums text-rose-600">
                ⏰ {dl.remainingText}
              </span>
            </div>

            <div>
              <h4 className="text-sm font-extrabold text-navy">{dl.title}</h4>
              <p className="text-xs text-ink-soft mt-0.5">
                Affects: <strong className="text-navy">{dl.itemTitle}</strong>
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 border border-navy/5 p-2.5 text-xs text-ink-soft space-y-1">
              <div className="flex justify-between">
                <span className="font-semibold text-navy">Why it matters:</span>
                <span className="text-ink-soft">{dl.policyType}</span>
              </div>
              <p className="text-[11px] text-emerald-950 bg-emerald-50/90 rounded-lg p-2 font-medium">
                👉 <strong>What to do:</strong> {dl.recommendedAction}
              </p>
            </div>
          </div>
        ))}

        {/* Live Weather Advisories Column */}
        {weatherAlerts.map((wa) => (
          <div
            key={wa.id}
            className="rounded-2xl border border-sky-200 p-4.5 space-y-3 bg-white shadow-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 text-sky-800 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider">
                <CloudRain size={11} />
                <span>WEATHER ADVISORY</span>
              </span>

              <span className="text-xs font-bold text-navy">
                {wa.location} ({wa.temperature}°C)
              </span>
            </div>

            <div>
              <h4 className="text-sm font-extrabold text-navy">{wa.title}</h4>
              <p className="text-xs text-ink-soft mt-0.5">
                Affects: <strong className="text-navy">{wa.associatedItemTitle || wa.location}</strong>
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 border border-navy/5 p-2.5 text-xs text-ink-soft space-y-1">
              <p className="text-[11px] leading-relaxed">{wa.message}</p>
              <p className="text-[11px] text-amber-950 bg-amber-50/90 rounded-lg p-2 font-medium">
                👉 <strong>Advisory:</strong> {wa.actionAdvice}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
