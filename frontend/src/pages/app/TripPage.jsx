/**
 * TripPage.jsx — TripSync Stage 26 (Trip Completion) & Stage 27 (My Trips)
 * Route: /app/trip
 * 
 * Provides:
 * - Full My Trips command center categorized by Active, Upcoming, and Completed
 * - Rich trip cards with destination, dates, status, and recovery plan badges
 * - Pre-completion summary modal with permanent trip archiving
 * - Seamless Connected Timeline and Bookings overview views
 * - Permanent preservation of completed itineraries, recovery history, and documents
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, LifeBuoy, MapPin, CalendarDays, Plane,
  GitBranch, Plus, RefreshCw, Layers, CheckCircle2,
  Clock, CreditCard, Users, FileText, Award, ShieldCheck,
  Sparkles, Filter
} from 'lucide-react';
import { useTrip } from '../../context/TripContext.jsx';
import ConnectedTimelineView from '../../components/itinerary/ConnectedTimelineView.jsx';
import BookingCard from '../../components/cards/BookingCard.jsx';
import TripCard from '../../components/trips/TripCard.jsx';
import TripCompletionModal from '../../components/trips/TripCompletionModal.jsx';
import {
  fetchTripItineraryData,
  buildConnectedItinerary,
} from '../../services/itineraryService.js';
import { getTripCompletionSummary } from '../../services/tripCompletionService.js';

export default function TripPage() {
  const {
    activeTrip,
    setActiveTrip,
    activeTripId,
    setActiveTripId,
    realTrips,
    loadRealTrips,
    tripsLoading,
    isDemoUser,
  } = useTrip();

  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'upcoming' | 'completed' | 'all'
  const [viewMode, setViewMode] = useState('trips'); // 'trips' | 'timeline' | 'bookings'
  const [selectedTripForTimeline, setSelectedTripForTimeline] = useState(null);
  const [timelineData, setTimelineData] = useState(null);
  const [loadingItinerary, setLoadingItinerary] = useState(false);

  // Completion Modal State
  const [completionModalOpen, setCompletionModalOpen] = useState(false);
  const [tripToComplete, setTripToComplete] = useState(null);
  const [completionSummary, setCompletionSummary] = useState(null);

  // Ensure default demo trip is populated if list is empty
  const allTrips = (realTrips && realTrips.length > 0) ? realTrips : [
    {
      id: 'demo-trip-1',
      name: 'Mumbai to Manali Adventure',
      title: 'Mumbai to Manali Adventure',
      origin_city: 'Mumbai',
      destination_city: 'Manali',
      start_at: '2026-09-12T08:30:00Z',
      end_at: '2026-09-18T18:00:00Z',
      status: 'active',
      travelers_count: 5,
      currency_code: 'INR',
    }
  ];

  // Categorize trips
  const activeTrips = allTrips.filter((t) => {
    const isCompleted = t.status === 'completed' || Boolean(localStorage.getItem(`tripsync_completed_${t.id}`));
    return !isCompleted && (t.status === 'active' || t.status === 'in_progress');
  });

  const upcomingTrips = allTrips.filter((t) => {
    const isCompleted = t.status === 'completed' || Boolean(localStorage.getItem(`tripsync_completed_${t.id}`));
    return !isCompleted && t.status !== 'active' && t.status !== 'in_progress';
  });

  const completedTrips = allTrips.filter((t) => {
    return t.status === 'completed' || Boolean(localStorage.getItem(`tripsync_completed_${t.id}`));
  });

  // Handle Complete Trip CTA click
  const handleOpenCompletionModal = async (trip) => {
    setTripToComplete(trip);
    let appliedRecovery = null;
    try {
      const stored = localStorage.getItem(`tripsync_applied_recovery_${trip.id}`);
      if (stored) appliedRecovery = JSON.parse(stored);
    } catch (_) {}

    const summary = getTripCompletionSummary({
      trip,
      allItems: timelineData?.allItems || [],
      appliedRecovery,
      disruptions: timelineData?.disruptions || [],
      documents: timelineData?.generalDocuments || [],
    });

    setCompletionSummary(summary);
    setCompletionModalOpen(true);
  };

  const handleTripCompleted = (tripId) => {
    loadRealTrips();
    setActiveTab('completed');
  };

  // Load detailed timeline for single trip view
  const handleOpenTimeline = async (trip) => {
    setSelectedTripForTimeline(trip);
    setViewMode('timeline');
    setLoadingItinerary(true);
    try {
      const rawData = await fetchTripItineraryData(trip.id);
      const built = buildConnectedItinerary(rawData);
      setTimelineData(built);
    } catch (err) {
      console.warn('Could not fetch from DB, building from trip object:', err);
      const fallbackBuilt = buildConnectedItinerary({
        trip,
        bookings: trip.bookings || [],
        itineraryItems: trip.itinerary_items || [],
        tripMembers: trip.trip_members || [],
        documents: trip.documents || [],
      });
      setTimelineData(fallbackBuilt);
    } finally {
      setLoadingItinerary(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-16 space-y-7">
      {/* ── 1. Page Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-0.5 text-xs font-black uppercase tracking-wider">
              Stage 26 & 27 · Trip Resilience Hub
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-navy">
            My Connected Trips
          </h1>
          <p className="text-xs sm:text-sm text-ink-soft mt-1 max-w-xl">
            Manage your active journeys, plan upcoming travels, and view completed trips with permanent recovery and document history.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {viewMode !== 'trips' && (
            <button
              onClick={() => setViewMode('trips')}
              className="btn-secondary text-xs py-2 px-3.5"
            >
              ← Back to All Trips
            </button>
          )}

          <button
            onClick={() => loadRealTrips()}
            title="Sync trips from cloud"
            className="p-2.5 rounded-xl bg-white border border-navy/10 text-ink-soft hover:text-navy transition shadow-2xs"
          >
            <RefreshCw size={14} className={tripsLoading ? 'animate-spin text-primary' : ''} />
          </button>

          <button
            onClick={() => navigate('/app/create-trip')}
            className="btn-primary text-xs py-2.5 px-4 flex items-center gap-1.5 shadow-xs"
          >
            <Plus size={14} />
            <span>Plan New Trip</span>
          </button>
        </div>
      </div>

      {viewMode === 'trips' ? (
        <>
          {/* ── 2. My Trips Tabs (Stage 27) ── */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setActiveTab('active')}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition shrink-0 ${
                activeTab === 'active'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white text-ink-soft hover:text-navy border border-navy/10'
              }`}
            >
              Active Trips ({activeTrips.length})
            </button>

            <button
              onClick={() => setActiveTab('upcoming')}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition shrink-0 ${
                activeTab === 'upcoming'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-white text-ink-soft hover:text-navy border border-navy/10'
              }`}
            >
              Upcoming Trips ({upcomingTrips.length})
            </button>

            <button
              onClick={() => setActiveTab('completed')}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition shrink-0 ${
                activeTab === 'completed'
                  ? 'bg-navy text-white shadow-sm'
                  : 'bg-white text-ink-soft hover:text-navy border border-navy/10'
              }`}
            >
              Completed ({completedTrips.length})
            </button>

            <button
              onClick={() => setActiveTab('all')}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition shrink-0 ${
                activeTab === 'all'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-white text-ink-soft hover:text-navy border border-navy/10'
              }`}
            >
              All ({allTrips.length})
            </button>
          </div>

          {/* ── 3. Trips Grid ── */}
          <div className="grid gap-5 md:grid-cols-2">
            {(activeTab === 'active' ? activeTrips : activeTab === 'upcoming' ? upcomingTrips : activeTab === 'completed' ? completedTrips : allTrips).map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                onCompleteClick={handleOpenCompletionModal}
                onViewSummary={(t) => handleOpenTimeline(t)}
              />
            ))}
          </div>

          {/* Empty Category State */}
          {((activeTab === 'active' && activeTrips.length === 0) ||
            (activeTab === 'upcoming' && upcomingTrips.length === 0) ||
            (activeTab === 'completed' && completedTrips.length === 0)) && (
            <div className="rounded-3xl border-2 border-dashed border-navy/10 bg-slate-50/70 p-12 text-center">
              <Plane size={36} className="mx-auto text-sky-400 mb-2" />
              <h3 className="text-base font-bold text-navy">
                No {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Trips
              </h3>
              <p className="text-xs text-ink-soft mt-1 max-w-sm mx-auto">
                {activeTab === 'completed'
                  ? 'Trips marked as completed will appear here with archived itineraries, recovery history, and documents.'
                  : 'Plan a new trip to start monitoring connected bookings, disruptions, and recovery.'}
              </p>
              <button
                onClick={() => navigate('/app/create-trip')}
                className="mt-4 btn-primary text-xs py-2 px-5"
              >
                Plan a New Trip
              </button>
            </div>
          )}
        </>
      ) : (
        /* ── 4. Detailed Connected Itinerary View ── */
        <div className="space-y-4">
          <ConnectedTimelineView
            timelineData={timelineData}
            onRefresh={() => handleOpenTimeline(selectedTripForTimeline)}
          />
        </div>
      )}

      {/* ── 5. Stage 26 Trip Completion Modal ── */}
      <TripCompletionModal
        open={completionModalOpen}
        onClose={() => setCompletionModalOpen(false)}
        trip={tripToComplete}
        completionSummary={completionSummary}
        onTripCompleted={handleTripCompleted}
      />
    </div>
  );
}