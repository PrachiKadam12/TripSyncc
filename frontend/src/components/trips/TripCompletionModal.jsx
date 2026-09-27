/**
 * TripCompletionModal.jsx — TripSync Stage 26 Trip Completion Modal
 * 
 * Shows a pre-completion summary (destination, dates, recovery plan applied,
 * preserved items, and major changes), confirms completion, and archives the trip.
 */

import { useState } from 'react';
import {
  CheckCircle2, Sparkles, MapPin, CalendarDays, ShieldCheck,
  Plane, ArrowRight, Loader2, Award, Clock
} from 'lucide-react';
import Modal from '../Modal.jsx';
import { completeTrip } from '../../services/tripCompletionService.js';

export default function TripCompletionModal({
  open,
  onClose,
  trip,
  completionSummary,
  onTripCompleted,
}) {
  const [isCompleting, setIsCompleting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  if (!open || !trip) return null;

  const summary = completionSummary || {
    title: trip.name || trip.title || 'Connected Trip',
    origin: trip.origin_city || 'Mumbai',
    destination: trip.destination_city || 'Manali',
    datesFormatted: '12 – 18 Sep 2026',
    totalItemsCount: 5,
    preservedCount: 4,
    hasRecovery: false,
  };

  const handleConfirmCompletion = async () => {
    setIsCompleting(true);
    setError('');
    try {
      await completeTrip({ tripId: trip.id });
      setIsSuccess(true);
      if (onTripCompleted) {
        onTripCompleted(trip.id);
      }
    } catch (err) {
      console.error('Error completing trip:', err);
      setError(err.message || 'Could not complete trip.');
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} size="md">
      <div className="space-y-5">
        {!isSuccess ? (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-navy/10 pb-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Award size={24} />
              </div>
              <div>
                <span className="rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider">
                  Stage 26 · Journey Milestone
                </span>
                <h2 className="text-xl font-black text-navy mt-0.5">Complete Your Trip</h2>
              </div>
            </div>

            {/* Trip Details Box */}
            <div className="rounded-2xl bg-slate-50 border border-navy/5 p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-navy text-sm">{summary.title}</span>
                <span className="rounded-full bg-sky-100 text-sky-800 px-2.5 py-0.5 text-[10px] font-bold">
                  {summary.origin} → {summary.destination}
                </span>
              </div>
              <p className="text-ink-soft flex items-center gap-1.5">
                <CalendarDays size={13} className="text-primary" />
                <span>{summary.datesFormatted}</span>
              </p>
            </div>

            {/* Recovery & Journey Highlights */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-periwinkle/40 p-3">
                <span className="text-[10px] font-bold uppercase text-ink-faint block">Itinerary Items</span>
                <span className="text-sm font-extrabold text-navy mt-0.5 block">
                  {summary.totalItemsCount} Total Items
                </span>
                <span className="text-[10px] text-emerald-700 font-semibold block">
                  {summary.preservedCount} Preserved & Completed
                </span>
              </div>

              <div className="rounded-xl bg-periwinkle/40 p-3">
                <span className="text-[10px] font-bold uppercase text-ink-faint block">Resilience Status</span>
                <span className="text-sm font-extrabold text-navy mt-0.5 block">
                  {summary.hasRecovery ? `${summary.recoveryStrategy || 'Recovered'} Plan` : 'No Disruptions'}
                </span>
                <span className="text-[10px] text-ink-soft block">
                  {summary.hasRecovery ? 'Replacement Applied ✓' : 'Direct Journey'}
                </span>
              </div>
            </div>

            {/* Notice */}
            <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 p-3 text-xs text-emerald-950 flex items-start gap-2">
              <ShieldCheck size={16} className="text-emerald-700 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Completing your trip moves it to <strong>My Trips → Completed</strong>. All final itinerary details, recovery history, tickets, and documents remain permanently saved and accessible.
              </p>
            </div>

            {error && (
              <p className="text-xs text-rose-600 font-semibold">{error}</p>
            )}

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end gap-2 border-t border-navy/5">
              <button
                onClick={onClose}
                disabled={isCompleting}
                className="btn-secondary text-xs py-2 px-4"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCompletion}
                disabled={isCompleting}
                className="btn-primary text-xs py-2 px-5 flex items-center gap-1.5 shadow-xs"
              >
                {isCompleting ? (
                  <><Loader2 size={13} className="animate-spin" /> Completing...</>
                ) : (
                  <><CheckCircle2 size={13} /> Confirm & Complete Trip</>
                )}
              </button>
            </div>
          </>
        ) : (
          /* Success Completed State */
          <div className="py-6 text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
              <CheckCircle2 size={36} />
            </div>

            <div>
              <span className="rounded-full bg-emerald-100 text-emerald-800 px-3 py-1 text-xs font-black uppercase tracking-wider">
                Trip Completed!
              </span>
              <h2 className="text-xl font-black text-navy mt-2">
                Congratulations on Completing Your Journey!
              </h2>
              <p className="text-xs text-ink-soft max-w-sm mx-auto mt-1">
                Your trip <strong>"{summary.title}"</strong> is now archived in your Completed Trips vault.
              </p>
            </div>

            <div className="pt-3 flex justify-center gap-3">
              <button
                onClick={() => {
                  onClose();
                  setIsSuccess(false);
                }}
                className="btn-primary text-xs py-2 px-6"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
