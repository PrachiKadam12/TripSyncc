/**
 * TripCard.jsx — TripSync Stage 27 Trip Card Component
 * 
 * Displays individual trip card for Upcoming, Active, and Completed categories with:
 * - Title, route, and formatted dates
 * - Dynamic status chip (Active, Upcoming, Completed, Disrupted, Recovered)
 * - Stage 19 recovery strategy badge if applied
 * - Quick metrics: travelers, bookings, documents
 * - Direct action CTAs (View Final Itinerary, View Documents, Complete Trip)
 */

import { useNavigate } from 'react-router-dom';
import {
  MapPin, CalendarDays, Users, FileText, CheckCircle2,
  Clock, ArrowRight, Sparkles, Layers, ShieldCheck, Award
} from 'lucide-react';

export default function TripCard({
  trip,
  onCompleteClick = null,
  onViewSummary = null,
}) {
  const navigate = useNavigate();

  // Check if recovery was applied
  let appliedRecovery = null;
  try {
    const stored = localStorage.getItem(`tripsync_applied_recovery_${trip.id}`);
    if (stored) {
      appliedRecovery = JSON.parse(stored);
    }
  } catch (_) {}

  // Check if completed in localStorage or DB
  const isCompleted = trip.status === 'completed' || Boolean(localStorage.getItem(`tripsync_completed_${trip.id}`));

  const statusColors = {
    completed: 'bg-slate-100 text-slate-800 border-slate-300',
    active: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    planned: 'bg-sky-100 text-sky-800 border-sky-300',
    disrupted: 'bg-rose-100 text-rose-800 border-rose-300',
  };

  const statusLabel = isCompleted ? 'Completed' : (trip.status === 'active' ? 'Active Journey' : 'Upcoming');
  const statusBadgeClass = isCompleted ? statusColors.completed : (statusColors[trip.status] || statusColors.planned);

  const datesFormatted = trip.start_at && trip.end_at
    ? `${new Date(trip.start_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${new Date(trip.end_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : (trip.dates_label || 'Flexible dates');

  const originCity = trip.origin_city || trip.origin || 'Mumbai';
  const destCity = trip.destination_city || trip.destination || 'Manali';
  const bookingsCount = trip.bookings?.length || 4;
  const docsCount = trip.documents?.length || 4;
  const travelersCount = trip.trip_members?.length || trip.travelers_count || 5;

  return (
    <div className={`rounded-3xl border bg-white p-5 sm:p-6 shadow-sm transition-all hover:shadow-md ${
      isCompleted ? 'border-navy/10 bg-slate-50/40' : 'border-navy/10'
    }`}>
      {/* Top Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-navy/5 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${statusBadgeClass}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isCompleted ? 'bg-slate-500' : 'bg-emerald-500 animate-pulse'}`} />
            {statusLabel}
          </span>

          {appliedRecovery && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-bold">
              <Sparkles size={11} className="text-emerald-600" />
              <span>Recovered ({appliedRecovery.strategyTag} Strategy)</span>
            </span>
          )}
        </div>

        <span className="text-[11px] text-ink-faint font-medium">
          Updated recently
        </span>
      </div>

      {/* Main Trip Info */}
      <div className="mt-3.5 space-y-2.5">
        <div>
          <h3 className="text-lg sm:text-xl font-black text-navy">
            {trip.name || trip.title}
          </h3>
          <p className="text-xs text-ink-soft font-semibold flex items-center gap-1.5 mt-0.5">
            <MapPin size={13} className="text-emerald-600" />
            <span>{originCity} → {destCity}</span>
          </p>
        </div>

        <p className="text-xs text-ink-soft font-medium flex items-center gap-1.5">
          <CalendarDays size={13} className="text-primary" />
          <span>{datesFormatted}</span>
        </p>

        {/* Quick Metrics Strip */}
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-50/80 border border-navy/5 p-3 text-center text-xs">
          <div>
            <span className="text-[10px] font-bold uppercase text-ink-faint block">Travelers</span>
            <span className="font-black text-navy text-sm mt-0.5 block">{travelersCount}</span>
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase text-ink-faint block">Bookings</span>
            <span className="font-black text-navy text-sm mt-0.5 block">{bookingsCount}</span>
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase text-ink-faint block">Documents</span>
            <span className="font-black text-navy text-sm mt-0.5 block">{docsCount}</span>
          </div>
        </div>
      </div>

      {/* Footer Action Buttons */}
      <div className="mt-4 pt-3.5 border-t border-navy/5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/app/trip/${trip.id}/timeline`)}
            className="btn-primary text-xs py-1.5 px-3.5 flex items-center gap-1 shadow-2xs"
          >
            <span>{isCompleted ? 'View Final Itinerary' : 'View Connected Journey'}</span>
            <ArrowRight size={12} />
          </button>

          <button
            onClick={() => navigate('/app/documents')}
            className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1"
          >
            <FileText size={12} />
            <span>Documents</span>
          </button>
        </div>

        {!isCompleted && onCompleteClick && (
          <button
            onClick={() => onCompleteClick(trip)}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 transition px-2 py-1 rounded-lg hover:bg-emerald-50"
          >
            <CheckCircle2 size={13} />
            <span>Complete Trip</span>
          </button>
        )}

        {isCompleted && (
          <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
            <ShieldCheck size={13} className="text-slate-500" />
            <span>Archived in Vault</span>
          </span>
        )}
      </div>
    </div>
  );
}
