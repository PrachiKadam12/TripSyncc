/**
 * TripTimelinePage.jsx — Connected Itinerary Timeline Page
 * Route: /app/trip/:tripId/timeline
 * Renders the full chronological connected itinerary from real Supabase trip data.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Loader2, AlertCircle, Plane, Sparkles, Plus,
  ChevronRight, RefreshCw, CalendarDays
} from 'lucide-react';
import { fetchTripItineraryData, buildConnectedItinerary } from '../../services/itineraryService.js';
import ConnectedTimelineView from '../../components/itinerary/ConnectedTimelineView.jsx';
import { useTrip } from '../../context/TripContext.jsx';

import TripCompletionModal from '../../components/trips/TripCompletionModal.jsx';
import { getTripCompletionSummary } from '../../services/tripCompletionService.js';

export default function TripTimelinePage() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const { realTrips, setActiveTrip, loadRealTrips } = useTrip();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timelineData, setTimelineData] = useState(null);
  const [completionModalOpen, setCompletionModalOpen] = useState(false);
  const [completionSummary, setCompletionSummary] = useState(null);

  const loadData = async () => {
    if (!tripId) return;
    setLoading(true);
    setError('');
    try {
      const rawData = await fetchTripItineraryData(tripId);
      const built = buildConnectedItinerary(rawData);
      setTimelineData(built);
      if (rawData.trip) {
        setActiveTrip(rawData.trip);
      }
    } catch (err) {
      console.error('Failed to load trip timeline:', err);
      setError(err.message || 'Could not load itinerary from database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tripId]);

  const handleOpenCompletionModal = (tripSummary) => {
    let appliedRecovery = null;
    try {
      const stored = localStorage.getItem(`tripsync_applied_recovery_${tripId}`);
      if (stored) appliedRecovery = JSON.parse(stored);
    } catch (_) {}

    const summary = getTripCompletionSummary({
      trip: timelineData?.tripSummary || { id: tripId, name: 'Connected Trip' },
      allItems: timelineData?.allItems || [],
      appliedRecovery,
      disruptions: timelineData?.activeDisruptions || [],
      documents: timelineData?.generalDocuments || [],
    });

    setCompletionSummary(summary);
    setCompletionModalOpen(true);
  };

  const handleTripCompleted = () => {
    loadRealTrips();
    loadData();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 size={36} className="animate-spin text-primary" />
        <div className="text-center">
          <p className="text-sm font-bold text-navy">Building your Connected Itinerary...</p>
          <p className="text-xs text-ink-faint mt-1">Connecting stops, bookings, travelers, and documents.</p>
        </div>
      </div>
    );
  }

  if (error || !timelineData?.tripSummary) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
          <AlertCircle size={24} />
        </div>
        <h2 className="text-lg font-bold text-navy">Trip Not Found</h2>
        <p className="text-xs text-ink-soft leading-relaxed">
          {error || "We couldn't retrieve the itinerary for this trip ID from your account."}
        </p>
        <div className="pt-2 flex justify-center gap-3">
          <button className="btn-secondary text-xs" onClick={() => navigate('/app/trip')}>
            View My Trips
          </button>
          <button className="btn-primary text-xs" onClick={() => navigate('/app')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-16 space-y-6">
      {/* Top Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => navigate('/app/trip')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-navy px-3 py-1.5 rounded-xl hover:bg-white transition shadow-2xs"
        >
          <ArrowLeft size={14} /> Back to My Trips
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/app/deadlines')}
            className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1 shadow-xs"
          >
            <span>Next: Deadlines & Policies →</span>
          </button>

          <button
            onClick={loadData}
            title="Refresh itinerary from database"
            className="inline-flex items-center gap-1 text-xs font-medium text-ink-soft hover:text-navy px-2.5 py-1.5 rounded-xl hover:bg-white transition"
          >
            <RefreshCw size={13} />
            <span className="hidden sm:inline">Sync</span>
          </button>

          <button
            onClick={() => navigate('/app/create-trip')}
            className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
          >
            <Plus size={13} /> Plan New Trip
          </button>
        </div>
      </div>

      {/* Other Trips Bar (if multiple trips) */}
      {realTrips?.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint shrink-0">
            Switch Trip:
          </span>
          {realTrips.map((t) => {
            const isCurrent = t.id === tripId;
            return (
              <button
                key={t.id}
                onClick={() => navigate(`/app/trip/${t.id}/timeline`)}
                className={`rounded-xl px-3 py-1 text-xs font-semibold transition shrink-0 ${
                  isCurrent
                    ? 'bg-navy text-white shadow-xs'
                    : 'bg-white hover:bg-slate-50 text-ink-soft border border-navy/5'
                }`}
              >
                {t.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Render Connected Timeline View */}
      <ConnectedTimelineView
        timelineData={timelineData}
        onRefresh={loadData}
        onCompleteTrip={handleOpenCompletionModal}
      />

      {/* Trip Completion Modal */}
      <TripCompletionModal
        open={completionModalOpen}
        onClose={() => setCompletionModalOpen(false)}
        trip={timelineData?.tripSummary}
        completionSummary={completionSummary}
        onTripCompleted={handleTripCompleted}
      />
    </div>
  );
}
