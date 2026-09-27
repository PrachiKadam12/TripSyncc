/**
 * RecoveryComparePage.jsx — TripSync Stage 16 Plan Comparison Page
 * Route: /app/trip/:tripId/recovery/compare
 * Compares Stage 13 recovery plans side-by-side on desktop (stacked on mobile).
 * Shows Time, Cost, Preservation, Feasibility, Risk, and Downstream Impacts.
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, CheckCircle2, AlertTriangle, ShieldCheck,
  Sparkles, Clock, RefreshCw, HelpCircle, Layers, ChevronRight, Eye, Check
} from 'lucide-react';
import { fetchTripItineraryData, buildConnectedItinerary } from '../../services/itineraryService.js';
import { generateRecoveryPlans } from '../../services/recoveryService.js';
import { useTrip } from '../../context/TripContext.jsx';
import RecoveryDetailModal from '../../components/recovery/RecoveryDetailModal.jsx';

export default function RecoveryComparePage() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { activeTripId, dispatch } = useTrip();

  const currentTripId = tripId || location.state?.tripId || activeTripId || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

  const [loading, setLoading] = useState(!location.state?.plans);
  const [plans, setPlans] = useState(location.state?.plans || []);
  const [disruption, setDisruption] = useState(location.state?.disruption || null);
  const [selectedPlanId, setSelectedPlanId] = useState(location.state?.selectedPlanId || location.state?.plans?.[0]?.id || null);
  const [activeModalPlan, setActiveModalPlan] = useState(null);
  const [error, setError] = useState('');

  // If plans were not passed in state, load them using the existing Stage 13 recovery engine
  useEffect(() => {
    if (plans.length > 0) {
      if (!selectedPlanId && plans[0]?.id) {
        setSelectedPlanId(plans[0].id);
      }
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        const rawData = await fetchTripItineraryData(currentTripId);
        const built = buildConnectedItinerary(rawData);

        const targetDisruption = location.state?.disruption || (rawData.disruptions || []).find(
          (d) => !d.resolved_at && d.metadata?.status !== 'resolved'
        );

        if (!targetDisruption) {
          setError('No active disruption found to compare plans for.');
          setLoading(false);
          return;
        }

        setDisruption(targetDisruption);

        const res = await generateRecoveryPlans({
          disruption: targetDisruption,
          allItems: built.allItems || [],
          trip: rawData.trip,
          bookings: rawData.bookings || [],
          dependencies: rawData.dependencies || [],
        });

        setPlans(res.plans || []);
        if (res.plans && res.plans.length > 0) {
          setSelectedPlanId(res.plans[0].id);
        }
      } catch (err) {
        console.error('Failed to load plans for comparison:', err);
        setError(err.message || 'Could not load recovery plans for comparison.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentTripId]);

  const handleSelectPlan = (plan) => {
    setSelectedPlanId(plan.id);
    if (dispatch) {
      dispatch({ type: 'SELECT_PLAN', planId: plan.id });
    }
  };

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) || plans[0];

  const handleProceedToConfirm = () => {
    if (!selectedPlan) return;
    navigate(currentTripId ? `/app/trip/${currentTripId}/recovery/confirm` : '/app/recovery/confirm', {
      state: {
        tripId: currentTripId,
        selectedPlan,
        plans,
        disruption,
      },
    });
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center space-y-3">
        <RefreshCw size={32} className="animate-spin text-primary mx-auto" />
        <p className="text-sm font-bold text-navy">Loading Comparison Matrix...</p>
        <p className="text-xs text-ink-faint">Evaluating trade-offs across time, costs, and downstream bookings.</p>
      </div>
    );
  }

  if (error || plans.length === 0) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
          <AlertTriangle size={24} />
        </div>
        <h2 className="text-lg font-bold text-navy">Comparison Unavailable</h2>
        <p className="text-xs text-ink-soft leading-relaxed">{error || 'No recovery plans available to compare.'}</p>
        <div className="pt-2 flex justify-center gap-3">
          <button
            className="btn-primary text-xs"
            onClick={() => navigate(currentTripId ? `/app/trip/${currentTripId}/recovery` : '/app/recovery')}
          >
            Back to Recovery Center
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-16 space-y-6">
      {/* Top Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => navigate(currentTripId ? `/app/trip/${currentTripId}/recovery` : '/app/recovery', {
            state: { tripId: currentTripId, plans, disruption, selectedPlanId }
          })}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-navy px-3 py-1.5 rounded-xl hover:bg-white transition shadow-2xs"
        >
          <ArrowLeft size={14} /> Back to Recovery Plans
        </button>

        <button
          onClick={handleProceedToConfirm}
          className="btn-primary text-xs py-2 px-5 flex items-center gap-1.5 shadow-sm"
        >
          <span>Review & Apply Plan</span>
          <ArrowRight size={13} />
        </button>
      </div>

      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-black uppercase tracking-wider">
            Stage 16 Plan Comparison
          </span>
          <span className="text-xs text-ink-faint">Multi-Strategy Evaluation</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-navy mt-1">Compare Recovery Plans</h1>
        <p className="text-xs sm:text-sm text-ink-soft mt-1">
          Compare time, cost, risk and itinerary impact before choosing your recovery path.
        </p>
      </div>

      {/* Selected Strategy Banner */}
      {selectedPlan && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <Sparkles size={16} className="text-primary" />
            <div>
              <span className="font-bold text-navy">Currently Selected: </span>
              <span className="font-extrabold text-primary">{selectedPlan.title} ({selectedPlan.strategyTag})</span>
              <span className="text-ink-soft ml-2">
                — Arrives {selectedPlan.destinationArrivalTimeFormatted} ({selectedPlan.timeDelayLabel}) • Net Impact: {selectedPlan.netFinancialImpactLabel}
              </span>
            </div>
          </div>
          <button
            onClick={handleProceedToConfirm}
            className="btn-primary text-xs py-1.5 px-4 shadow-2xs"
          >
            Continue with this Plan →
          </button>
        </div>
      )}

      {/* ── Side-by-Side (Desktop) / Stacked (Mobile) Plan Comparison Cards ── */}
      <div className="grid gap-5 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = plan.id === selectedPlanId;
          const tagColors = {
            'Fastest': 'bg-emerald-100 text-emerald-800 border-emerald-200',
            'Lowest Cost': 'bg-sky-100 text-sky-800 border-sky-200',
            'Most Itinerary Preserved': 'bg-indigo-100 text-indigo-800 border-indigo-200',
          };

          return (
            <div
              key={plan.id}
              className={`rounded-3xl border transition-all duration-200 bg-white flex flex-col justify-between overflow-hidden ${
                isCurrent
                  ? 'border-primary ring-2 ring-primary/25 shadow-md'
                  : 'border-navy/10 hover:border-navy/20 shadow-2xs'
              }`}
            >
              <div className="p-5 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider border ${tagColors[plan.strategyTag] || 'bg-slate-100 text-navy'}`}>
                    {plan.strategyTag}
                  </span>
                  <span className="rounded-full bg-slate-100 text-navy px-2.5 py-0.5 text-xs font-bold">
                    Score: {plan.score}/100
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-black text-navy">{plan.title}</h3>
                  <p className="text-xs text-ink-soft mt-0.5 line-clamp-2">{plan.focus}</p>
                </div>

                {/* 1. TIME IMPACT */}
                <div className="rounded-2xl bg-slate-50 p-3 border border-navy/5 space-y-1.5 text-xs">
                  <span className="text-[10px] font-black uppercase tracking-wider text-ink-faint flex items-center gap-1">
                    <Clock size={11} className="text-primary" /> Time & Arrival
                  </span>
                  <div className="flex justify-between items-baseline">
                    <span className="text-ink-soft">Destination Arrival:</span>
                    <span className="font-extrabold text-navy text-sm">{plan.destinationArrivalTimeFormatted}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-soft">Additional Delay:</span>
                    <span className="font-bold text-amber-700">{plan.timeDelayLabel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-soft">Departure Time:</span>
                    <span className="font-medium text-navy">{plan.departureTimeFormatted}</span>
                  </div>
                </div>

                {/* 2. COST & REFUND */}
                <div className="rounded-2xl bg-slate-50 p-3 border border-navy/5 space-y-1.5 text-xs">
                  <span className="text-[10px] font-black uppercase tracking-wider text-ink-faint">
                    Financial Impact
                  </span>
                  <div className="flex justify-between">
                    <span className="text-ink-soft">Replacement Cost:</span>
                    <span className="font-bold text-navy">
                      {plan.totalAdditionalCost === 0 ? '₹0 (Waiver)' : `+₹${plan.totalAdditionalCost.toLocaleString('en-IN')}`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-soft">Estimated Refund:</span>
                    <span className="font-bold text-emerald-700">
                      {plan.estimatedRefund > 0 ? `₹${plan.estimatedRefund.toLocaleString('en-IN')}` : '₹0'}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-navy/5">
                    <span className="font-bold text-navy">Net Financial Impact:</span>
                    <span className={`font-black ${plan.netFinancialImpact < 0 ? 'text-emerald-700' : 'text-navy'}`}>
                      {plan.netFinancialImpactLabel}
                    </span>
                  </div>
                </div>

                {/* 3. PRESERVATION & FEASIBILITY */}
                <div className="rounded-2xl bg-slate-50 p-3 border border-navy/5 space-y-1.5 text-xs">
                  <span className="text-[10px] font-black uppercase tracking-wider text-ink-faint">
                    Itinerary & Feasibility
                  </span>
                  <div className="flex justify-between">
                    <span className="text-ink-soft">Bookings Preserved:</span>
                    <span className="font-bold text-emerald-700">{plan.preservedCount} / {plan.totalItemsCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-soft">Connection Buffer:</span>
                    <span className="font-medium text-navy">{plan.isFeasible ? 'Adequate (45m)' : 'Tight buffer'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-soft">Risk Level:</span>
                    <span className="font-bold text-navy">{plan.riskLevel || 'Low'}</span>
                  </div>
                </div>

                {/* 4. DOWNSTREAM PROTECTION TAGS */}
                <div className="space-y-1 text-xs">
                  <span className="text-[10px] font-black uppercase tracking-wider text-ink-faint block">
                    Downstream Bookings
                  </span>
                  <div className="flex flex-wrap gap-1 text-[11px]">
                    <span className="rounded-lg bg-emerald-50 text-emerald-800 px-2 py-0.5 border border-emerald-200 font-medium">
                      Transfer: {plan.transferImpact}
                    </span>
                    <span className="rounded-lg bg-emerald-50 text-emerald-800 px-2 py-0.5 border border-emerald-200 font-medium">
                      Hotel: {plan.hotelImpact}
                    </span>
                    {plan.activityImpact && (
                      <span className="rounded-lg bg-emerald-50 text-emerald-800 px-2 py-0.5 border border-emerald-200 font-medium">
                        Activities: {plan.activityImpact}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="p-4 border-t border-navy/5 bg-slate-50/50 flex items-center gap-2">
                <button
                  onClick={() => setActiveModalPlan(plan)}
                  className="btn-secondary text-xs flex-1 py-2 flex items-center justify-center gap-1 hover:bg-white"
                >
                  <Eye size={12} />
                  <span>View Details</span>
                </button>

                <button
                  onClick={() => handleSelectPlan(plan)}
                  className={`btn-primary text-xs py-2 px-3.5 flex items-center gap-1 ${
                    isCurrent ? 'bg-emerald-600 hover:bg-emerald-700' : ''
                  }`}
                >
                  {isCurrent ? (
                    <>
                      <Check size={12} />
                      <span>Selected</span>
                    </>
                  ) : (
                    <span>Select Plan</span>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Sticky Action Bar */}
      <div className="rounded-2xl border border-navy/10 bg-white p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold text-navy">
            Ready to proceed with {selectedPlan?.strategyTag || 'selected'} recovery plan?
          </p>
          <p className="text-[11px] text-ink-soft">
            You will review the exact before/after itinerary diff and financial breakdown in the next step.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(currentTripId ? `/app/trip/${currentTripId}/recovery` : '/app/recovery')}
            className="btn-secondary text-xs py-2 px-4"
          >
            Back
          </button>
          <button
            onClick={handleProceedToConfirm}
            className="btn-primary text-xs py-2.5 px-6 flex items-center gap-1.5 shadow-sm"
          >
            <span>Proceed to Review & Apply</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Plan Detail Deep-Dive Modal */}
      <RecoveryDetailModal
        plan={activeModalPlan}
        isOpen={Boolean(activeModalPlan)}
        onClose={() => setActiveModalPlan(null)}
        onSelectPlan={handleSelectPlan}
        isSelected={selectedPlanId === activeModalPlan?.id}
      />
    </div>
  );
}
