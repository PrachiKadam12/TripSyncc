/**
 * ReportIssueModal.jsx — TripSync Stage 12 Risk / Disruption Modal
 * Allows traveler to report an issue/disruption against any journey item or trip.
 * Supports offline queuing and document upload.
 */

import { useState, useEffect } from 'react';
import {
  AlertTriangle, X, Clock, FileText, UploadCloud,
  CheckCircle2, ShieldAlert, WifiOff, Loader2, ArrowRight
} from 'lucide-react';
import Modal from '../Modal.jsx';
import { reportDisruption, calculateRiskSeverity } from '../../services/itineraryService.js';
import { useAuth } from '../../context/AuthContext.jsx';

export const DISRUPTION_CATEGORIES = [
  'Flight Delay',
  'Flight Cancellation',
  'Missed Connection',
  'Train Delay',
  'Train Cancellation',
  'Bus Delay',
  'Transfer Delay',
  'Hotel Issue',
  'Activity Cancellation',
  'Road / Route Disruption',
  'Weather Disruption',
  'Airport / Station Disruption',
  'Other',
];

export default function ReportIssueModal({
  open,
  onClose,
  tripId,
  journeyItems = [],
  preselectedItem = null,
  onDisruptionReported,
}) {
  const { user } = useAuth();

  const [selectedItemId, setSelectedItemId] = useState('');
  const [disruptionType, setDisruptionType] = useState('Flight Delay');
  const [status, setStatus] = useState('reported');
  const [delayMinutes, setDelayMinutes] = useState('');
  const [occurredAt, setOccurredAt] = useState('');
  const [description, setDescription] = useState('');
  const [documentFile, setDocumentFile] = useState(null);
  const [confirmedCorrect, setConfirmedCorrect] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);

  // Sync online/offline status
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

  // Set default affected item whenever modal opens
  useEffect(() => {
    if (open) {
      if (preselectedItem?.id) {
        setSelectedItemId(preselectedItem.id);
        if (preselectedItem.itemType === 'hotel') {
          setDisruptionType('Hotel Issue');
        } else if (preselectedItem.itemType === 'train') {
          setDisruptionType('Train Delay');
        } else if (preselectedItem.itemType === 'bus') {
          setDisruptionType('Bus Delay');
        } else if (preselectedItem.itemType === 'activity') {
          setDisruptionType('Activity Cancellation');
        } else {
          setDisruptionType('Flight Delay');
        }
      } else if (journeyItems.length > 0 && !selectedItemId) {
        setSelectedItemId(journeyItems[0].id);
      }
      setOccurredAt(new Date().toISOString().slice(0, 16));
      setError('');
      setConfirmedCorrect(false);
    }
  }, [open, preselectedItem, journeyItems]);

  const currentItem = journeyItems.find((it) => it.id === selectedItemId) || preselectedItem || journeyItems[0];
  const severityPreview = calculateRiskSeverity(disruptionType, delayMinutes);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentItem) {
      setError('Please select an affected journey item.');
      return;
    }
    if (!confirmedCorrect) {
      setError('Please confirm that the information provided is correct.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await reportDisruption({
        tripId,
        affectedItemId: currentItem.rawId || currentItem.id,
        affectedBookingId: currentItem.booking_id || (currentItem.source === 'booking' ? currentItem.rawId : null),
        affectedTitle: currentItem.title,
        disruptionType,
        description: description.trim(),
        expectedDelayMinutes: delayMinutes ? parseInt(delayMinutes, 10) : 0,
        occurredAt: occurredAt ? new Date(occurredAt).toISOString() : new Date().toISOString(),
        severity: severityPreview,
        documentFile,
        userId: user?.id,
      });

      if (onDisruptionReported) {
        onDisruptionReported(res.disruption);
      }

      onClose();
    } catch (err) {
      console.error('Failed to report disruption:', err);
      setError(err.message || 'Could not submit issue. Please check connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Report a Travel Issue" wide>
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {/* Offline notice if disconnected */}
        {isOffline && (
          <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
            <WifiOff size={15} className="shrink-0 text-amber-600" />
            <div>
              <span className="font-bold">You are currently offline. </span>
              Your report will be stored safely on this device with <span className="font-semibold underline">Pending sync</span> status and automatically uploaded when connectivity returns.
            </div>
          </div>
        )}

        {/* Affected Item Selection */}
        <div>
          <label className="block text-xs font-bold text-navy mb-1">
            Affected Journey Item <span className="text-rose-500">*</span>
          </label>
          <select
            value={selectedItemId}
            onChange={(e) => setSelectedItemId(e.target.value)}
            className="w-full rounded-xl border border-navy/10 bg-slate-50 py-2.5 px-3 text-xs font-semibold text-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {journeyItems.map((item) => (
              <option key={item.id} value={item.id}>
                [{item.itemType?.toUpperCase()}] {item.title} {item.dateStr ? `(${item.dateStr})` : ''}
              </option>
            ))}
          </select>
          {currentItem?.location && (
            <p className="mt-1 text-[11px] text-ink-faint">
              Location: {currentItem.location}
            </p>
          )}
        </div>

        {/* Disruption Category & Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-navy mb-1">
              Issue Category <span className="text-rose-500">*</span>
            </label>
            <select
              value={disruptionType}
              onChange={(e) => setDisruptionType(e.target.value)}
              className="w-full rounded-xl border border-navy/10 bg-slate-50 py-2.5 px-3 text-xs font-semibold text-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {DISRUPTION_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-navy mb-1">
              Report Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-xl border border-navy/10 bg-slate-50 py-2.5 px-3 text-xs font-semibold text-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="reported">Reported (Active)</option>
              <option value="confirmed">Confirmed</option>
            </select>
          </div>
        </div>

        {/* Expected Delay & Date/Time */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-navy mb-1">
              Expected Delay (minutes) <span className="text-ink-faint font-normal">(optional)</span>
            </label>
            <div className="relative">
              <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
              <input
                type="number"
                min="0"
                step="5"
                placeholder="e.g. 90 or 120"
                value={delayMinutes}
                onChange={(e) => setDelayMinutes(e.target.value)}
                className="w-full rounded-xl border border-navy/10 bg-slate-50 py-2.5 pl-8 pr-3 text-xs text-navy placeholder:text-ink-faint focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            {delayMinutes > 0 && (
              <p className="mt-1 text-[11px] text-ink-soft">
                ≈ {Math.floor(delayMinutes / 60)}h {delayMinutes % 60}m delay
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-navy mb-1">
              Issue Detected / Occurred At
            </label>
            <input
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              className="w-full rounded-xl border border-navy/10 bg-slate-50 py-2.5 px-3 text-xs text-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-bold text-navy mb-1">
            Description & Context <span className="text-ink-faint font-normal">(optional)</span>
          </label>
          <textarea
            rows={3}
            placeholder="Explain what happened (e.g. Flight delayed by 2 hours due to weather; connecting transfer may be tight)."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-xl border border-navy/10 bg-slate-50 p-3 text-xs text-navy placeholder:text-ink-faint focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Document / Supporting Photo Upload */}
        <div>
          <label className="block text-xs font-bold text-navy mb-1">
            Attach Document / Photo / Proof <span className="text-ink-faint font-normal">(optional)</span>
          </label>
          <div className="flex items-center gap-3">
            <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-slate-100 hover:bg-slate-200 px-3 py-2 text-xs font-semibold text-navy transition">
              <UploadCloud size={14} className="text-primary" />
              <span>{documentFile ? 'Change File' : 'Choose File'}</span>
              <input
                type="file"
                className="hidden"
                accept=".pdf,image/png,image/jpeg,image/webp"
                onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
              />
            </label>
            {documentFile ? (
              <span className="text-xs text-navy font-medium truncate max-w-xs flex items-center gap-1">
                <FileText size={13} className="text-emerald-600" />
                {documentFile.name} ({(documentFile.size / 1024).toFixed(0)} KB)
              </span>
            ) : (
              <span className="text-xs text-ink-faint">PDF or image of boarding pass / delay notice</span>
            )}
          </div>
        </div>

        {/* Severity Preview Badge */}
        <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-navy/5 p-3 text-xs">
          <div className="flex items-center gap-2">
            <ShieldAlert size={15} className="text-amber-600" />
            <span className="font-semibold text-navy">Assessed Risk Severity:</span>
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
              severityPreview === 'critical'
                ? 'bg-rose-100 text-rose-800'
                : severityPreview === 'high'
                  ? 'bg-orange-100 text-orange-800'
                  : severityPreview === 'medium'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            {severityPreview}
          </span>
        </div>

        {/* Confirmation Checkbox */}
        <div className="pt-1">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmedCorrect}
              onChange={(e) => setConfirmedCorrect(e.target.checked)}
              className="mt-0.5 rounded border-navy/20 text-primary focus:ring-primary h-4 w-4"
            />
            <span className="text-xs text-ink-soft select-none">
              <span className="font-semibold text-navy">Is this information correct? </span>
              I confirm this issue accurately describes the travel disruption affecting my journey.
            </span>
          </label>
        </div>

        {/* Error message */}
        {error && (
          <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 flex items-start gap-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-navy/5">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="btn-secondary text-xs px-4 py-2"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary text-xs px-5 py-2 flex items-center gap-1.5"
          >
            {submitting ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Recording Issue...</span>
              </>
            ) : (
              <>
                <AlertTriangle size={13} />
                <span>Report Issue</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
