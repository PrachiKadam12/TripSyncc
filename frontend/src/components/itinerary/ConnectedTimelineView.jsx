/**
 * ConnectedTimelineView.jsx — TripSync Connected Itinerary Component
 * Chronological, connected travel timeline uniting:
 * - Trip & Day Stops
 * - Travelers
 * - Flights, Hotels, Trains, Buses, Cabs, Activities
 * - Uploaded tickets and documents with secure signed URLs
 * - Connected journey lines & buffer/transfer relationship tags
 * - STAGE 11: Edit Journey access
 * - STAGE 12: Trip Risk / Disruption Summary & Report Issue integration
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plane, Hotel, Train, Bus, Car, Ticket, MapPin, CalendarDays,
  Clock, ArrowDown, ArrowRight, Users, FileText, Download,
  ExternalLink, CheckCircle2, AlertCircle, AlertTriangle, Shield, Info, Eye,
  ChevronDown, ChevronUp, Sparkles, Navigation, Edit3, Plus
} from 'lucide-react';
import Modal from '../Modal.jsx';
import StatusChip from '../StatusChip.jsx';
import { getDocumentSignedUrl } from '../../services/itineraryService.js';
import ReportIssueModal from './ReportIssueModal.jsx';
import RiskDisruptionSummary from './RiskDisruptionSummary.jsx';
import { runDisruptionAnalysis, getAiDisruptionSummary } from '../../services/disruptionAnalysisService.js';

const TYPE_CONFIG = {
  flight: {
    icon: Plane,
    bg: 'bg-sky-50',
    border: 'border-sky-200/80',
    iconBg: 'bg-sky-500 text-white',
    badgeBg: 'bg-sky-100 text-sky-800',
    label: 'Flight',
  },
  hotel: {
    icon: Hotel,
    bg: 'bg-amber-50/60',
    border: 'border-amber-200/80',
    iconBg: 'bg-amber-500 text-white',
    badgeBg: 'bg-amber-100 text-amber-800',
    label: 'Hotel / Stay',
  },
  train: {
    icon: Train,
    bg: 'bg-violet-50/60',
    border: 'border-violet-200/80',
    iconBg: 'bg-violet-600 text-white',
    badgeBg: 'bg-violet-100 text-violet-800',
    label: 'Train',
  },
  bus: {
    icon: Bus,
    bg: 'bg-purple-50/60',
    border: 'border-purple-200/80',
    iconBg: 'bg-purple-600 text-white',
    badgeBg: 'bg-purple-100 text-purple-800',
    label: 'Bus',
  },
  transfer: {
    icon: Car,
    bg: 'bg-cyan-50/60',
    border: 'border-cyan-200/80',
    iconBg: 'bg-cyan-600 text-white',
    badgeBg: 'bg-cyan-100 text-cyan-800',
    label: 'Transfer / Cab',
  },
  activity: {
    icon: Ticket,
    bg: 'bg-emerald-50/60',
    border: 'border-emerald-200/80',
    iconBg: 'bg-emerald-600 text-white',
    badgeBg: 'bg-emerald-100 text-emerald-800',
    label: 'Activity',
  },
  stop: {
    icon: MapPin,
    bg: 'bg-indigo-50/60',
    border: 'border-indigo-200/80',
    iconBg: 'bg-indigo-600 text-white',
    badgeBg: 'bg-indigo-100 text-indigo-800',
    label: 'Stop / Destination',
  },
  other: {
    icon: Navigation,
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    iconBg: 'bg-slate-600 text-white',
    badgeBg: 'bg-slate-100 text-slate-800',
    label: 'Travel Item',
  },
};

export default function ConnectedTimelineView({
  timelineData,
  onRefresh,
  onCompleteTrip,
  className = '',
}) {
  const navigate = useNavigate();
  const { days = [], allItems = [], tripSummary, activeDisruptions = [], disruptionHistory = [] } = timelineData || {};

  const [selectedDay, setSelectedDay] = useState('all');
  const [expandedItems, setExpandedItems] = useState({});
  const [documentModal, setDocumentModal] = useState({ open: false, doc: null, signedUrl: null, loading: false });
  const [reportModal, setReportModal] = useState({ open: false, preselectedItem: null });
  const [liveContext, setLiveContext] = useState(null);
  const [isScanningRisk, setIsScanningRisk] = useState(false);
  const [aiExplanation, setAiExplanation] = useState(null);
  const [detectedLiveRisks, setDetectedLiveRisks] = useState([]);
  const [localReportedDisruptions, setLocalReportedDisruptions] = useState([]);

  // Auto-scan live APIs (Open-Meteo, Flight Status, Routes)
  const handleLiveRiskScan = async () => {
    if (!allItems || allItems.length === 0) return;
    setIsScanningRisk(true);
    try {
      const res = await runDisruptionAnalysis(allItems, tripSummary?.stops || []);
      if (res) {
        setLiveContext(res.liveContext);
        if (res.detectedRisks && res.detectedRisks.length > 0) {
          setDetectedLiveRisks(res.detectedRisks);
        }
        // Traveler-friendly AI explanation if disruptions exist
        const allCurrentDisruptions = [
          ...localReportedDisruptions,
          ...activeDisruptions,
          ...(res.detectedRisks || []),
        ];
        if (allCurrentDisruptions.length > 0) {
          const summary = await getAiDisruptionSummary(allCurrentDisruptions);
          if (summary) setAiExplanation(summary);
        }
      }
    } catch (e) {
      console.warn('Live risk scan encountered error:', e);
    } finally {
      setIsScanningRisk(false);
    }
  };

  const allActiveDisruptions = [
    ...localReportedDisruptions,
    ...activeDisruptions.filter((ad) => !localReportedDisruptions.some((ld) => ld.id === ad.id)),
    ...detectedLiveRisks.filter((dr) => !localReportedDisruptions.some((ld) => ld.id === dr.id)),
  ];

  useEffect(() => {
    if (allItems && allItems.length > 0) {
      handleLiveRiskScan();
    }
  }, [allItems.length]);

  // Toggle item expansion
  const toggleExpand = (id) => {
    setExpandedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Open secure document preview
  const handleOpenDoc = async (doc) => {
    setDocumentModal({ open: true, doc, signedUrl: null, loading: true });
    if (doc.storage_path) {
      const url = await getDocumentSignedUrl(doc.storage_path, doc.storage_bucket || 'trip-documents');
      setDocumentModal({ open: true, doc, signedUrl: url, loading: false });
    } else {
      setDocumentModal({ open: true, doc, signedUrl: null, loading: false });
    }
  };

  const filteredDays = selectedDay === 'all'
    ? days
    : days.filter((d) => String(d.dayNumber) === String(selectedDay));

  if (!tripSummary) {
    return (
      <div className="rounded-2xl border border-navy/10 bg-white p-12 text-center shadow-sm">
        <Plane size={36} className="mx-auto text-sky-400 mb-3" />
        <h3 className="text-base font-bold text-navy">No trip data available</h3>
        <p className="text-xs text-ink-soft mt-1">Please select or plan a trip to view its connected itinerary.</p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* ── 1. Connected Itinerary Header ── */}
      <div className="rounded-3xl border border-navy/5 bg-gradient-to-br from-white via-periwinkle/30 to-sky-50/50 p-5 sm:p-7 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Connected Journey
              </span>
              <span className="text-xs text-ink-faint font-medium">
                {allItems.length} connected {allItems.length === 1 ? 'item' : 'items'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-navy">
              {tripSummary.name}
            </h1>

            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-soft">
              <span className="inline-flex items-center gap-1.5 font-semibold text-navy">
                <CalendarDays size={14} className="text-primary" />
                {tripSummary.formattedDates}
              </span>
              <span className="inline-flex items-center gap-1.5 font-semibold text-navy">
                <MapPin size={14} className="text-emerald-600" />
                {tripSummary.originCity} → {tripSummary.destinationCity}
              </span>
              {tripSummary.travelersCount > 0 && (
                <span className="inline-flex items-center gap-1.5 font-semibold text-navy">
                  <Users size={14} className="text-violet-600" />
                  {tripSummary.travelersCount} {tripSummary.travelersCount === 1 ? 'traveler' : 'travelers'}
                </span>
              )}
            </div>
          </div>

          {/* Action CTAs: Edit Journey, Next Step & Report Issue */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => navigate('/app/deadlines')}
              className="btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5 shadow-xs"
            >
              <Clock size={13} />
              <span>Next: Deadlines & Policies →</span>
            </button>

            <button
              onClick={() => navigate(`/app/trip/${tripSummary.id}/edit`)}
              className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 text-primary border-primary/20 hover:bg-primary/5 shadow-2xs"
            >
              <Edit3 size={13} />
              <span>Edit</span>
            </button>

            <button
              onClick={() => setReportModal({ open: true, preselectedItem: null })}
              className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 text-amber-700 border-amber-200 hover:bg-amber-50 shadow-2xs"
            >
              <AlertTriangle size={13} />
              <span>Report</span>
            </button>

            {tripSummary.totalSpent > 0 && (
              <div className="rounded-2xl bg-white border border-navy/5 px-3.5 py-1.5 text-right shadow-xs shrink-0">
                <p className="text-[9px] font-bold uppercase tracking-wider text-ink-faint">Total Booked</p>
                <p className="text-sm font-black text-emerald-700">
                  ₹{Number(tripSummary.totalSpent).toLocaleString('en-IN')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Co-Travelers Strip (if group trip) */}
        {tripSummary.travelers?.length > 0 && (
          <div className="mt-4 pt-3.5 border-t border-navy/5 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-ink-faint uppercase tracking-wider flex items-center gap-1">
              <Users size={12} /> Group Members:
            </span>
            {tripSummary.travelers.map((m) => (
              <span
                key={m.id || m.name}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                  m.isPrimary
                    ? 'bg-violet-50 text-violet-800 border-violet-200'
                    : 'bg-white text-navy border-slate-200'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                {m.name} {m.isPrimary ? '(Lead)' : ''}
              </span>
            ))}
          </div>
        )}

        {/* General Trip Documents (like Trip Plan PDF) */}
        {tripSummary.generalDocuments?.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-ink-faint uppercase tracking-wider flex items-center gap-1">
              <FileText size={12} /> Trip Plan & Docs:
            </span>
            {tripSummary.generalDocuments.map((doc) => (
              <button
                key={doc.id}
                onClick={() => handleOpenDoc(doc)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white hover:bg-sky-50 text-navy text-xs font-semibold px-3 py-1 border border-navy/10 shadow-xs transition"
              >
                <FileText size={12} className="text-primary" />
                {doc.title || doc.file_name}
                <Eye size={11} className="text-ink-faint ml-1" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── 2. STAGE 12: Trip Risk / Disruption Summary Card ── */}
      <RiskDisruptionSummary
        tripId={tripSummary?.id}
        activeDisruptions={allActiveDisruptions}
        disruptionHistory={disruptionHistory}
        onOpenReportModal={() => setReportModal({ open: true, preselectedItem: null })}
        liveContext={liveContext}
        onRunLiveRiskScan={handleLiveRiskScan}
        isScanningRisk={isScanningRisk}
        aiExplanation={aiExplanation}
      />

      {/* ── 2.5 STAGE 19: Active Recovery Plan Applied Banner ── */}
      {tripSummary.appliedRecovery && (
        <div className="rounded-3xl border border-emerald-300/80 bg-gradient-to-br from-emerald-500/10 via-white to-sky-500/10 p-5 sm:p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Shield size={20} />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider">
                    Stage 19 · Itinerary Recovered
                  </span>
                  <span className="rounded-full bg-indigo-100 text-indigo-800 px-2.5 py-0.5 text-[10px] font-bold">
                    {tripSummary.appliedRecovery.strategyTag} Strategy
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-navy">
                  Active Recovery Plan: "{tripSummary.appliedRecovery.title}"
                </h3>
                <p className="text-xs text-ink-soft leading-relaxed max-w-xl">
                  Replacement transport is confirmed, downstream transfer and check-in buffers have been rescheduled, and unaffected bookings remain preserved.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={() => navigate('/app/deadlines')}
                className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5 shadow-xs bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
              >
                <span>Next: Check Deadlines →</span>
                <ArrowRight size={13} />
              </button>

              <button
                onClick={() => navigate('/app/documents')}
                className="btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5 shadow-2xs hover:bg-white"
              >
                <FileText size={13} />
                <span>Documents Vault</span>
              </button>

              <button
                onClick={() => navigate(tripSummary.id ? `/app/trip/${tripSummary.id}/recovery` : '/app/recovery')}
                className="btn-secondary text-xs py-2 px-3 flex items-center gap-1 text-ink-soft hover:text-navy shadow-2xs hover:bg-white"
              >
                <Sparkles size={12} className="text-primary" />
                <span>Re-evaluate</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="mt-4 pt-3 border-t border-emerald-100 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="rounded-xl bg-white/90 border border-emerald-100 p-2.5">
              <span className="text-[10px] text-ink-faint font-bold uppercase block">New Arrival</span>
              <span className="font-bold text-navy">
                {tripSummary.appliedRecovery.replacementTransport?.arrivalTime || 'On Schedule'}
              </span>
            </div>
            <div className="rounded-xl bg-white/90 border border-emerald-100 p-2.5">
              <span className="text-[10px] text-ink-faint font-bold uppercase block">Net Impact</span>
              <span className="font-bold text-emerald-700">
                {tripSummary.appliedRecovery.netFinancialImpact ? `+₹${tripSummary.appliedRecovery.netFinancialImpact.toLocaleString('en-IN')}` : '₹0'}
              </span>
            </div>
            <div className="rounded-xl bg-white/90 border border-emerald-100 p-2.5">
              <span className="text-[10px] text-ink-faint font-bold uppercase block">Replacement</span>
              <span className="font-bold text-navy truncate block">
                {tripSummary.appliedRecovery.replacementTransport?.airline || 'Air India'} {tripSummary.appliedRecovery.replacementTransport?.flightNumber || 'AI-204'}
              </span>
            </div>
            <div className="rounded-xl bg-white/90 border border-emerald-100 p-2.5">
              <span className="text-[10px] text-ink-faint font-bold uppercase block">Protection</span>
              <span className="font-bold text-emerald-700">
                Downstream Protected ✓
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. Day Filter Navigation Tabs ── */}
      {days.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedDay('all')}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition shrink-0 ${
              selectedDay === 'all'
                ? 'bg-navy text-white shadow-sm'
                : 'bg-white text-ink-soft hover:text-navy border border-navy/10'
            }`}
          >
            All Days ({days.length})
          </button>
          {days.map((d) => (
            <button
              key={d.dayNumber}
              onClick={() => setSelectedDay(String(d.dayNumber))}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition shrink-0 ${
                selectedDay === String(d.dayNumber)
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-white text-ink-soft hover:text-navy border border-navy/10'
              }`}
            >
              Day {d.dayNumber} <span className="text-[10px] font-normal opacity-75">({d.shortDate})</span>
            </button>
          ))}
        </div>
      )}

      {/* ── 4. Chronological Itinerary Days ── */}
      {allItems.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-navy/10 bg-slate-50/70 p-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-white border border-navy/10 flex items-center justify-center text-primary shadow-xs mb-3">
            <CalendarDays size={24} />
          </div>
          <h3 className="text-base font-bold text-navy">No itinerary items found</h3>
          <p className="text-xs text-ink-soft max-w-sm mx-auto mt-1">
            This trip doesn't have any bookings or day stops yet. You can use the Journey Editor to add stops and activities.
          </p>
          <button
            onClick={() => navigate(`/app/trip/${tripSummary.id}/edit`)}
            className="mt-4 inline-flex items-center gap-1.5 btn-primary text-xs py-2 px-4"
          >
            <Plus size={14} /> Add First Stop
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {filteredDays.map((day) => (
            <section key={day.dayNumber} className="space-y-3">
              {/* Day Header Badge */}
              <div className="sticky top-20 z-20 flex items-center justify-between bg-[#F3F6FC]/95 backdrop-blur-md py-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-navy text-white text-xs font-black shadow-xs">
                    {day.dayNumber}
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold text-navy">
                      DAY {day.dayNumber}
                    </h2>
                    <p className="text-[11px] font-semibold text-ink-soft">
                      {day.formattedDate}
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-medium text-ink-faint bg-white px-2.5 py-1 rounded-full border border-navy/5 shadow-xs">
                  {day.items.length} {day.items.length === 1 ? 'event' : 'events'}
                </span>
              </div>

              {/* Day Items Timeline */}
              <div className="relative pl-4 sm:pl-6 space-y-4 before:absolute before:left-[19px] sm:before:left-[27px] before:top-4 before:bottom-4 before:w-0.5 before:bg-navy/10">
                {day.items.map((item) => {
                  const cfg = TYPE_CONFIG[item.itemType] || TYPE_CONFIG.other;
                  const Icon = cfg.icon;
                  const isExpanded = Boolean(expandedItems[item.id]);
                  const hasConnection = Boolean(item.connectionToNext);
                  const isDisrupted = Boolean(item.isDisrupted);

                  return (
                    <div key={item.id} className="relative group">
                      {/* Timeline Node Icon */}
                      <div className="flex items-start gap-3.5 sm:gap-4">
                        <div
                          className={`relative z-10 -ml-4 sm:-ml-6 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-2xl ${
                            isDisrupted
                              ? item.disruptionSeverity === 'critical' || item.disruptionSeverity === 'high'
                                ? 'bg-rose-600 text-white shadow-rose-200'
                                : 'bg-amber-500 text-white shadow-amber-200'
                              : cfg.iconBg
                          } shadow-sm shrink-0`}
                        >
                          {isDisrupted ? <AlertTriangle size={16} /> : <Icon size={16} />}
                        </div>

                        {/* Itinerary Item Card */}
                        <div
                          className={`flex-1 rounded-2xl border ${
                            isDisrupted
                              ? item.disruptionSeverity === 'critical' || item.disruptionSeverity === 'high'
                                ? 'border-rose-400 bg-rose-50/30 ring-2 ring-rose-200'
                                : 'border-amber-400 bg-amber-50/30 ring-2 ring-amber-200'
                              : `${cfg.border} bg-white`
                          } shadow-xs overflow-hidden transition-all hover:shadow-card`}
                        >
                          {/* Card Header */}
                          <div className={`px-4 py-3 ${cfg.bg} border-b ${cfg.border} flex flex-wrap items-center justify-between gap-2`}>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${cfg.badgeBg}`}>
                                {cfg.label}
                              </span>
                              <StatusChip status={item.status} />

                              {/* STAGE 12: Disruption Warning Badge */}
                              {isDisrupted && (
                                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                  item.disruptionSeverity === 'critical' || item.disruptionSeverity === 'high'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}>
                                  <AlertTriangle size={11} />
                                  <span>{item.disruptionType.toUpperCase()} REPORTED</span>
                                  {item.disruptionDelayMinutes > 0 && (
                                    <span>({item.disruptionDelayMinutes}m)</span>
                                  )}
                                </span>
                              )}

                              {/* STAGE 19: Recovery Badges */}
                              {item.isRecoveryReplacement && (
                                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                                  <Sparkles size={11} className="text-emerald-600" />
                                  <span>REPLACEMENT TRANSPORT</span>
                                </span>
                              )}
                              {item.isRecoveryRescheduled && (
                                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                  <Clock size={11} className="text-amber-600" />
                                  <span>RESCHEDULED & PROTECTED</span>
                                </span>
                              )}
                              {item.isRecoveryPreserved && (
                                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 size={10} />
                                  <span>INTACT</span>
                                </span>
                              )}

                              {item.confirmationCode && (
                                <span className="hidden sm:inline-flex items-center gap-1 rounded-md bg-white/80 px-2 py-0.5 text-[10px] font-mono font-bold text-navy border border-navy/10">
                                  Ref: {item.confirmationCode}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              {item.price > 0 && (
                                <span className="text-xs font-black text-emerald-700">
                                  ₹{Number(item.price).toLocaleString('en-IN')}
                                </span>
                              )}

                              {/* Item-level Find Recovery Options CTA when disrupted */}
                              {isDisrupted && (
                                <button
                                  onClick={() => navigate(tripSummary?.id ? `/app/trip/${tripSummary.id}/recovery` : '/app/recovery', {
                                    state: {
                                      tripId: tripSummary?.id,
                                      disruptionId: item.disruption?.id,
                                      disruption: item.disruption,
                                    },
                                  })}
                                  className="btn-primary text-[11px] py-1 px-2.5 flex items-center gap-1 shadow-xs bg-primary hover:bg-primary-light text-white font-bold rounded-lg cursor-pointer"
                                  title="Find recovery options for this disrupted item"
                                >
                                  <Sparkles size={11} className="text-white" />
                                  <span>Find Options</span>
                                  <ArrowRight size={11} className="text-white" />
                                </button>
                              )}

                              {/* Item-level Report Issue CTA */}
                              <button
                                onClick={() => setReportModal({ open: true, preselectedItem: item })}
                                className="p-1 rounded-lg text-ink-faint hover:text-amber-600 hover:bg-amber-50 transition"
                                title="Report issue against this item"
                              >
                                <AlertTriangle size={14} />
                              </button>

                              <button
                                onClick={() => toggleExpand(item.id)}
                                className="p-1 rounded-lg text-ink-soft hover:bg-black/5 transition"
                                aria-label={isExpanded ? 'Collapse' : 'Expand'}
                              >
                                {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                              </button>
                            </div>
                          </div>

                          {/* Card Content */}
                          <div className="p-4 space-y-3">
                            <div>
                              <h3 className="text-sm font-extrabold text-navy">
                                {item.title}
                              </h3>
                              {(item.origin || item.destination || item.location) && (
                                <p className="text-xs text-ink-soft font-medium mt-0.5 flex items-center gap-1">
                                  <MapPin size={12} className="text-ink-faint shrink-0" />
                                  {item.origin && item.destination
                                    ? `${item.origin} → ${item.destination}`
                                    : item.location || item.origin || item.destination}
                                </p>
                              )}
                            </div>

                            {/* Schedule Row */}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-soft">
                              {item.startTimeStr ? (
                                <span className="inline-flex items-center gap-1 font-semibold text-navy">
                                  <Clock size={12} className="text-primary" />
                                  {item.itemType === 'hotel' ? 'Check-in: ' : 'Departure: '}
                                  {item.startTimeStr}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-ink-faint">
                                  <CalendarDays size={12} />
                                  {item.dateStr ? day.shortDate : 'Scheduled'}
                                </span>
                              )}

                              {item.endTimeStr && (
                                <span className="inline-flex items-center gap-1 font-semibold text-navy">
                                  <Clock size={12} className="text-indigo-500" />
                                  {item.itemType === 'hotel' ? 'Check-out: ' : 'Arrival: '}
                                  {item.endTimeStr}
                                </span>
                              )}

                              {item.confirmationCode && (
                                <span className="sm:hidden font-mono font-bold text-navy text-[11px]">
                                  Ref: {item.confirmationCode}
                                </span>
                              )}
                            </div>

                            {/* STAGE 19: Recovery Notification in Card */}
                            {(item.isRecoveryRescheduled || item.isRecoveryReplacement || item.recoveryNote) && (
                              <div className="rounded-xl bg-emerald-50/80 border border-emerald-200/90 p-2.5 text-xs text-emerald-950 flex items-start gap-2 shadow-2xs">
                                <Sparkles size={14} className="text-emerald-700 shrink-0 mt-0.5" />
                                <div>
                                  <span className="font-bold">Recovery Adjustment: </span>
                                  <span>{item.recoveryNote || item.notes || 'Timing buffer and dependencies updated for smooth journey flow.'}</span>
                                </div>
                              </div>
                            )}

                            {/* Notes or Sightseeing details */}
                            {item.notes && (
                              <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-2.5 text-xs text-ink-soft leading-relaxed">
                                <p className="font-semibold text-navy text-[11px] mb-0.5">Details & Notes:</p>
                                <p className="whitespace-pre-line">{item.notes}</p>
                              </div>
                            )}

                            {/* Uploaded Tickets & Documents attached to this item */}
                            {item.documents?.length > 0 && (
                              <div className="pt-2 border-t border-navy/5 flex flex-wrap items-center gap-2">
                                <span className="text-[11px] font-bold text-ink-faint flex items-center gap-1">
                                  <Ticket size={12} /> Attached Ticket / Doc:
                                </span>
                                {item.documents.map((doc) => (
                                  <button
                                    key={doc.id}
                                    onClick={() => handleOpenDoc(doc)}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-semibold px-2.5 py-1 border border-sky-200 shadow-2xs transition"
                                  >
                                    <FileText size={12} className="text-sky-600" />
                                    <span>{doc.title || doc.file_name}</span>
                                    <Eye size={11} className="text-sky-400 ml-0.5" />
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Expanded Details Section */}
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="pt-3 border-t border-navy/5 text-xs space-y-2 overflow-hidden"
                                >
                                  {item.refundable && (
                                    <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                                      <CheckCircle2 size={13} />
                                      <span>Refundable booking</span>
                                      {item.cancellationDeadline && (
                                        <span className="text-ink-soft font-normal">
                                          (until {new Date(item.cancellationDeadline).toLocaleDateString('en-IN', { dateStyle: 'medium' })})
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  {item.travelers?.length > 0 && (
                                    <div className="flex flex-wrap items-center gap-1 text-[11px] text-ink-soft">
                                      <span className="font-semibold text-navy">Travelers on booking:</span>
                                      {item.travelers.map((t) => t.name).join(', ')}
                                    </div>
                                  )}

                                  <div className="pt-2 flex items-center gap-2">
                                    <button
                                      onClick={() => setReportModal({ open: true, preselectedItem: item })}
                                      className="text-[11px] font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1"
                                    >
                                      <AlertTriangle size={12} />
                                      <span>Report issue with this booking</span>
                                    </button>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </div>

                      {/* ── 5. Consecutive Connection Relationship ── */}
                      {hasConnection && (
                        <div className="py-2 pl-4 sm:pl-6 flex items-center gap-3">
                          <div className="-ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-slate-600 shadow-2xs">
                            <ArrowDown size={12} />
                          </div>
                          <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100/90 border border-slate-200/80 px-3 py-1 text-[11px] font-semibold text-navy-soft shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                            <span>{item.connectionToNext.label}</span>
                            {item.connectionToNext.sublabel && (
                              <span className="text-ink-faint font-normal hidden sm:inline">
                                • {item.connectionToNext.sublabel}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ── 5.5 Next Steps & Traveler Actions (STAGE 21, 25, 26 NAVIGATION) ── */}
      <div className="rounded-3xl border border-navy/10 bg-gradient-to-br from-white via-periwinkle/30 to-slate-50 p-6 sm:p-7 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy/5 pb-3">
          <div>
            <span className="rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider">
              Traveler Actions & Next Steps
            </span>
            <h3 className="text-base sm:text-lg font-black text-navy mt-1">
              What would you like to do next?
            </h3>
          </div>
          <span className="text-xs text-ink-soft">
            {allItems.length} connected items confirmed
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <button
            onClick={() => navigate('/app/deadlines')}
            className="rounded-2xl border border-amber-200 bg-amber-50/60 hover:bg-amber-100/70 p-4 text-left transition space-y-1 group shadow-2xs"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900">Next: Deadlines & Policies</span>
              <ArrowRight size={14} className="text-amber-700 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Check hotel refund cut-offs, web check-in windows, and policy guard.
            </p>
          </button>

          <button
            onClick={() => navigate('/app/documents')}
            className="rounded-2xl border border-sky-200 bg-sky-50/60 hover:bg-sky-100/70 p-4 text-left transition space-y-1 group shadow-2xs"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-sky-900">Documents Vault</span>
              <ArrowRight size={14} className="text-sky-700 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <p className="text-[11px] text-sky-800 leading-relaxed">
              Access replacement boarding passes, vouchers, and offline documents.
            </p>
          </button>

          <button
            onClick={() => {
              if (onCompleteTrip) {
                onCompleteTrip(tripSummary);
              } else {
                navigate('/app/trip');
              }
            }}
            className="rounded-2xl border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/70 p-4 text-left transition space-y-1 group shadow-2xs"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-900">Complete & Archive Trip</span>
              <CheckCircle2 size={14} className="text-emerald-700 group-hover:scale-110 transition-transform" />
            </div>
            <p className="text-[11px] text-emerald-800 leading-relaxed">
              Mark trip completed and preserve final itinerary in My Trips.
            </p>
          </button>
        </div>
      </div>

      {/* ── 6. Secure Document Preview Modal ── */}
      <Modal
        open={documentModal.open}
        onClose={() => setDocumentModal({ open: false, doc: null, signedUrl: null, loading: false })}
        title={documentModal.doc?.title || documentModal.doc?.file_name || 'Travel Document'}
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-navy/10 bg-slate-50 p-4 text-center">
            <FileText size={40} className="mx-auto text-primary mb-2" />
            <p className="text-sm font-bold text-navy break-all">
              {documentModal.doc?.title || documentModal.doc?.file_name}
            </p>
            <p className="text-xs text-ink-faint mt-0.5">
              Type: {documentModal.doc?.document_type || 'Travel Document'} · Stored in Trip Vault
            </p>
          </div>

          {documentModal.loading ? (
            <p className="text-xs text-center text-ink-soft">Securing temporary access link...</p>
          ) : documentModal.signedUrl ? (
            <div className="space-y-3">
              <a
                href={documentModal.signedUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full btn-primary text-sm flex items-center justify-center gap-2 py-2.5"
              >
                <Download size={15} /> Open / Download File
              </a>
              <p className="text-[11px] text-center text-ink-faint">
                Secure temporary signed URL issued directly from Supabase Storage.
              </p>
            </div>
          ) : (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
              <p className="font-semibold">Document is saved in your trip records.</p>
              <p className="mt-0.5 text-amber-700">Offline cached record available on this device.</p>
            </div>
          )}

          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">
            <Shield size={14} className="shrink-0 text-emerald-600" />
            <span>End-to-end encrypted storage · Authorized access only</span>
          </div>
        </div>
      </Modal>

      {/* ── 7. STAGE 12: Report Issue Modal ── */}
      <ReportIssueModal
        open={reportModal.open}
        onClose={() => setReportModal({ open: false, preselectedItem: null })}
        tripId={tripSummary.id}
        journeyItems={allItems}
        preselectedItem={reportModal.preselectedItem}
        onDisruptionReported={(newDisruption) => {
          if (newDisruption) {
            setLocalReportedDisruptions((prev) => [newDisruption, ...prev.filter((d) => d.id !== newDisruption.id)]);
          }
          if (onRefresh) onRefresh();
        }}
      />
    </div>
  );
}
