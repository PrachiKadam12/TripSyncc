/**
 * Stage13RecoveryCard.jsx — TripSync Stage 13 Recovery Plan Card
 * Displays a normalized recovery strategy with:
 * - Strategy Tag ("Fastest", "Lowest Cost", "Most Itinerary Preserved")
 * - Feasibility & Explainable Recovery Score (0–100)
 * - Arrival timing & time saved/delay
 * - Estimated additional cost with confirmation notice
 * - Itinerary preservation counter (e.g. 4/5 items preserved)
 * - "Why this works" checklist & "Trade-offs"
 * - Actions: "View Plan" and "Choose This Plan"
 */

import { CheckCircle2, AlertTriangle, Clock, ArrowRight, ShieldCheck, Sparkles, ChevronRight, HelpCircle } from 'lucide-react';
import { useState } from 'react';

export default function Stage13RecoveryCard({
  plan,
  isSelected = false,
  onSelect,
  onViewDetails,
  onApply,
}) {
  const [showScoreInfo, setShowScoreInfo] = useState(false);

  const tagColors = {
    'Fastest': 'bg-emerald-100 text-emerald-800 border-emerald-200',
    'Lowest Cost': 'bg-sky-100 text-sky-800 border-sky-200',
    'Most Itinerary Preserved': 'bg-indigo-100 text-indigo-800 border-indigo-200',
  };

  const tagClass = tagColors[plan.strategyTag] || 'bg-slate-100 text-navy border-slate-200';

  return (
    <div
      className={`rounded-3xl border transition-all duration-200 bg-white flex flex-col justify-between overflow-hidden shadow-xs ${
        isSelected
          ? 'border-primary ring-2 ring-primary/20 shadow-md'
          : 'border-navy/10 hover:border-navy/20 hover:shadow-sm'
      }`}
    >
      <div className="p-5 sm:p-6 space-y-4">
        {/* Top Header: Strategy Tag & Score */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider border ${tagClass}`}>
              {plan.strategyTag}
            </span>
            {plan.isFeasible ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-0.5 text-[11px] font-bold border border-emerald-200">
              <CheckCircle2 size={12} />
              Feasible
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 text-rose-700 px-2.5 py-0.5 text-[11px] font-bold border border-rose-200">
              <AlertTriangle size={12} />
              At Risk / Unfeasible
            </span>
          )}
          </div>

          {/* Recovery Score */}
          <div className="relative">
            <button
              onClick={() => setShowScoreInfo((v) => !v)}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 hover:bg-slate-200 text-navy px-2.5 py-1 text-xs font-black transition cursor-pointer"
              title="Click to view score breakdown"
            >
              <span>Score: {plan.score}/100</span>
              <HelpCircle size={11} className="text-ink-faint" />
            </button>

            {/* Score Breakdown Popover */}
            {showScoreInfo && plan.scoreBreakdown && (
              <div className="absolute right-0 top-8 z-30 w-56 rounded-2xl border border-navy/10 bg-white p-3 shadow-lg text-[11px] text-ink-soft space-y-1.5 animate-in fade-in zoom-in-95">
                <p className="font-bold text-navy text-xs border-b border-navy/5 pb-1">
                  Transparent Score Breakdown
                </p>
                <div className="flex justify-between">
                  <span>Time Preservation:</span>
                  <span className="font-bold text-navy">{plan.scoreBreakdown.timePreservation}/30</span>
                </div>
                <div className="flex justify-between">
                  <span>Itinerary Preserved:</span>
                  <span className="font-bold text-navy">{plan.scoreBreakdown.itineraryPreservation}/30</span>
                </div>
                <div className="flex justify-between">
                  <span>Feasibility:</span>
                  <span className="font-bold text-navy">{plan.scoreBreakdown.feasibility}/20</span>
                </div>
                <div className="flex justify-between">
                  <span>Cost Efficiency:</span>
                  <span className="font-bold text-navy">{plan.scoreBreakdown.costComponent}/10</span>
                </div>
                <div className="flex justify-between">
                  <span>Risk Margin:</span>
                  <span className="font-bold text-navy">{plan.scoreBreakdown.riskComponent}/10</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Plan Title & Replacement Segment */}
        <div>
          <h3 className="text-base sm:text-lg font-black text-navy">{plan.title}</h3>
          <p className="text-xs text-ink-soft mt-0.5 line-clamp-1">{plan.focus}</p>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-2.5 rounded-2xl bg-slate-50/80 p-3 border border-navy/5 text-xs">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint block">
              Destination Arrival
            </span>
            <span className="font-black text-navy text-sm">
              {plan.destinationArrivalTimeFormatted}
            </span>
            <span className="text-[10px] text-amber-700 block font-medium">
              Delay: {plan.timeDelayLabel}
            </span>
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint block">
              Replacement Cost
            </span>
            <span className="font-black text-navy text-sm">
              {plan.totalAdditionalCost === 0 ? '₹0 (Free Waiver)' : `+₹${plan.totalAdditionalCost.toLocaleString('en-IN')}`}
            </span>
            <span className="text-[10px] text-ink-faint block truncate">
              {plan.availabilityStatus || 'Estimated'} · {plan.dataSource || 'Carrier rules'}
            </span>
          </div>

          <div className="col-span-2 pt-2 border-t border-navy/5 grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint block">
                Estimated Refund
              </span>
              <span className="font-bold text-navy text-xs">
                {plan.estimatedRefund > 0 ? `₹${plan.estimatedRefund.toLocaleString('en-IN')}` : '₹0'}
              </span>
              <span className="text-[10px] text-emerald-700 block font-medium">
                {plan.refundStatus || 'Refund eligible'}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint block">
                Net Financial Impact
              </span>
              <span className={`font-black text-xs ${plan.netFinancialImpact < 0 ? 'text-emerald-700' : 'text-navy'}`}>
                {plan.netFinancialImpactLabel || `+₹${(plan.netFinancialImpact || 0).toLocaleString('en-IN')}`}
              </span>
              <span className="text-[10px] text-ink-faint block">
                Estimated planning figure
              </span>
            </div>
          </div>

          {/* Downstream Protection Badges */}
          <div className="col-span-2 pt-2 border-t border-navy/5 flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="text-[10px] font-bold uppercase text-ink-faint mr-1">Protected:</span>
            <span className="rounded-md bg-white px-2 py-0.5 border border-slate-200 text-slate-700 font-medium">
              Transfer: <strong className="text-navy">{plan.transferImpact || 'Protected ✓'}</strong>
            </span>
            <span className="rounded-md bg-white px-2 py-0.5 border border-slate-200 text-slate-700 font-medium">
              Hotel: <strong className="text-navy">{plan.hotelImpact || 'Protected ✓'}</strong>
            </span>
            {plan.activityImpact && (
              <span className="rounded-md bg-white px-2 py-0.5 border border-slate-200 text-slate-700 font-medium">
                Activities: <strong className="text-navy">{plan.activityImpact}</strong>
              </span>
            )}
          </div>

          <div className="col-span-2 pt-1 border-t border-navy/5 flex items-center justify-between">
            <span className="text-[11px] text-ink-soft">
              Itinerary Preserved:
            </span>
            <span className="font-bold text-emerald-700 text-xs">
              {plan.preservedCount} / {plan.totalItemsCount} bookings intact
            </span>
          </div>
        </div>

        {/* AI Notice / Explanation if available */}
        {plan.aiExplanation && (
          <div className="rounded-xl bg-indigo-50/60 border border-indigo-100/80 p-2.5 flex items-start gap-2 text-xs text-indigo-900">
            <Sparkles size={13} className="text-indigo-600 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed line-clamp-2">{plan.aiExplanation}</p>
          </div>
        )}

        {/* Why This Works (Checklist) */}
        <div className="space-y-1.5 pt-1">
          <p className="text-[10px] font-black uppercase tracking-wider text-ink-faint">Why this works</p>
          <ul className="space-y-1 text-xs">
            {plan.whyItWorks.slice(0, 3).map((item, i) => (
              <li key={i} className="flex items-start gap-1.5 text-navy/90 text-[11px]">
                <CheckCircle2 size={12} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Trade-offs */}
        {plan.tradeoffs.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <p className="text-[10px] font-black uppercase tracking-wider text-ink-faint">Key Trade-offs</p>
            <ul className="space-y-1 text-xs">
              {plan.tradeoffs.slice(0, 2).map((item, i) => (
                <li key={i} className="flex items-start gap-1.5 text-ink-soft text-[11px]">
                  <AlertTriangle size={12} className="text-amber-600 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Card Actions Footer */}
      <div className="p-4 sm:p-5 pt-0 border-t border-navy/5 flex items-center gap-2">
        <button
          onClick={() => onViewDetails(plan)}
          className="btn-secondary text-xs flex-1 py-2 flex items-center justify-center gap-1 hover:bg-slate-50"
        >
          <span>View Plan Details</span>
          <ChevronRight size={13} />
        </button>

        <button
          onClick={() => {
            if (isSelected && onApply) {
              onApply(plan);
            } else {
              onSelect(plan);
            }
          }}
          className={`btn-primary text-xs py-2 px-3.5 transition flex items-center gap-1 ${
            isSelected ? 'bg-emerald-600 hover:bg-emerald-700 ring-2 ring-emerald-300' : ''
          }`}
        >
          <span>{isSelected ? 'Apply Plan →' : 'Choose Plan'}</span>
        </button>
      </div>
    </div>
  );
}
