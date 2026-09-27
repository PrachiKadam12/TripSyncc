/**
 * RecoveryConfirmApplyPage.jsx — TripSync Stage 18 Confirm & Apply Recovery Plan
 * Route: /app/trip/:tripId/recovery/confirm
 * Shows:
 * - Stage 17 AI Explanation Card
 * - Before / After Itinerary Sequence Comparison (UNCHANGED, PROTECTED, CHANGED, REPLACED, CANCELLED)
 * - Transparent Financial Impact Breakdown
 * - Mandatory confirmation checkbox
 * - Application execution with validation, history preservation, and duplicate prevention
 * - Success state with transparent external booking notice
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, AlertTriangle, ShieldCheck, Sparkles,
  Clock, Check, RefreshCw, AlertCircle, Info, Plane, Car, Hotel,
  Ticket, ArrowRight, ExternalLink
} from 'lucide-react';
import { fetchTripItineraryData, buildConnectedItinerary } from '../../services/itineraryService.js';
import { generateRecoveryPlans, applyRecoveryPlanToTrip } from '../../services/recoveryService.js';
import { useTrip } from '../../context/TripContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import RecoveryAiExplanationCard from '../../components/recovery/RecoveryAiExplanationCard.jsx';
import StatusChip from '../../components/StatusChip.jsx';

export default function RecoveryConfirmApplyPage() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { activeTripId, dispatch, setActiveTrip } = useTrip();

  const currentTripId = tripId || location.state?.tripId || activeTripId || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

  const [loading, setLoading] = useState(!location.state?.selectedPlan);
  const [selectedPlan, setSelectedPlan] = useState(location.state?.selectedPlan || null);
  const [disruption, setDisruption] = useState(location.state?.disruption || null);
  const [allItems, setAllItems] = useState([]);
  const [tripSummary, setTripSummary] = useState(null);
  const [confirmedCheckbox, setConfirmedCheckbox] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isApplied, setIsApplied] = useState(false);
  const [appliedDetails, setAppliedDetails] = useState(null);
  const [error, setError] = useState('');

  // Load context if navigated directly
  useEffect(() => {
    const loadData = async () => {
      if (selectedPlan && allItems.length > 0) return;
      setLoading(true);
      setError('');
      try {
        const rawData = await fetchTripItineraryData(currentTripId);
        const built = buildConnectedItinerary(rawData);
        setAllItems(built.allItems || []);
        setTripSummary(built.tripSummary);

        const targetDisruption = disruption || (rawData.disruptions || []).find(
          (d) => !d.resolved_at && d.metadata?.status !== 'resolved'
        );
        setDisruption(targetDisruption);

        if (!selectedPlan && targetDisruption) {
          const res = await generateRecoveryPlans({
            disruption: targetDisruption,
            allItems: built.allItems || [],
            trip: rawData.trip,
            bookings: rawData.bookings || [],
            dependencies: rawData.dependencies || [],
          });
          if (res.plans && res.plans.length > 0) {
            setSelectedPlan(res.plans[0]);
          } else {
            setError('No feasible recovery plan available.');
          }
        }
      } catch (err) {
        console.error('Failed to load plan for confirmation:', err);
        setError(err.message || 'Could not load recovery plan details.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentTripId]);

  const handleApply = async () => {
    if (!confirmedCheckbox) {
      setError('Please confirm that you have reviewed the changes before applying.');
      return;
    }
    if (!selectedPlan) {
      setError('No recovery plan selected to apply.');
      return;
    }

    setIsApplying(true);
    setError('');

    try {
      const res = await applyRecoveryPlanToTrip({
        tripId: currentTripId,
        disruptionId: disruption?.id,
        plan: selectedPlan,
        user,
        previousItems: allItems,
      });

      if (dispatch) {
        dispatch({ type: 'APPLY_PLAN', planId: selectedPlan.id });
      }

      setIsApplied(true);
      setAppliedDetails(res);
    } catch (err) {
      console.error('Failed to apply recovery plan:', err);
      setError(err.message || 'Could not apply recovery plan. Please try again.');
    } finally {
      setIsApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center space-y-3">
        <RefreshCw size={32} className="animate-spin text-primary mx-auto" />
        <p className="text-sm font-bold text-navy">Preparing Recovery Plan Application...</p>
        <p className="text-xs text-ink-faint">Validating itinerary diff and financial impact.</p>
      </div>
    );
  }

  if (error && !selectedPlan) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
          <AlertCircle size={24} />
        </div>
        <h2 className="text-lg font-bold text-navy">Unable to Load Plan</h2>
        <p className="text-xs text-ink-soft leading-relaxed">{error}</p>
        <div className="pt-2 flex justify-center gap-3">
          <button
            className="btn-primary text-xs"
            onClick={() => navigate(currentTripId ? `/app/trip/${currentTripId}/recovery` : '/app/recovery')}
          >
            Back to Recovery Plans
          </button>
        </div>
      </div>
    );
  }

  // ── SUCCESS APPLIED STATE ──
  if (isApplied) {
    return (
      <div className="max-w-3xl mx-auto py-12 space-y-6">
        <div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 via-white to-sky-50/50 p-6 sm:p-8 text-center space-y-4 shadow-sm">
          <div className="mx-auto w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
            <CheckCircle2 size={36} />
          </div>

          <div>
            <span className="rounded-full bg-emerald-100 text-emerald-800 px-3 py-1 text-xs font-black uppercase tracking-wider">
              Stage 18 Completed
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-navy mt-2">
              Trip Recovery Applied!
            </h1>
            <p className="text-xs sm:text-sm text-ink-soft max-w-md mx-auto mt-1">
              Recovery plan <strong>"{selectedPlan.title}"</strong> ({selectedPlan.strategyTag}) has been applied to your TripSync itinerary.
            </p>
          </div>

          {/* Transparent Notice on External Bookings */}
          <div className="max-w-lg mx-auto rounded-2xl bg-amber-50 border border-amber-200/80 p-3.5 text-xs text-amber-900 text-left flex items-start gap-2.5">
            <Info size={16} className="text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-bold">External Booking Notice:</p>
              <p className="text-[11px] leading-relaxed">
                Your TripSync itinerary timeline and dependency guard are updated. <strong>External ticket rebooking and refund processing</strong> still need to be confirmed directly with your transport provider.
              </p>
            </div>
          </div>

          {/* Protected Downstream Highlights */}
          <div className="grid grid-cols-3 gap-2.5 max-w-md mx-auto text-xs">
            <div className="rounded-xl bg-white border border-navy/5 p-2.5">
              <span className="text-[10px] text-ink-faint uppercase font-bold block">Arrival</span>
              <span className="font-bold text-navy">{selectedPlan.destinationArrivalTimeFormatted}</span>
            </div>
            <div className="rounded-xl bg-white border border-navy/5 p-2.5">
              <span className="text-[10px] text-ink-faint uppercase font-bold block">Net Impact</span>
              <span className="font-bold text-emerald-700">{selectedPlan.netFinancialImpactLabel}</span>
            </div>
            <div className="rounded-xl bg-white border border-navy/5 p-2.5">
              <span className="text-[10px] text-ink-faint uppercase font-bold block">Intact</span>
              <span className="font-bold text-emerald-700">{selectedPlan.preservedCount}/{selectedPlan.totalItemsCount}</span>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => navigate(`/app/trip/${currentTripId}/timeline`)}
              className="btn-primary text-xs py-2.5 px-6 flex items-center gap-1.5 shadow-sm"
            >
              <span>View Updated Connected Itinerary</span>
              <ArrowRight size={13} />
            </button>

            <button
              onClick={() => navigate('/app/trip')}
              className="btn-secondary text-xs py-2.5 px-5"
            >
              Back to My Trips
            </button>
          </div>
        </div>
      </div>
    );
  }

  const itemIcons = {
    flight: Plane,
    train: TrainIcon,
    transfer: Car,
    hotel: Hotel,
    activity: Ticket,
  };

  function TrainIcon(props) {
    return <Plane {...props} />;
  }

  return (
    <div className="max-w-4xl mx-auto pb-16 space-y-6">
      {/* Top Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => navigate(currentTripId ? `/app/trip/${currentTripId}/recovery/compare` : '/app/recovery/compare', {
            state: { tripId: currentTripId, selectedPlanId: selectedPlan?.id }
          })}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-navy px-3 py-1.5 rounded-xl hover:bg-white transition shadow-2xs"
        >
          <ArrowLeft size={14} /> Back to Plan Comparison
        </button>

        <span className="text-xs text-ink-faint">
          Step 4 of 4: Review & Apply
        </span>
      </div>

      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-xs font-black uppercase tracking-wider">
            Stage 18 Confirm & Apply
          </span>
          <span className="text-xs text-ink-faint">Itinerary Update Authorization</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-navy mt-1">Review & Apply Recovery Plan</h1>
        <p className="text-xs sm:text-sm text-ink-soft mt-1">
          Review the changes carefully before applying this recovery plan to your connected journey.
        </p>
      </div>

      {/* ── STAGE 17 AI EXPLANATION EMBEDDED ── */}
      <RecoveryAiExplanationCard plan={selectedPlan} disruption={disruption} />

      {/* ── BEFORE / AFTER ITINERARY SEQUENCE COMPARISON ── */}
      <div className="rounded-3xl border border-navy/10 bg-white p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-navy/5 pb-3">
          <h3 className="text-sm sm:text-base font-extrabold text-navy flex items-center gap-2">
            <span>Itinerary Transformation</span>
            <span className="text-xs text-ink-faint font-normal">(Before vs After)</span>
          </h3>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
            {selectedPlan.strategyTag} Strategy
          </span>
        </div>

        <div className="grid md:grid-cols-2 gap-4 text-xs">
          {/* BEFORE: Original Timeline */}
          <div className="space-y-2.5 rounded-2xl bg-slate-50/80 p-4 border border-navy/5">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-slate-600 uppercase tracking-wider text-[10px]">
                Original Schedule (Disrupted)
              </span>
              <span className="rounded-full bg-rose-100 text-rose-800 px-2 py-0.2 text-[10px] font-bold">
                Disrupted
              </span>
            </div>

            <div className="space-y-2">
              <div className="rounded-xl bg-white p-2.5 border border-rose-200 shadow-2xs space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-navy truncate">
                    {disruption?.metadata?.affected_title || disruption?.title || 'Original Outbound Leg'}
                  </span>
                  <span className="rounded-full bg-rose-100 text-rose-800 px-2 py-0.2 text-[10px] font-bold">
                    CANCELLED / DELAYED
                  </span>
                </div>
                <p className="text-[11px] text-ink-soft">
                  Original: {disruption?.metadata?.disruption_type || 'Disruption'} (+{disruption?.metadata?.expected_delay_minutes || 120}m)
                </p>
              </div>

              <div className="rounded-xl bg-white p-2.5 border border-amber-200 shadow-2xs space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-navy truncate">Ground Transfer / Cab</span>
                  <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.2 text-[10px] font-bold">
                    AT RISK
                  </span>
                </div>
                <p className="text-[11px] text-ink-soft">Original pickup buffer compromised</p>
              </div>

              <div className="rounded-xl bg-white p-2.5 border border-amber-200 shadow-2xs space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-navy truncate">Mountain View Residency</span>
                  <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.2 text-[10px] font-bold">
                    AT RISK
                  </span>
                </div>
                <p className="text-[11px] text-ink-soft">Late check-in window threatened</p>
              </div>
            </div>
          </div>

          {/* AFTER: Recovered Timeline */}
          <div className="space-y-2.5 rounded-2xl bg-emerald-50/40 p-4 border border-emerald-200">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-emerald-800 uppercase tracking-wider text-[10px]">
                Recovered Schedule (Plan Applied)
              </span>
              <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.2 text-[10px] font-bold">
                Recovered
              </span>
            </div>

            <div className="space-y-2">
              {selectedPlan.itemTimeline?.map((item) => {
                const statusBadges = {
                  preserved: 'bg-emerald-100 text-emerald-800',
                  changed: 'bg-amber-100 text-amber-800',
                  cancelled: 'bg-rose-100 text-rose-800',
                  new: 'bg-sky-100 text-sky-800',
                  'at-risk': 'bg-orange-100 text-orange-800',
                };

                return (
                  <div key={item.id} className="rounded-xl bg-white p-2.5 border border-emerald-100 shadow-2xs space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-navy truncate">{item.title}</span>
                      <span className={`rounded-full px-2 py-0.2 text-[10px] font-bold uppercase ${statusBadges[item.status] || 'bg-slate-100 text-slate-700'}`}>
                        {item.status === 'new' ? 'REPLACED' : item.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[11px] text-ink-soft flex items-center justify-between">
                      <span>{item.note}</span>
                      <span className="font-semibold text-navy shrink-0">{item.timeLabel}</span>
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── FINANCIAL SUMMARY & REFUND BREAKDOWN ── */}
      <div className="rounded-3xl border border-navy/10 bg-white p-5 sm:p-6 space-y-3 shadow-xs">
        <h3 className="text-sm font-extrabold text-navy uppercase tracking-wider text-xs">
          Financial Summary & Net Impact
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="rounded-2xl bg-slate-50 p-3 border border-navy/5">
            <span className="text-[10px] font-bold uppercase text-ink-faint block">Original Booking</span>
            <span className="font-black text-navy text-sm">
              ₹{Number(selectedPlan.originalBookingCost || 3200).toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] text-ink-faint block">Disrupted ticket</span>
          </div>

          <div className="rounded-2xl bg-slate-50 p-3 border border-navy/5">
            <span className="text-[10px] font-bold uppercase text-ink-faint block">Estimated Refund</span>
            <span className="font-black text-emerald-700 text-sm">
              {selectedPlan.estimatedRefund > 0 ? `₹${selectedPlan.estimatedRefund.toLocaleString('en-IN')}` : '₹0'}
            </span>
            <span className="text-[10px] text-ink-faint block">{selectedPlan.refundStatus || 'Refund eligible'}</span>
          </div>

          <div className="rounded-2xl bg-slate-50 p-3 border border-navy/5">
            <span className="text-[10px] font-bold uppercase text-ink-faint block">Replacement Cost</span>
            <span className="font-black text-navy text-sm">
              {selectedPlan.totalAdditionalCost === 0 ? '₹0 (Waiver)' : `+₹${selectedPlan.totalAdditionalCost.toLocaleString('en-IN')}`}
            </span>
            <span className="text-[10px] text-ink-faint block">Estimated fare</span>
          </div>

          <div className="rounded-2xl bg-slate-50 p-3 border border-navy/5">
            <span className="text-[10px] font-bold uppercase text-ink-faint block">Net Financial Impact</span>
            <span className={`font-black text-sm ${selectedPlan.netFinancialImpact < 0 ? 'text-emerald-700' : 'text-navy'}`}>
              {selectedPlan.netFinancialImpactLabel}
            </span>
            <span className="text-[10px] text-emerald-700 block font-semibold">Total additional expense</span>
          </div>
        </div>

        <p className="text-[11px] text-ink-faint pt-1">
          * Refund and replacement costs are calculated estimates for itinerary resilience. External bookings and refund claims must be submitted with original carriers.
        </p>
      </div>

      {/* ── CONFIRMATION CHECKBOX & SUBMIT ── */}
      <div className="rounded-3xl border border-primary/20 bg-primary/5 p-5 sm:p-6 space-y-4 shadow-xs">
        {error && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={confirmedCheckbox}
            onChange={(e) => {
              setConfirmedCheckbox(e.target.checked);
              if (error) setError('');
            }}
            className="mt-1 h-4 w-4 rounded border-navy/20 text-primary focus:ring-primary cursor-pointer"
          />
          <div className="text-xs text-navy leading-relaxed">
            <span className="font-bold">I have reviewed the changes and want to apply this recovery plan.</span>
            <p className="text-ink-soft text-[11px] mt-0.5">
              This will update your connected itinerary schedule in TripSync and protect your downstream transfer and hotel check-in commitments.
            </p>
          </div>
        </label>

        <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-primary/10">
          <button
            onClick={() => navigate(currentTripId ? `/app/trip/${currentTripId}/recovery/compare` : '/app/recovery/compare')}
            className="btn-secondary text-xs py-2 px-4"
          >
            Change Strategy
          </button>

          <button
            onClick={handleApply}
            disabled={!confirmedCheckbox || isApplying}
            className={`btn-primary text-xs py-3 px-7 flex items-center gap-2 shadow-sm transition ${
              !confirmedCheckbox || isApplying ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.01]'
            }`}
          >
            {isApplying ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Applying Plan...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={15} />
                <span>Confirm & Apply Recovery Plan</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
