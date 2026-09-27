/**
 * RecoveryAiExplanationCard.jsx — TripSync Stage 17 AI Explanation Component
 * Provides a traveler-friendly natural language explanation of WHY the selected
 * recovery plan makes sense based strictly on deterministic application data.
 *
 * CRITICAL RULE: Gemini is ONLY an explanation layer. Authoritative numbers
 * (costs, timings, refunds, feasibility) are ALWAYS deterministic.
 */

import { useState, useEffect } from 'react';
import { Sparkles, CheckCircle2, AlertTriangle, ShieldCheck, WifiOff, RefreshCw, Info, DollarSign } from 'lucide-react';
import { generateGeminiContent } from '../../services/geminiService.js';

export default function RecoveryAiExplanationCard({
  plan,
  disruption = null,
  className = '',
}) {
  const [aiText, setAiText] = useState(plan?.aiExplanation || '');
  const [loading, setLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);

  // Sync online status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch or refresh Gemini AI explanation with deterministic facts
  const fetchAiExplanation = async () => {
    if (!plan) return;
    if (isOffline) {
      setAiText(getDeterministicFallback());
      return;
    }

    setLoading(true);
    try {
      const prompt = `You are the TripSync travel recovery assistant. In 2-3 clear traveler-friendly sentences, explain WHY the chosen recovery plan (${plan.title} - ${plan.strategyTag} strategy) makes sense for this disrupted journey.
Strict Deterministic Facts:
- Final Destination Arrival: ${plan.destinationArrivalTimeFormatted} (${plan.timeDelayLabel} delay)
- Replacement Cost: ₹${plan.totalAdditionalCost.toLocaleString('en-IN')}
- Estimated Refund: ₹${plan.estimatedRefund.toLocaleString('en-IN')} (${plan.refundStatus})
- Net Financial Impact: ${plan.netFinancialImpactLabel}
- Downstream Protection: Transfer (${plan.transferImpact}), Hotel (${plan.hotelImpact}), Activities (${plan.activityImpact})
- Preserved Bookings: ${plan.preservedCount} of ${plan.totalItemsCount}
- Why: ${plan.whyItWorks.join('. ')}
- Trade-offs: ${plan.tradeoffs.join('. ')}

Rules: Do NOT invent prices, arrival times, or refund amounts. Only use the facts above. Be clear, reassuring, and concise.`;

      const res = await generateGeminiContent(prompt);
      if (res && res.trim()) {
        setAiText(res.trim());
      } else {
        setAiText(getDeterministicFallback());
      }
    } catch (_) {
      // Graceful fallback to deterministic explanation
      setAiText(getDeterministicFallback());
    } finally {
      setLoading(false);
    }
  };

  const getDeterministicFallback = () => {
    if (!plan) return '';
    const mainWhy = plan.whyItWorks?.[0] || 'Safeguards your downstream hotel and connections';
    const mainTradeoff = plan.tradeoffs?.[0] || 'Requires accepting transport schedule change';
    return `${mainWhy} while limiting additional transit delay to ${plan.timeDelayLabel}. Note that this ${mainTradeoff.toLowerCase()}.`;
  };

  useEffect(() => {
    if (plan && !aiText) {
      fetchAiExplanation();
    }
  }, [plan?.id]);

  if (!plan) return null;

  return (
    <div className={`rounded-3xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/50 via-white to-sky-50/30 p-5 sm:p-6 shadow-xs space-y-4 ${className}`}>
      {/* Card Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
            <Sparkles size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700">
                Stage 17 Intelligence
              </span>
              <span className="rounded-full bg-indigo-100 text-indigo-800 px-2 py-0.5 text-[10px] font-bold">
                TripSync AI Explanation
              </span>
              {isOffline && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-semibold">
                  <WifiOff size={10} /> Offline Mode
                </span>
              )}
            </div>
            <h3 className="text-sm sm:text-base font-extrabold text-navy">
              Why this {plan.strategyTag} option works for you
            </h3>
          </div>
        </div>

        <button
          onClick={fetchAiExplanation}
          disabled={loading}
          className="btn-secondary text-[11px] py-1.5 px-2.5 flex items-center gap-1 text-indigo-700 border-indigo-200 hover:bg-indigo-50"
          title="Regenerate explanation"
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
          <span>{loading ? 'Analyzing...' : 'Refresh Explanation'}</span>
        </button>
      </div>

      {/* AI Narrative Box */}
      <div className="rounded-2xl bg-white border border-indigo-100/90 p-4 text-xs sm:text-sm text-navy/90 leading-relaxed shadow-2xs">
        {loading ? (
          <p className="text-ink-soft animate-pulse text-xs">
            Synthesizing deterministic itinerary facts and downstream connection windows...
          </p>
        ) : (
          <p className="font-medium text-navy">
            "{aiText || getDeterministicFallback()}"
          </p>
        )}
      </div>

      {/* Deterministic Explanation Breakdown Grid */}
      <div className="grid sm:grid-cols-2 gap-3 text-xs">
        {/* WHY THIS PLAN */}
        <div className="rounded-2xl bg-emerald-50/60 border border-emerald-200/80 p-3.5 space-y-2">
          <h4 className="font-bold text-emerald-900 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
            <CheckCircle2 size={13} className="text-emerald-700 shrink-0" />
            Why This Plan
          </h4>
          <ul className="space-y-1 text-[11px] text-emerald-950">
            {plan.whyItWorks?.map((w, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <span className="text-emerald-600 font-bold">•</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* TRADE-OFFS */}
        <div className="rounded-2xl bg-amber-50/60 border border-amber-200/80 p-3.5 space-y-2">
          <h4 className="font-bold text-amber-900 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
            <AlertTriangle size={13} className="text-amber-700 shrink-0" />
            Key Trade-offs
          </h4>
          <ul className="space-y-1 text-[11px] text-amber-950">
            {plan.tradeoffs?.map((t, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <span className="text-amber-600 font-bold">•</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Financial & Risk Summary Matrix */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 rounded-2xl bg-slate-50 border border-navy/5 p-3 text-center text-xs">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint block">Original Booking</span>
          <span className="font-black text-navy text-xs sm:text-sm">
            ₹{Number(plan.originalBookingCost || 3200).toLocaleString('en-IN')}
          </span>
          <span className="text-[10px] text-ink-faint block">Disrupted item</span>
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint block">Estimated Refund</span>
          <span className="font-black text-emerald-700 text-xs sm:text-sm">
            {plan.estimatedRefund > 0 ? `₹${plan.estimatedRefund.toLocaleString('en-IN')}` : '₹0'}
          </span>
          <span className="text-[10px] text-ink-faint block truncate">{plan.refundStatus || 'Refund eligible'}</span>
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint block">Replacement Cost</span>
          <span className="font-black text-navy text-xs sm:text-sm">
            {plan.totalAdditionalCost === 0 ? '₹0 (Free Waiver)' : `+₹${plan.totalAdditionalCost.toLocaleString('en-IN')}`}
          </span>
          <span className="text-[10px] text-ink-faint block">Estimated</span>
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint block">Net Financial Impact</span>
          <span className={`font-black text-xs sm:text-sm ${plan.netFinancialImpact < 0 ? 'text-emerald-700' : 'text-navy'}`}>
            {plan.netFinancialImpactLabel || `+₹${(plan.netFinancialImpact || 0).toLocaleString('en-IN')}`}
          </span>
          <span className="text-[10px] text-emerald-700 block font-semibold">
            Risk: {plan.riskLevel || 'Low'}
          </span>
        </div>
      </div>

      {/* Non-Authoritative AI Notice */}
      <div className="flex items-center gap-1.5 text-[10px] text-ink-faint pt-1">
        <Info size={11} className="shrink-0 text-primary" />
        <span>Authoritative numbers and feasibility criteria are calculated deterministically. TripSync AI provides conversational summaries.</span>
      </div>
    </div>
  );
}
