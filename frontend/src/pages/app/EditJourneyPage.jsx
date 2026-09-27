/**
 * EditJourneyPage.jsx — TripSync Stage 11 Edit Journey Workspace
 * Route: /app/trip/:tripId/edit
 * Allows travelers to edit stops, dates, times, activities, reorder journey legs,
 * and protect booking-linked records.
 * Uses top navigation layout with NO left sidebar and NO quick actions.
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, ArrowUp, ArrowDown, Save, X,
  AlertCircle, CheckCircle2, Lock, MapPin, CalendarDays,
  Clock, Navigation, Plane, Hotel, Train, Bus, Car, Ticket,
  Loader2, Info
} from 'lucide-react';
import {
  fetchTripItineraryData,
  updateTripJourney,
  formatTimeSafe,
  parseTripMetadata
} from '../../services/itineraryService.js';
import { useTrip } from '../../context/TripContext.jsx';

export default function EditJourneyPage() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const { setActiveTrip, loadRealTrips } = useTrip();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  const [trip, setTrip] = useState(null);
  const [stops, setStops] = useState([]);
  const [deletedStopIds, setDeletedStopIds] = useState([]);
  const [bookingItems, setBookingItems] = useState([]);

  // New Stop Modal State
  const [newStopModal, setNewStopModal] = useState(false);
  const [newStopForm, setNewStopForm] = useState({
    city: '',
    day_number: 1,
    transport: 'None',
    activities: '',
    notes: '',
  });

  // Load trip data from Supabase
  useEffect(() => {
    async function load() {
      if (!tripId) return;
      setLoading(true);
      setError('');
      try {
        const data = await fetchTripItineraryData(tripId);
        setTrip(data.trip);
        if (data.trip) {
          setActiveTrip(data.trip);
        }

        const meta = parseTripMetadata(data.trip?.description);
        const metaStops = meta.stops || [];

        // Build unified editable stops from itinerary_items or metadata.stops
        let editableStops = [];

        if (data.itineraryItems?.length > 0) {
          editableStops = data.itineraryItems.map((it, idx) => ({
            id: it.id,
            day_number: it.metadata?.day_number || idx + 1,
            city: it.location || it.metadata?.city || it.title || '',
            route: it.metadata?.route || '',
            title: it.title || '',
            transport: it.metadata?.transport || (it.item_type === 'stop' ? 'None' : it.item_type),
            activities: it.metadata?.activities || it.description || '',
            notes: it.metadata?.notes || it.description || '',
            arrival: it.metadata?.arrival || '',
            departure: it.metadata?.departure || '',
            start_at: it.start_at || '',
            end_at: it.end_at || '',
            booking_id: it.booking_id || null,
            isBookingLinked: Boolean(it.booking_id),
          }));
        } else if (metaStops.length > 0) {
          editableStops = metaStops.map((s, idx) => ({
            id: s.id || `stop-${idx}`,
            day_number: s.day_number || idx + 1,
            city: s.city || '',
            route: s.route || '',
            title: s.title || s.city || `Day ${idx + 1}`,
            transport: s.transport || 'None',
            activities: s.activities || '',
            notes: s.notes || s.description || '',
            arrival: s.arrival || '',
            departure: s.departure || '',
            start_at: s.start_at || '',
            end_at: s.end_at || '',
            booking_id: null,
            isBookingLinked: false,
          }));
        } else {
          editableStops = [
            {
              id: `stop-1`,
              day_number: 1,
              city: data.trip?.destination_city || data.trip?.name || 'Main Destination',
              route: '',
              title: data.trip?.destination_city || 'Destination',
              transport: 'None',
              activities: '',
              notes: '',
              arrival: '',
              departure: '',
              start_at: '',
              end_at: '',
              booking_id: null,
              isBookingLinked: false,
            },
          ];
        }

        setStops(editableStops);
        setBookingItems(data.bookings || []);
      } catch (err) {
        console.error('Failed to load journey for editing:', err);
        setError(err.message || 'Could not load journey.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [tripId]);

  // Handle Stop Field Change
  const handleStopChange = (index, field, value) => {
    setIsDirty(true);
    setStops((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Move Stop Up
  const moveUp = (index) => {
    if (index === 0) return;
    setIsDirty(true);
    setStops((prev) => {
      const copy = [...prev];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      return copy.map((s, i) => ({ ...s, day_number: s.day_number || i + 1 }));
    });
  };

  // Move Stop Down
  const moveDown = (index) => {
    if (index >= stops.length - 1) return;
    setIsDirty(true);
    setStops((prev) => {
      const copy = [...prev];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      return copy.map((s, i) => ({ ...s, day_number: s.day_number || i + 1 }));
    });
  };

  // Delete Stop
  const deleteStop = (index) => {
    const stopToDelete = stops[index];
    if (stops.length <= 1) {
      alert('Your journey must have at least one stop.');
      return;
    }

    if (stopToDelete.isBookingLinked) {
      alert('This item is linked to a confirmed booking and cannot be deleted from itinerary editing.');
      return;
    }

    if (!window.confirm(`Delete stop "${stopToDelete.city || stopToDelete.title || 'Stop'}"?`)) {
      return;
    }

    setIsDirty(true);
    if (stopToDelete.id && typeof stopToDelete.id === 'string' && /^[0-9a-fA-F-]{36}$/.test(stopToDelete.id)) {
      setDeletedStopIds((prev) => [...prev, stopToDelete.id]);
    }

    setStops((prev) => prev.filter((_, i) => i !== index));
  };

  // Add New Stop
  const handleAddNewStop = (e) => {
    e.preventDefault();
    if (!newStopForm.city.trim()) {
      alert('Please enter a stop city or location.');
      return;
    }

    const newStop = {
      id: `new-stop-${Date.now()}`,
      day_number: parseInt(newStopForm.day_number, 10) || stops.length + 1,
      city: newStopForm.city.trim(),
      title: newStopForm.city.trim(),
      transport: newStopForm.transport || 'None',
      activities: newStopForm.activities.trim(),
      notes: newStopForm.notes.trim(),
      arrival: '',
      departure: '',
      start_at: '',
      end_at: '',
      isBookingLinked: false,
    };

    setIsDirty(true);
    setStops((prev) => [...prev, newStop]);
    setNewStopModal(false);
    setNewStopForm({
      city: '',
      day_number: stops.length + 2,
      transport: 'None',
      activities: '',
      notes: '',
    });
  };

  // Save All Changes to Supabase
  const handleSaveJourney = async () => {
    setError('');
    setSuccessMsg('');

    // Validation
    for (let i = 0; i < stops.length; i++) {
      const s = stops[i];
      if (!s.city && !s.title) {
        setError(`Stop #${i + 1} requires a city or location name.`);
        return;
      }

      // Start vs End time validation
      if (s.start_at && s.end_at) {
        const startTs = new Date(s.start_at).getTime();
        const endTs = new Date(s.end_at).getTime();
        if (!Number.isNaN(startTs) && !Number.isNaN(endTs) && endTs < startTs) {
          setError(`Stop "${s.city || s.title}": End time cannot be earlier than start time.`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      await updateTripJourney({
        tripId,
        stops,
        itemsToDelete: deletedStopIds,
      });

      setIsDirty(false);
      setSuccessMsg('Journey updated successfully! Rebuilding your connected itinerary...');
      await loadRealTrips();

      setTimeout(() => {
        navigate(`/app/trip/${tripId}/timeline`);
      }, 900);
    } catch (err) {
      console.error('Failed to save journey changes:', err);
      setError(err.message || 'Failed to save journey changes to database.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (isDirty) {
      if (!window.confirm('You have unsaved changes. Are you sure you want to discard them?')) {
        return;
      }
    }
    navigate(`/app/trip/${tripId}/timeline`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Loader2 size={36} className="animate-spin text-primary" />
        <p className="text-sm font-bold text-navy">Loading journey editor...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-20 space-y-6">
      {/* ── Top Header Bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={handleCancel}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-navy px-3 py-1.5 rounded-xl hover:bg-white transition shadow-2xs"
        >
          <ArrowLeft size={14} /> Back to Itinerary
        </button>

        <div className="flex items-center gap-2">
          {isDirty && (
            <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 animate-pulse">
              Unsaved changes
            </span>
          )}
          <button
            onClick={handleCancel}
            disabled={saving}
            className="btn-secondary text-xs px-3.5 py-1.5"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveJourney}
            disabled={saving}
            className="btn-primary text-xs px-4 py-1.5 flex items-center gap-1.5 shadow-sm"
          >
            {saving ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Saving Changes...</span>
              </>
            ) : (
              <>
                <Save size={13} />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Page Title & Trip Meta ── */}
      <div className="rounded-3xl border border-navy/5 bg-white p-5 sm:p-7 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
              Journey Workspace
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-navy mt-1">
              Edit Journey: {trip?.name}
            </h1>
            <p className="text-xs text-ink-soft mt-1">
              Customize day stops, destinations, transport, and sightseeing. Reorder stops to update your chronological timeline.
            </p>
          </div>

          <button
            onClick={() => setNewStopModal(true)}
            className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 text-primary border-primary/20 hover:bg-primary/5"
          >
            <Plus size={14} /> Add New Stop
          </button>
        </div>

        {/* Success or Error Banners */}
        {successMsg && (
          <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
            <span className="font-semibold">{successMsg}</span>
          </div>
        )}
        {error && (
          <div className="mt-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0 text-rose-600" />
            <span className="font-semibold">{error}</span>
          </div>
        )}
      </div>

      {/* ── Journey Stops Editor List ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-ink-faint">
            Day Stops & Movement ({stops.length})
          </h2>
          <span className="text-xs text-ink-faint">
            Use arrows to reorder itinerary sequence
          </span>
        </div>

        {stops.map((stop, idx) => (
          <div
            key={stop.id || idx}
            className={`rounded-2xl border transition-all ${
              stop.isBookingLinked
                ? 'border-sky-200 bg-sky-50/20'
                : 'border-navy/10 bg-white hover:border-navy/20'
            } shadow-xs p-4 sm:p-5`}
          >
            {/* Stop Header Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-navy/5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-navy text-white text-xs font-black shrink-0">
                  {stop.day_number || idx + 1}
                </span>
                <div>
                  <span className="text-xs font-extrabold text-navy">
                    Day {stop.day_number || idx + 1}: {stop.city || 'Unnamed Stop'}
                  </span>
                  {stop.transport && stop.transport !== 'None' && (
                    <span className="text-[11px] text-ink-soft ml-2">
                      via {stop.transport}
                    </span>
                  )}
                </div>
              </div>

              {/* Order Controls & Delete Button */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => moveUp(idx)}
                  disabled={idx === 0}
                  className="p-1.5 rounded-lg text-ink-soft hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition"
                  title="Move Up"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => moveDown(idx)}
                  disabled={idx === stops.length - 1}
                  className="p-1.5 rounded-lg text-ink-soft hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition"
                  title="Move Down"
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => deleteStop(idx)}
                  disabled={stop.isBookingLinked}
                  className="p-1.5 rounded-lg text-ink-faint hover:text-rose-600 hover:bg-rose-50 disabled:opacity-20 transition"
                  title={stop.isBookingLinked ? 'Cannot delete booking-linked stop' : 'Delete Stop'}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Booking Protection Notice */}
            {stop.isBookingLinked && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-sky-50 border border-sky-200/80 px-3 py-2 text-[11px] text-sky-900 font-medium">
                <Lock size={13} className="shrink-0 text-sky-600" />
                <span>
                  This journey item is linked to a confirmed booking. Booking details (flight/hotel/train schedule) cannot be altered through itinerary editing.
                </span>
              </div>
            )}

            {/* Stop Form Inputs */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-bold text-navy mb-1">
                  City / Location / Stop Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <MapPin size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                  <input
                    type="text"
                    value={stop.city || ''}
                    onChange={(e) => handleStopChange(idx, 'city', e.target.value)}
                    placeholder="e.g. Manali, Solang Valley, Delhi"
                    disabled={stop.isBookingLinked}
                    className="w-full rounded-xl border border-navy/10 bg-slate-50/70 py-2 pl-8 pr-3 text-xs text-navy placeholder:text-ink-faint focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-slate-100 disabled:text-ink-soft"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-navy mb-1">
                  Day Assignment
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={stop.day_number || idx + 1}
                  onChange={(e) => handleStopChange(idx, 'day_number', parseInt(e.target.value, 10) || 1)}
                  className="w-full rounded-xl border border-navy/10 bg-slate-50/70 py-2 px-3 text-xs text-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-navy mb-1">
                  Transport to this Stop
                </label>
                <select
                  value={stop.transport || 'None'}
                  onChange={(e) => handleStopChange(idx, 'transport', e.target.value)}
                  disabled={stop.isBookingLinked}
                  className="w-full rounded-xl border border-navy/10 bg-slate-50/70 py-2 px-3 text-xs text-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-slate-100"
                >
                  <option value="None">None (Destination / Base)</option>
                  <option value="Flight">Flight</option>
                  <option value="Train">Train</option>
                  <option value="Bus">Bus</option>
                  <option value="Cab / Transfer">Cab / Transfer</option>
                  <option value="Self Drive">Self Drive</option>
                  <option value="Ferry">Ferry</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-navy mb-1">
                  Route (Optional)
                </label>
                <input
                  type="text"
                  value={stop.route || ''}
                  onChange={(e) => handleStopChange(idx, 'route', e.target.value)}
                  placeholder="e.g. Delhi → Manali"
                  className="w-full rounded-xl border border-navy/10 bg-slate-50/70 py-2 px-3 text-xs text-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-navy mb-1">
                  Activities & Sightseeing Places
                </label>
                <textarea
                  rows={2}
                  value={stop.activities || ''}
                  onChange={(e) => handleStopChange(idx, 'activities', e.target.value)}
                  placeholder="Places to visit, tours, sightseeing stops, or local attractions."
                  className="w-full rounded-xl border border-navy/10 bg-slate-50/70 p-2.5 text-xs text-navy placeholder:text-ink-faint focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-navy mb-1">
                  Notes & Travel Tips
                </label>
                <input
                  type="text"
                  value={stop.notes || ''}
                  onChange={(e) => handleStopChange(idx, 'notes', e.target.value)}
                  placeholder="e.g. Altitude advice, pack warm clothes, ticket booking tips."
                  className="w-full rounded-xl border border-navy/10 bg-slate-50/70 py-2 px-3 text-xs text-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Add Stop Button Bar ── */}
      <div className="text-center pt-2">
        <button
          type="button"
          onClick={() => setNewStopModal(true)}
          className="inline-flex items-center gap-2 rounded-2xl bg-white hover:bg-slate-50 border-2 border-dashed border-navy/15 px-6 py-3 text-xs font-bold text-primary transition shadow-2xs"
        >
          <Plus size={15} /> Add Another Stop to Journey
        </button>
      </div>

      {/* ── Add Stop Modal ── */}
      {newStopModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy/40 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-navy/5">
              <h3 className="text-sm font-bold text-navy">Add New Stop to Journey</h3>
              <button
                onClick={() => setNewStopModal(false)}
                className="text-ink-faint hover:text-navy p-1"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddNewStop} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-navy mb-1">
                  Stop City / Location <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kasol, Solang Valley, Shimla"
                  value={newStopForm.city}
                  onChange={(e) => setNewStopForm((prev) => ({ ...prev, city: e.target.value }))}
                  className="w-full rounded-xl border border-navy/10 bg-slate-50 py-2.5 px-3 text-xs text-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-navy mb-1">
                    Day Number
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newStopForm.day_number}
                    onChange={(e) => setNewStopForm((prev) => ({ ...prev, day_number: e.target.value }))}
                    className="w-full rounded-xl border border-navy/10 bg-slate-50 py-2 px-3 text-xs text-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-navy mb-1">
                    Transport
                  </label>
                  <select
                    value={newStopForm.transport}
                    onChange={(e) => setNewStopForm((prev) => ({ ...prev, transport: e.target.value }))}
                    className="w-full rounded-xl border border-navy/10 bg-slate-50 py-2 px-3 text-xs text-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="None">None</option>
                    <option value="Flight">Flight</option>
                    <option value="Train">Train</option>
                    <option value="Bus">Bus</option>
                    <option value="Cab / Transfer">Cab / Transfer</option>
                    <option value="Drive">Drive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-navy mb-1">
                  Activities / Sightseeing
                </label>
                <textarea
                  rows={2}
                  placeholder="Sightseeing stops, walks, or activities."
                  value={newStopForm.activities}
                  onChange={(e) => setNewStopForm((prev) => ({ ...prev, activities: e.target.value }))}
                  className="w-full rounded-xl border border-navy/10 bg-slate-50 p-2.5 text-xs text-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-navy mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  placeholder="Optional tips or reminders"
                  value={newStopForm.notes}
                  onChange={(e) => setNewStopForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="w-full rounded-xl border border-navy/10 bg-slate-50 py-2 px-3 text-xs text-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-navy/5">
                <button
                  type="button"
                  onClick={() => setNewStopModal(false)}
                  className="btn-secondary text-xs px-3.5 py-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs px-4 py-2"
                >
                  Add Stop
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
