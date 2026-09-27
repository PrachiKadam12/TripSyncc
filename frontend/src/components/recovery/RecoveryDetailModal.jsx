/**
 * RecoveryDetailModal.jsx — TripSync Stage 13 Recovery Plan Detail View
 * Deep-dive comparison showing:
 * - Original timeline vs Recovery timeline
 * - Status tags: Preserved, Changed, Cancelled, Replacement
 * - OpenRouteService transfer & driving route details
 * - Actions required to execute recovery
 */

import { X, CheckCircle2, AlertTriangle, ArrowRight, Plane, Car, Hotel, Ticket, Clock, ShieldCheck, Sparkles } from 'lucide-react';
import Modal from '../Modal.jsx';

export default function RecoveryDetailModal({
  plan,
  isOpen,
  onClose,
  onSelectPlan,
  isSelected,
}) {
  if (!plan) return null;

  const itemIcons = {
    flight: Plane,
    transfer: Car,
    hotel: Hotel,
    activity: Ticket,
  };

  return (
    <Modal open={isOpen} onClose={onClose} size="lg">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-navy/10 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-slate-100 text-navy px-2.5 py-0.5 text-xs font-black uppercase tracking-wider">
                {plan.strategyTag} Strategy
              </span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold border ${plan.isFeasible ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
                {plan.isFeasible ? 'Feasible Plan' : 'At Risk / Unfeasible'}
              </span>
              <span className="rounded-full bg-indigo-50 text-indigo-800 px-2.5 py-0.5 text-xs font-bold border border-indigo-200">
                Score: {plan.score}/100
              </span>
            </div>
            <h2 className="text-xl font-black text-navy mt-1">{plan.title}</h2>
            <p className="text-xs text-ink-soft mt-0.5">{plan.focus}</p>
          </div>
        </div>

        {/* Highlight Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 rounded-2xl bg-slate-50 p-3.5 border border-navy/5 text-center text-xs">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint block">Final Arrival</span>
            <span className="text-sm font-black text-navy">{plan.destinationArrivalTimeFormatted}</span>
            <span className="text-[10px] text-amber-700 block font-semibold">{plan.timeDelayLabel}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint block">Replacement Cost</span>
            <span className="text-sm font-black text-navy">
              {plan.totalAdditionalCost === 0 ? '₹0 (Free Waiver)' : `+₹${plan.totalAdditionalCost.toLocaleString('en-IN')}`}
            </span>
            <span className="text-[10px] text-ink-faint block">Estimated</span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint block">Estimated Refund</span>
            <span className="text-sm font-black text-emerald-700">
              {plan.estimatedRefund > 0 ? `₹${plan.estimatedRefund.toLocaleString('en-IN')}` : '₹0'}
            </span>
            <span className="text-[10px] text-ink-faint block">{plan.refundStatus || 'Refund eligible'}</span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint block">Net Financial Impact</span>
            <span className={`text-sm font-black ${plan.netFinancialImpact < 0 ? 'text-emerald-700' : 'text-navy'}`}>
              {plan.netFinancialImpactLabel || `+₹${(plan.netFinancialImpact || 0).toLocaleString('en-IN')}`}
            </span>
            <span className="text-[10px] text-emerald-600 block font-semibold">{plan.preservedCount}/{plan.totalItemsCount} Intact</span>
          </div>
        </div>

        {/* Downstream Impact Strip */}
        <div className="rounded-2xl bg-white border border-navy/10 p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">Downstream Commitments:</span>
            <span className="rounded-full bg-emerald-50 text-emerald-800 px-2.5 py-0.5 text-[11px] font-bold border border-emerald-200">
              Transfer: {plan.transferImpact || 'Protected ✓'}
            </span>
            <span className="rounded-full bg-emerald-50 text-emerald-800 px-2.5 py-0.5 text-[11px] font-bold border border-emerald-200">
              Hotel: {plan.hotelImpact || 'Protected ✓'}
            </span>
            {plan.activityImpact && (
              <span className="rounded-full bg-emerald-50 text-emerald-800 px-2.5 py-0.5 text-[11px] font-bold border border-emerald-200">
                Activities: {plan.activityImpact}
              </span>
            )}
          </div>
          <span className="text-[11px] font-semibold text-ink-faint">
            Risk: <strong className="text-navy">{plan.riskLevel || 'Low'}</strong>
          </span>
        </div>

        {/* Timeline Comparison */}
        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-navy">
            Itinerary Sequence Impact
          </h3>

          <div className="divide-y divide-navy/5 rounded-2xl border border-navy/10 overflow-hidden bg-white">
            {plan.itemTimeline.map((item) => {
              const Icon = itemIcons[item.itemType] || Plane;
              const statusStyles = {
                preserved: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                changed: 'bg-amber-50 text-amber-800 border-amber-200',
                cancelled: 'bg-rose-50 text-rose-800 border-rose-200',
                new: 'bg-sky-50 text-sky-800 border-sky-200',
                'at-risk': 'bg-orange-50 text-orange-800 border-orange-200',
              };

              return (
                <div key={item.id} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 text-navy">
                      <Icon size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-navy truncate">{item.title}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold border ${statusStyles[item.status] || 'bg-slate-100 text-slate-700'}`}>
                          {item.statusLabel}
                        </span>
                      </div>
                      <p className="text-[11px] text-ink-soft mt-0.5">{item.note}</p>
                    </div>
                  </div>

                  <span className="text-xs font-black text-navy shrink-0">
                    {item.timeLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Why this works & Actions required */}
        <div className="grid sm:grid-cols-2 gap-4 text-xs">
          <div className="rounded-2xl bg-emerald-50/50 border border-emerald-100 p-4 space-y-2">
            <h4 className="font-bold text-emerald-900 flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-emerald-700" />
              Why this works
            </h4>
            <ul className="space-y-1 text-emerald-950 text-[11px]">
              {plan.whyItWorks.map((w, idx) => (
                <li key={idx} className="flex items-start gap-1">
                  <span>•</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl bg-slate-50 border border-navy/5 p-4 space-y-2">
            <h4 className="font-bold text-navy flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-primary" />
              Required Actions
            </h4>
            <ul className="space-y-1 text-ink-soft text-[11px]">
              {plan.actions.map((act, idx) => (
                <li key={idx} className="flex items-start gap-1">
                  <span>{idx + 1}.</span>
                  <span>{act}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Notice on Availability */}
        <div className="text-[11px] text-ink-faint text-center">
          {plan.availabilityNotice} · Final confirmation will occur upon applying this plan.
        </div>

        {/* Modal CTAs */}
        <div className="pt-2 flex items-center justify-end gap-2 border-t border-navy/5">
          <button onClick={onClose} className="btn-secondary text-xs py-2 px-4">
            Close
          </button>
          <button
            onClick={() => {
              onSelectPlan(plan);
              onClose();
            }}
            className={`btn-primary text-xs py-2 px-5 ${
              isSelected ? 'bg-emerald-600 hover:bg-emerald-700' : ''
            }`}
          >
            {isSelected ? 'Plan Selected' : 'Choose This Plan'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
