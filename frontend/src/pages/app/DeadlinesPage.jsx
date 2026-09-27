/**
 * DeadlinesPage.jsx — TripSync Stage 21 & 22: Deadlines, Policies & Weather Alerts
 * Route: /app/deadlines
 * 
 * Provides:
 * - Real itinerary-aware derivation of all travel deadlines & provider policies
 * - Hotel cancellation windows, fees, and check-in times (Booking.com integration)
 * - Flight web check-in, gate closure, and rebooking rules
 * - Dynamic recalculation when Stage 19 recovery plan updates the journey
 * - Live Open-Meteo weather forecasts and material weather risk advisories
 * - Combined "Travel Alerts & Actions" command section
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlarmClock, CalendarClock, ShieldCheck, Plane, Hotel, CloudRain,
  RefreshCw, AlertTriangle, CheckCircle2, ChevronRight, Filter, Info,
  Thermometer, Wind, Eye, Clock
} from 'lucide-react';
import { useTrip } from '../../context/TripContext.jsx';
import { fetchTripItineraryData, buildConnectedItinerary } from '../../services/itineraryService.js';
import { deriveDeadlinesAndPolicies } from '../../services/deadlinePolicyService.js';
import { getItineraryWeatherAlerts } from '../../services/weatherAlertService.js';
import DeadlinePolicyCard from '../../components/deadlines/DeadlinePolicyCard.jsx';
import WeatherAlertCard from '../../components/weather/WeatherAlertCard.jsx';
import TravelAlertsAndActions from '../../components/deadlines/TravelAlertsAndActions.jsx';
import RefundModal from '../../components/RefundModal.jsx';

const SEVERITY_LEGEND = [
  { label: 'Critical', detail: 'Less than 6 hours remaining — immediate action required', chip: 'bg-rose-100 text-rose-800 border-rose-200', dot: 'bg-rose-500' },
  { label: 'Due Soon', detail: '6 – 24 hours remaining — prepare cancellation / check-in', chip: 'bg-amber-100 text-amber-800 border-amber-200', dot: 'bg-amber-500' },
  { label: 'Upcoming', detail: 'More than 24 hours remaining — monitored by TripSync', chip: 'bg-sky-100 text-sky-800 border-sky-200', dot: 'bg-sky-500' },
  { label: 'Completed', detail: 'Check-in completed or window closed', chip: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400' },
];

export default function DeadlinesPage() {
  const navigate = useNavigate();
  const { activeTrip, activeTripId, realTrips } = useTrip();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deadlines, setDeadlines] = useState([]);
  const [weatherAlerts, setWeatherAlerts] = useState([]);
  const [weatherReports, setWeatherReports] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedReviewDeadline, setSelectedReviewDeadline] = useState(null);
  const [refundModalOpen, setRefundModalOpen] = useState(false);

  const currentTripId = activeTripId || activeTrip?.id || realTrips?.[0]?.id || null;

  const loadDeadlinesAndWeather = async () => {
    setLoading(true);
    setError('');

    try {
      let rawData = { trip: null, bookings: [], itineraryItems: [] };
      let appliedRecovery = null;

      if (currentTripId) {
        try {
          rawData = await fetchTripItineraryData(currentTripId);
        } catch (fetchErr) {
          console.warn('Could not fetch trip data from DB, using context/fallback:', fetchErr.message);
        }

        // Check for applied recovery plan in localStorage
        try {
          const stored = localStorage.getItem(`tripsync_applied_recovery_${currentTripId}`);
          if (stored) {
            appliedRecovery = JSON.parse(stored);
          }
        } catch (_) {}
      }

      // 1. Stage 21: Derive Deadlines & Policies
      const derivedDeadlines = deriveDeadlinesAndPolicies({
        trip: rawData.trip || activeTrip,
        bookings: rawData.bookings || [],
        itineraryItems: rawData.itineraryItems || [],
        appliedRecovery,
      });
      setDeadlines(derivedDeadlines);

      // 2. Stage 22: Fetch Live Weather Alerts
      const built = buildConnectedItinerary(rawData);
      const weatherRes = await getItineraryWeatherAlerts(
        built.allItems || [],
        built.tripSummary?.stops || []
      );

      setWeatherAlerts(weatherRes.activeAlerts || []);
      setWeatherReports(weatherRes.segmentReports || []);
    } catch (err) {
      console.error('Error loading deadlines and weather:', err);
      setError(err.message || 'Could not load deadlines and weather.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeadlinesAndWeather();
  }, [currentTripId]);

  // Filter deadlines according to selected tab
  const filteredDeadlines = deadlines.filter((d) => {
    if (activeFilter === 'urgent') return d.urgency === 'critical' || d.urgency === 'due_soon';
    if (activeFilter === 'hotel') return d.category === 'hotel' || d.category === 'hotel_checkin';
    if (activeFilter === 'flight') return d.category === 'flight' || d.category === 'flight_checkin' || d.category === 'flight_gate';
    return true;
  });

  const criticalCount = deadlines.filter((d) => d.urgency === 'critical' || d.urgency === 'due_soon').length;

  return (
    <div className="max-w-5xl mx-auto pb-16 space-y-7">
      {/* ── 1. Page Header & Trip Switcher ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-0.5 text-xs font-black uppercase tracking-wider">
              Stage 21 & 22 · Travel Resilience
            </span>
            {criticalCount > 0 && (
              <span className="rounded-full bg-rose-100 text-rose-800 border border-rose-300 px-2.5 py-0.5 text-xs font-bold animate-pulse">
                {criticalCount} Action Required
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-navy">
            Deadlines, Policies & Weather Guard
          </h1>
          <p className="text-xs sm:text-sm text-ink-soft mt-1 max-w-xl">
            TripSync monitors every refund window, check-in cut-off, provider policy, and live weather forecast connected to your trip.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadDeadlinesAndWeather}
            title="Refresh policies and live forecasts"
            className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 shadow-2xs hover:bg-white"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Sync Live</span>
          </button>
        </div>
      </div>

      {/* ── 2. Unified Travel Alerts & Actions Command View ── */}
      <TravelAlertsAndActions
        deadlines={deadlines}
        weatherAlerts={weatherAlerts}
        tripId={currentTripId}
      />

      {/* ── 3. Filter Navigation Tabs ── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setActiveFilter('all')}
          className={`rounded-full px-4 py-1.5 text-xs font-bold transition shrink-0 ${
            activeFilter === 'all'
              ? 'bg-navy text-white shadow-sm'
              : 'bg-white text-ink-soft hover:text-navy border border-navy/10'
          }`}
        >
          All Deadlines ({deadlines.length})
        </button>

        <button
          onClick={() => setActiveFilter('urgent')}
          className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition shrink-0 ${
            activeFilter === 'urgent'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'bg-white text-ink-soft hover:text-navy border border-navy/10'
          }`}
        >
          Urgent & Due Soon ({criticalCount})
        </button>

        <button
          onClick={() => setActiveFilter('hotel')}
          className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition shrink-0 ${
            activeFilter === 'hotel'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-white text-ink-soft hover:text-navy border border-navy/10'
          }`}
        >
          Hotels & Stays
        </button>

        <button
          onClick={() => setActiveFilter('flight')}
          className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition shrink-0 ${
            activeFilter === 'flight'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'bg-white text-ink-soft hover:text-navy border border-navy/10'
          }`}
        >
          Flights & Transit
        </button>

        <button
          onClick={() => setActiveFilter('weather')}
          className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition shrink-0 ${
            activeFilter === 'weather'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white text-ink-soft hover:text-navy border border-navy/10'
          }`}
        >
          Live Weather ({weatherReports.length} Segments)
        </button>
      </div>

      {/* ── 4. Main Content Area ── */}
      {activeFilter !== 'weather' ? (
        /* Deadlines Grid */
        <div className="space-y-4">
          <div className="grid gap-5 md:grid-cols-2">
            {filteredDeadlines.map((dl) => (
              <DeadlinePolicyCard
                key={dl.id}
                deadline={dl}
                tripId={currentTripId}
                onReview={(item) => {
                  setSelectedReviewDeadline(item);
                  setRefundModalOpen(true);
                }}
              />
            ))}
          </div>

          {filteredDeadlines.length === 0 && (
            <div className="rounded-3xl border-2 border-dashed border-navy/10 bg-slate-50/70 p-12 text-center">
              <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2" />
              <h3 className="text-base font-bold text-navy">No Deadlines in this Category</h3>
              <p className="text-xs text-ink-soft mt-1">All monitored policy windows are currently clear.</p>
            </div>
          )}
        </div>
      ) : (
        /* Weather Forecasts Grid */
        <div className="space-y-6">
          <div className="grid gap-5 md:grid-cols-2">
            {weatherReports.map((report, idx) => (
              <div
                key={idx}
                className="rounded-3xl border border-navy/10 bg-white p-5 sm:p-6 shadow-sm space-y-4"
              >
                <div className="flex items-center justify-between border-b border-navy/5 pb-3">
                  <div className="flex items-center gap-2">
                    <CloudRain size={16} className="text-primary" />
                    <h3 className="text-base font-black text-navy">{report.location}</h3>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-navy">
                    {report.condition}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-2xl bg-periwinkle/30 p-2.5">
                    <span className="text-[10px] text-ink-faint font-bold uppercase block">Temp</span>
                    <span className="text-sm font-black text-navy">{report.temperature}°C</span>
                  </div>
                  <div className="rounded-2xl bg-periwinkle/30 p-2.5">
                    <span className="text-[10px] text-ink-faint font-bold uppercase block">Wind</span>
                    <span className="text-sm font-black text-navy">{report.windSpeed} km/h</span>
                  </div>
                  <div className="rounded-2xl bg-periwinkle/30 p-2.5">
                    <span className="text-[10px] text-ink-faint font-bold uppercase block">Rain</span>
                    <span className="text-sm font-black text-navy">{report.precipitation} mm</span>
                  </div>
                </div>

                <p className="text-xs text-ink-soft leading-relaxed">
                  Connected to: <strong>{report.associatedItemTitle}</strong>. Open-Meteo live atmospheric readings confirm conditions are {report.isAdverse ? 'subject to advisory' : 'favorable'}.
                </p>
              </div>
            ))}
          </div>

          {weatherAlerts.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-ink-faint">
                Active Weather Advisories
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {weatherAlerts.map((wa) => (
                  <WeatherAlertCard key={wa.id} alert={wa} tripId={currentTripId} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 5. Severity Guide Explainer ── */}
      <div className="rounded-3xl border border-navy/5 bg-slate-50/80 p-5 sm:p-6 space-y-3.5">
        <div className="flex items-center gap-2 text-navy">
          <ShieldCheck size={16} className="text-primary" />
          <h3 className="text-sm font-bold">How TripSync Deadline Guard Protects You</h3>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SEVERITY_LEGEND.map((item) => (
            <div key={item.label} className="rounded-2xl bg-white border border-navy/5 p-3.5 space-y-1">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${item.chip}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${item.dot}`} />
                {item.label}
              </span>
              <p className="text-[11px] text-ink-soft leading-relaxed pt-1">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Review Refund Modal */}
      {refundModalOpen && (
        <RefundModal
          open={refundModalOpen}
          onClose={() => setRefundModalOpen(false)}
          deadlineTs={selectedReviewDeadline?.deadlineTimestamp ? new Date(selectedReviewDeadline.deadlineTimestamp).getTime() : Date.now() + 36000000}
        />
      )}
    </div>
  );
}