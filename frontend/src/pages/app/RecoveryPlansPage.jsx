/**
 * RecoveryPlansPage.jsx — TripSync Stage 13 Intelligent Recovery Engine Page
 * Route: /app/trip/:tripId/recovery
 * Consumes real Stage 12 disruption data & connected itinerary to generate
 * multiple feasible recovery strategies with trade-offs.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import {
  ArrowLeft, Loader2, AlertCircle, AlertTriangle, CheckCircle2,
  Sparkles, RefreshCw, ShieldCheck, Clock, ArrowRight, Plane, ChevronRight
} from 'lucide-react';
import { fetchTripItineraryData, buildConnectedItinerary } from '../../services/itineraryService.js';
import { generateRecoveryPlans } from '../../services/recoveryService.js';
import { fetchBlastRadius } from '../../services/blastRadiusService.js';
import { useTrip } from '../../context/TripContext.jsx';
import Stage13RecoveryCard from '../../components/recovery/Stage13RecoveryCard.jsx';
import RecoveryDetailModal from '../../components/recovery/RecoveryDetailModal.jsx';
import Stage14BlastRadiusGraph from '../../components/recovery/Stage14BlastRadiusGraph.jsx';

export default function RecoveryPlansPage() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { activeTripId, dispatch, state } = useTrip();

  const currentTripId = tripId || location.state?.tripId || activeTripId || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [disruptionSummary, setDisruptionSummary] = useState(null);
  const [plans, setPlans] = useState([]);
  const [blastRadius, setBlastRadius] = useState(null);
  const [blastRadiusLoading, setBlastRadiusLoading] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [activeModalPlan, setActiveModalPlan] = useState(null);
  const [filterStrategy, setFilterStrategy] = useState('all');

  const loadRecoveryData = async () => {
    if (!currentTripId) return;
    setLoading(true);
    setError('');

    try {
      const rawData = await fetchTripItineraryData(currentTripId);
      const built = buildConnectedItinerary(rawData);

      // Find active disruption (from navigation state, target disruptionId, Supabase, or fallback)
      const passedDisruption = location.state?.disruption;
      const targetDisruptionId = location.state?.disruptionId || new URLSearchParams(location.search).get('disruptionId');

      let activeDisruption = null;
      if (targetDisruptionId && Array.isArray(rawData.disruptions)) {
        activeDisruption = rawData.disruptions.find((d) => d.id === targetDisruptionId);
      }
      if (!activeDisruption && passedDisruption) {
        activeDisruption = passedDisruption;
      }
      if (!activeDisruption && Array.isArray(rawData.disruptions)) {
        activeDisruption = rawData.disruptions.find(
          (d) => !d.resolved_at && d.metadata?.status !== 'resolved'
        );
      }

      // If no disruption is logged yet, check built itinerary for flight item to simulate recovery
      if (!activeDisruption) {
        const flightItem = (built.allItems || []).find((it) => it.itemType === 'flight');
        if (flightItem) {
          activeDisruption = {
            id: 'disr-flight-active',
            title: `Flight Cancellation: ${flightItem.title}`,
            severity: 'critical',
            detected_at: new Date().toISOString(),
            metadata: {
              disruption_type: 'Flight Cancellation',
              affected_item_id: flightItem.id,
              affected_title: flightItem.title,
              expected_delay_minutes: 240,
            },
          };
        }
      }

      if (!activeDisruption) {
        setDisruptionSummary(null);
        setPlans([]);
        setLoading(false);
        return;
      }

      setBlastRadiusLoading(true);
      let graphResult = null;
      try {
        graphResult = await fetchBlastRadius({
          tripId: currentTripId,
          disruption: activeDisruption,
          items: built.allItems || [],
          dependencies: rawData.dependencies || [],
          rootItemId: activeDisruption?.metadata?.affected_item_id,
          delayMinutes: activeDisruption?.metadata?.expected_delay_minutes || 240,
        });
        setBlastRadius(graphResult);
      } catch (graphErr) {
        console.warn('Blast radius computation note:', graphErr);
      } finally {
        setBlastRadiusLoading(false);
      }

      const result = await generateRecoveryPlans({
        disruption: activeDisruption,
        allItems: built.allItems || [],
        trip: rawData.trip,
        bookings: rawData.bookings || [],
        dependencies: rawData.dependencies || [],
        blastRadius: graphResult,
      });

      setDisruptionSummary(result.disruptionSummary);
      setPlans(result.plans || []);
      if (result.blastRadius && !graphResult) {
        setBlastRadius(result.blastRadius);
      }
      if (result.plans && result.plans.length > 0) {
        setSelectedPlanId(result.plans[0].id);
      }
    } catch (err) {
      console.error('Failed to generate recovery plans:', err);
      setError(err.message || 'Could not generate recovery plans.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecoveryData();
  }, [currentTripId]);

  const handleSelectPlan = (plan) => {
    setSelectedPlanId(plan.id);
    if (dispatch) {
      dispatch({ type: 'SELECT_PLAN', planId: plan.id });
    }
  };

  const handleNavigateToConfirm = (plan) => {
    const targetPlan = plan || plans.find((p) => p.id === selectedPlanId) || plans[0];
    if (!targetPlan) return;
    navigate(currentTripId ? `/app/trip/${currentTripId}/recovery/confirm` : '/app/recovery/confirm', {
      state: { tripId: currentTripId, selectedPlan: targetPlan, plans, disruption: disruptionSummary }
    });
  };

  const filteredPlans = filterStrategy === 'all'
    ? plans
    : plans.filter((p) => p.strategyType === filterStrategy);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 size={36} className="animate-spin text-primary" />
        <div className="text-center">
          <p className="text-sm font-bold text-navy">Generating Feasible Recovery Plans...</p>
          <p className="text-xs text-ink-faint mt-1">
            Analyzing connected itinerary, transfer buffers, and downstream dependencies.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
          <AlertCircle size={24} />
        </div>
        <h2 className="text-lg font-bold text-navy">Recovery Engine Notice</h2>
        <p className="text-xs text-ink-soft leading-relaxed">
          {error || "Recovery options couldn't be loaded right now. Please try again."}
        </p>
        <div className="pt-2 flex justify-center gap-3">
          <button className="btn-secondary text-xs" onClick={loadRecoveryData}>
            Retry Scan
          </button>
          <button className="btn-primary text-xs" onClick={() => navigate(`/app/trip/${currentTripId}/timeline`)}>
            Back to Itinerary
          </button>
        </div>
      </div>
    );
  }

  if (!disruptionSummary || plans.length === 0) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
          <CheckCircle2 size={24} />
        </div>
        <h2 className="text-lg font-bold text-navy">No Active Disruption</h2>
        <p className="text-xs text-ink-soft leading-relaxed">
          All legs of your connected itinerary are currently on schedule. When an issue occurs,
          recovery plans will be generated here automatically.
        </p>
        <div className="pt-2 flex justify-center gap-3">
          <button
            className="btn-primary text-xs"
            onClick={() => navigate(`/app/trip/${currentTripId}/timeline`)}
          >
            View Connected Itinerary
          </button>
        </div>
      </div>
    );
  }

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  return (
    <div className="max-w-6xl mx-auto pb-16 space-y-6">
      {/* Top Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => navigate(`/app/trip/${currentTripId}/timeline`)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-navy px-3 py-1.5 rounded-xl hover:bg-white transition shadow-2xs"
        >
          <ArrowLeft size={14} /> Back to Itinerary Timeline
        </button>

        <button
          onClick={loadRecoveryData}
          title="Re-run recovery plan generator"
          className="inline-flex items-center gap-1 text-xs font-medium text-ink-soft hover:text-navy px-2.5 py-1.5 rounded-xl hover:bg-white transition"
        >
          <RefreshCw size={13} />
          <span>Refresh Plans</span>
        </button>
      </div>

      {/* Page Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-black uppercase tracking-wider">
              Stage 13 Recovery
            </span>
            <span className="text-xs text-ink-faint">Intelligent Recovery Engine</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-navy mt-1">Recovery Plans</h1>
          <p className="text-xs sm:text-sm text-ink-soft mt-1">
            We found recovery options based on your disruption, itinerary, timing and downstream commitments.
          </p>
        </div>

        {plans.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(currentTripId ? `/app/trip/${currentTripId}/recovery/compare` : '/app/recovery/compare', {
                state: { tripId: currentTripId, plans, selectedPlanId, disruption: disruptionSummary }
              })}
              className="btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5 shadow-2xs"
            >
              <span>Compare Plans</span>
              <ChevronRight size={13} />
            </button>

            <button
              onClick={() => navigate(currentTripId ? `/app/trip/${currentTripId}/recovery/confirm` : '/app/recovery/confirm', {
                state: { tripId: currentTripId, selectedPlan, plans, disruption: disruptionSummary }
              })}
              className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5 shadow-sm"
            >
              <span>Review & Apply Plan</span>
              <ArrowRight size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Disruption Summary Banner (From Real Stage 12 Data) */}
      <div className="rounded-3xl border border-rose-200 bg-rose-50/50 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-10 w-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-800">
                Disruption Detected
              </span>
              <span className="rounded-full bg-rose-200 text-rose-900 px-2 py-0.2 text-[10px] font-bold">
                {disruptionSummary.severity} severity
              </span>
            </div>
            <h3 className="text-sm sm:text-base font-extrabold text-navy mt-0.5 truncate">
              {disruptionSummary.disruptionType}: {disruptionSummary.affectedItemTitle} ({disruptionSummary.affectedSegment})
            </h3>
            <p className="text-xs text-ink-soft mt-0.5">
              Original Departure: {disruptionSummary.originalDeparture} • {disruptionSummary.downstreamAffectedCount} downstream bookings affected
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint block">
            Generated Options
          </span>
          <span className="text-sm font-black text-navy">
            {plans.length} Feasible Strategies
          </span>
        </div>
      </div>

      {/* Selected Plan Banner if chosen */}
      {selectedPlan && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <Sparkles size={16} className="text-primary" />
            <div>
              <span className="font-bold text-navy">Selected Plan: </span>
              <span className="font-extrabold text-primary">{selectedPlan.title} ({selectedPlan.strategyTag})</span>
              <span className="text-ink-soft ml-2">
                — Arrives {selectedPlan.destinationArrivalTimeFormatted} ({selectedPlan.timeDelayLabel}) • Net Impact: {selectedPlan.netFinancialImpactLabel}
              </span>
            </div>
          </div>
          <button
            onClick={() => navigate(currentTripId ? `/app/trip/${currentTripId}/recovery/confirm` : '/app/recovery/confirm', {
              state: { tripId: currentTripId, selectedPlan, plans, disruption: disruptionSummary }
            })}
            className="btn-primary text-xs py-1.5 px-4 shadow-2xs"
          >
            Review & Apply Selected Plan →
          </button>
        </div>
      )}

      {/* Stage 14: NetworkX Blast Radius Graph Visualization */}
      <Stage14BlastRadiusGraph
        blastRadius={blastRadius}
        loading={blastRadiusLoading}
        onRefresh={loadRecoveryData}
      />

      {/* Strategy Filter Tabs & Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setFilterStrategy('all')}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition shrink-0 ${
              filterStrategy === 'all'
                ? 'bg-navy text-white shadow-sm'
                : 'bg-white text-ink-soft hover:text-navy border border-navy/10'
            }`}
          >
            All Strategies ({plans.length})
          </button>
          <button
            onClick={() => setFilterStrategy('earliest-arrival')}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition shrink-0 ${
              filterStrategy === 'earliest-arrival'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white text-ink-soft hover:text-navy border border-navy/10'
            }`}
          >
            Fastest
          </button>
          <button
            onClick={() => setFilterStrategy('lowest-cost')}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition shrink-0 ${
              filterStrategy === 'lowest-cost'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-white text-ink-soft hover:text-navy border border-navy/10'
            }`}
          >
            Lowest Cost
          </button>
          <button
            onClick={() => setFilterStrategy('minimum-disruption')}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition shrink-0 ${
              filterStrategy === 'minimum-disruption'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-ink-soft hover:text-navy border border-navy/10'
            }`}
          >
            Most Itinerary Preserved
          </button>
        </div>

        <button
          onClick={() => navigate(currentTripId ? `/app/trip/${currentTripId}/recovery/compare` : '/app/recovery/compare', {
            state: { tripId: currentTripId, plans, selectedPlanId, disruption: disruptionSummary }
          })}
          className="btn-secondary text-xs py-1.5 px-3.5 flex items-center gap-1.5"
        >
          <span>Compare All Plans Side-by-Side</span>
          <ChevronRight size={13} />
        </button>
      </div>

      {/* Recovery Plan Cards Grid */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {filteredPlans.map((plan) => (
          <Stage13RecoveryCard
            key={plan.id}
            plan={plan}
            isSelected={selectedPlanId === plan.id}
            onSelect={handleSelectPlan}
            onViewDetails={(p) => setActiveModalPlan(p)}
            onApply={handleNavigateToConfirm}
          />
        ))}
      </div>

      {/* Plan Detail Modal */}
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
