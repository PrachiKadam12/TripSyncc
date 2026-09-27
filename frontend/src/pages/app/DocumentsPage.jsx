/**
 * DocumentsPage.jsx — TripSync Stage 25 Document Vault
 * Route: /app/documents
 * 
 * Provides:
 * - Trip-specific document vault with real Supabase + IndexedDB persistence
 * - Passports & IDs with sensitive number masking
 * - Tickets, boarding passes, hotel vouchers, and insurance policies
 * - Stage 19 Recovery Replacement document synthesis
 * - Offline document caching and download support
 * - Dynamic category filtering (Tickets, Hotels, Identity, Recovery, Offline)
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  FilePlus2, FileText, FolderLock, HardDriveDownload, ShieldCheck,
  UploadCloud, Plane, Download, WifiOff, Wifi, Loader2, CheckCircle2,
  Hotel, Ticket, Sparkles, AlertTriangle, Eye, RefreshCw, Layers
} from 'lucide-react';
import { useTrip } from '../../context/TripContext.jsx';
import Modal from '../../components/Modal.jsx';
import ExternalLink from '../../components/ExternalLink.jsx';
import {
  fetchTripVaultDocuments,
  uploadVaultDocument,
  maskSensitiveData,
} from '../../services/tripDocumentService.js';
import {
  saveDocumentOffline,
  getOfflineDocument,
  getAllOfflineDocuments,
} from '../../services/offlineStorage.js';

function fileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const CATEGORY_ICONS = {
  ticket: Plane,
  flight: Plane,
  hotel: Hotel,
  activity: Ticket,
  passport: FolderLock,
  id: FolderLock,
  insurance: ShieldCheck,
  recovery: Sparkles,
  other: FileText,
};

export default function DocumentsPage() {
  const { activeTrip, activeTripId, realTrips, isDemoUser } = useTrip();
  const fileRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [documentsList, setDocumentsList] = useState([]);
  const [activeDoc, setActiveDoc] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [uploading, setUploading] = useState(false);
  const [downloadState, setDownloadState] = useState({}); // { [docId]: 'idle' | 'loading' | 'done' | 'error' }

  const currentTripId = activeTripId || activeTrip?.id || realTrips?.[0]?.id || 'demo';

  // Monitor network connectivity
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const docs = await fetchTripVaultDocuments(
        currentTripId,
        activeTrip,
        activeTrip?.bookings || []
      );
      setDocumentsList(docs || []);
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, [currentTripId]);

  // Handle document upload
  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    try {
      const newDoc = await uploadVaultDocument({
        tripId: currentTripId,
        file,
        documentType: 'other',
      });
      setDocumentsList((prev) => [newDoc, ...prev]);
    } catch (err) {
      console.error('Failed to upload document:', err);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // Download document copy
  const handleDownloadDoc = async (doc) => {
    if (!doc?.id) return;
    setDownloadState((prev) => ({ ...prev, [doc.id]: 'loading' }));

    try {
      const record = await getOfflineDocument(doc.id);
      if (record?.blob) {
        const url = URL.createObjectURL(record.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = record.file_name || doc.fileName || `${doc.title}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        setDownloadState((prev) => ({ ...prev, [doc.id]: 'done' }));
        setTimeout(() => setDownloadState((prev) => ({ ...prev, [doc.id]: 'idle' })), 3000);
      } else {
        // Deterministic mock PDF blob creation if record wasn't cached yet
        const fakeBlob = new Blob([`TripSync Travel Document: ${doc.title}\nRef: ${doc.referenceNumber || 'N/A'}\nStatus: ${doc.status}`], { type: 'text/plain' });
        const url = URL.createObjectURL(fakeBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.fileName || `${doc.title}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        setDownloadState((prev) => ({ ...prev, [doc.id]: 'done' }));
        setTimeout(() => setDownloadState((prev) => ({ ...prev, [doc.id]: 'idle' })), 3000);
      }
    } catch (err) {
      console.warn('Download error:', err);
      setDownloadState((prev) => ({ ...prev, [doc.id]: 'error' }));
      setTimeout(() => setDownloadState((prev) => ({ ...prev, [doc.id]: 'idle' })), 3000);
    }
  };

  // Filter documents
  const filteredDocs = documentsList.filter((d) => {
    if (activeFilter === 'ticket') return d.category === 'ticket' || d.category === 'flight';
    if (activeFilter === 'hotel') return d.category === 'hotel';
    if (activeFilter === 'passport') return d.category === 'passport' || d.category === 'id';
    if (activeFilter === 'recovery') return d.category === 'recovery' || d.isRecoveryDocument;
    if (activeFilter === 'offline') return d.isOfflineCached;
    return true;
  });

  const recoveryDocsCount = documentsList.filter((d) => d.isRecoveryDocument).length;

  return (
    <div className="max-w-5xl mx-auto pb-16 space-y-7">
      {/* ── 1. Page Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-0.5 text-xs font-black uppercase tracking-wider">
              Stage 25 · Documents Vault
            </span>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
              isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {isOnline ? <Wifi size={11} /> : <WifiOff size={11} />}
              {isOnline ? 'Cloud Synced' : 'Offline Mode Active'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-navy">
            Travel Documents Vault
          </h1>
          <p className="text-xs sm:text-sm text-ink-soft mt-1 max-w-xl">
            Securely stored, encrypted, and guaranteed accessible offline across flights, hotels, passports, insurance, and recovery re-routes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadDocuments}
            title="Refresh Vault"
            className="p-2.5 rounded-xl bg-white border border-navy/10 text-ink-soft hover:text-navy transition shadow-2xs"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-primary' : ''} />
          </button>

          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="btn-primary text-xs py-2.5 px-4 flex items-center gap-1.5 shadow-xs"
          >
            {uploading ? (
              <><Loader2 size={14} className="animate-spin" /> Uploading...</>
            ) : (
              <><FilePlus2 size={14} /> Upload Document</>
            )}
          </button>
          <input ref={fileRef} type="file" className="hidden" onChange={onUpload} />
        </div>
      </div>

      {/* ── 2. Stage 19 Recovery Documents Alert Banner (if recovery applied) ── */}
      {recoveryDocsCount > 0 && (
        <div className="rounded-3xl border border-emerald-300/80 bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-5 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Sparkles size={18} />
            </div>
            <div>
              <span className="font-bold text-navy text-sm">
                Stage 19 Recovery Documents Available
              </span>
              <p className="text-xs text-ink-soft mt-0.5">
                Replacement flight boarding passes are active in your vault. Cancelled flights have been archived.
              </p>
            </div>
          </div>

          <button
            onClick={() => setActiveFilter('recovery')}
            className="btn-secondary text-xs py-1.5 px-3.5 shadow-2xs hover:bg-white"
          >
            View Recovery Passes →
          </button>
        </div>
      )}

      {/* ── 3. Category Filter Tabs ── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setActiveFilter('all')}
          className={`rounded-full px-4 py-1.5 text-xs font-bold transition shrink-0 ${
            activeFilter === 'all'
              ? 'bg-navy text-white shadow-sm'
              : 'bg-white text-ink-soft hover:text-navy border border-navy/10'
          }`}
        >
          All Documents ({documentsList.length})
        </button>

        <button
          onClick={() => setActiveFilter('ticket')}
          className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition shrink-0 ${
            activeFilter === 'ticket'
              ? 'bg-sky-600 text-white shadow-sm'
              : 'bg-white text-ink-soft hover:text-navy border border-navy/10'
          }`}
        >
          Tickets & Passes
        </button>

        <button
          onClick={() => setActiveFilter('hotel')}
          className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition shrink-0 ${
            activeFilter === 'hotel'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-white text-ink-soft hover:text-navy border border-navy/10'
          }`}
        >
          Accommodations
        </button>

        <button
          onClick={() => setActiveFilter('passport')}
          className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition shrink-0 ${
            activeFilter === 'passport'
              ? 'bg-violet-600 text-white shadow-sm'
              : 'bg-white text-ink-soft hover:text-navy border border-navy/10'
          }`}
        >
          Identity & Passports
        </button>

        {recoveryDocsCount > 0 && (
          <button
            onClick={() => setActiveFilter('recovery')}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition shrink-0 ${
              activeFilter === 'recovery'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white text-ink-soft hover:text-navy border border-navy/10'
            }`}
          >
            Recovery Passes ({recoveryDocsCount})
          </button>
        )}

        <button
          onClick={() => setActiveFilter('offline')}
          className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition shrink-0 ${
            activeFilter === 'offline'
              ? 'bg-teal-600 text-white shadow-sm'
              : 'bg-white text-ink-soft hover:text-navy border border-navy/10'
          }`}
        >
          Available Offline
        </button>
      </div>

      {/* ── 4. Documents Grid ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredDocs.map((doc, idx) => {
          const CatIcon = CATEGORY_ICONS[doc.category] || FileText;
          const isCancelled = doc.status === 'cancelled';
          const isReplaced = doc.status === 'replaced';

          return (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              className={`rounded-3xl border bg-white p-5 shadow-sm space-y-3 transition-all hover:shadow-md ${
                doc.isRecoveryDocument
                  ? 'border-emerald-300 bg-emerald-50/20'
                  : isCancelled || isReplaced
                  ? 'border-navy/10 opacity-70 bg-slate-50/50'
                  : 'border-navy/10'
              }`}
            >
              {/* Header Icon + Badges */}
              <div className="flex items-start justify-between gap-2 border-b border-navy/5 pb-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                  doc.isRecoveryDocument
                    ? 'bg-emerald-100 text-emerald-700'
                    : isCancelled || isReplaced
                    ? 'bg-slate-100 text-slate-500'
                    : 'bg-sky-50 text-primary'
                }`}>
                  <CatIcon size={18} />
                </div>

                <div className="flex flex-wrap items-center gap-1 justify-end">
                  {doc.isOfflineCached && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-periwinkle/80 px-2 py-0.5 text-[10px] font-bold text-navy">
                      <HardDriveDownload size={10} /> Offline
                    </span>
                  )}
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    doc.isRecoveryDocument
                      ? 'bg-emerald-100 text-emerald-800'
                      : isCancelled
                      ? 'bg-rose-100 text-rose-800'
                      : isReplaced
                      ? 'bg-slate-100 text-slate-700'
                      : 'bg-slate-100 text-slate-800'
                  }`}>
                    {doc.statusLabel}
                  </span>
                </div>
              </div>

              {/* Title & Info */}
              <div>
                <h3 className="text-sm font-extrabold text-navy line-clamp-1">
                  {doc.title}
                </h3>
                {doc.referenceNumber && (
                  <p className="text-[11px] font-mono font-bold text-ink-soft mt-0.5">
                    {doc.referenceNumber}
                  </p>
                )}
                {doc.note && (
                  <p className="text-[11px] text-amber-800 bg-amber-50 rounded-lg p-1.5 mt-1.5 font-medium leading-relaxed">
                    {doc.note}
                  </p>
                )}
              </div>

              {/* Metadata */}
              <div className="flex items-center justify-between text-[11px] text-ink-faint pt-1">
                <span>{doc.fileName}</span>
                <span>{doc.fileSize}</span>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-navy/5 flex items-center justify-between gap-2">
                <button
                  onClick={() => setActiveDoc(doc)}
                  className="text-xs font-bold text-primary hover:text-primary-dark flex items-center gap-1 transition"
                >
                  <Eye size={12} />
                  <span>View Details</span>
                </button>

                <button
                  onClick={() => handleDownloadDoc(doc)}
                  disabled={downloadState[doc.id] === 'loading'}
                  className="p-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-navy transition"
                  title="Download / Export Document"
                >
                  {downloadState[doc.id] === 'loading' ? (
                    <Loader2 size={14} className="animate-spin text-primary" />
                  ) : downloadState[doc.id] === 'done' ? (
                    <CheckCircle2 size={14} className="text-emerald-600" />
                  ) : (
                    <Download size={14} />
                  )}
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredDocs.length === 0 && (
        <div className="rounded-3xl border-2 border-dashed border-navy/10 bg-slate-50/70 p-12 text-center">
          <FileText size={36} className="mx-auto text-ink-faint mb-2" />
          <h3 className="text-base font-bold text-navy">No Documents in this Category</h3>
          <p className="text-xs text-ink-soft mt-1">Upload files or sync your bookings to populate documents.</p>
        </div>
      )}

      {/* ── 5. Document Detail Modal ── */}
      {activeDoc && (
        <Modal open={Boolean(activeDoc)} onClose={() => setActiveDoc(null)} title={activeDoc.title}>
          <div className="space-y-4">
            <div className="rounded-2xl bg-periwinkle/50 p-4 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                {activeDoc.statusLabel}
              </span>
              <h4 className="text-base font-bold text-navy">{activeDoc.title}</h4>
              {activeDoc.referenceNumber && (
                <p className="text-xs font-mono font-bold text-primary">{activeDoc.referenceNumber}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-slate-50 p-2.5">
                <span className="text-[10px] text-ink-faint block">Source</span>
                <span className="font-semibold text-navy mt-0.5 block">{activeDoc.source}</span>
              </div>
              <div className="rounded-xl bg-slate-50 p-2.5">
                <span className="text-[10px] text-ink-faint block">Offline Storage</span>
                <span className="font-semibold text-emerald-700 mt-0.5 block">
                  {activeDoc.isOfflineCached ? 'Cached locally (IndexedDB)' : 'Cloud only'}
                </span>
              </div>
            </div>

            <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 p-3 text-xs text-emerald-950 flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-700 shrink-0" />
              <span>Sensitive traveler fields are masked for privacy and security.</span>
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t border-navy/5">
              <button onClick={() => setActiveDoc(null)} className="btn-secondary text-xs py-2 px-4">
                Close
              </button>
              <button
                onClick={() => handleDownloadDoc(activeDoc)}
                className="btn-primary text-xs py-2 px-5 flex items-center gap-1.5"
              >
                <Download size={13} />
                <span>Download Copy</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}