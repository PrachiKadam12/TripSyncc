/**
 * RiskDisruptionSummary.jsx — TripSync Stage 12 Risk / Disruption Summary Card
 * Compact status display showing current trip risk, active disruptions, disruption history,
 * and live connected API status (Open-Meteo Weather, Flight Status, Route Transfers).
 * Does NOT generate recovery plans (reserved for Stage 13).
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, AlertTriangle, AlertCircle, Clock, ChevronDown,
  ChevronUp, History, Plus, FileText, WifiOff, CloudSun, Plane,
  Navigation, Sparkles, RefreshCw, ArrowRight
} from 'lucide-react';

function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const past = new Date(dateStr);
  const diffMs = now - past;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffDay > 30) return past.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  if (diffDay > 0) return `${diffDay}d ago`;
  if (diffHr > 0) return `${diffHr}h ago`;
  if (diffMin > 0) return `${diffMin}m ago`;
  return 'Just now';
}

export default function RiskDisruptionSummary({
  tripId = null,
  activeDisruptions = [],
  disruptionHistory = [],
  onOpenReportModal,
  liveContext = null,
  onRunLiveRiskScan = null,
  isScanningRisk = false,
  aiExplanation = null,
}) {
  const navigate = useNavigate();
  const [historyOpen, setHistoryOpen] = useState(false);

  const hasActive = activeDisruptions.length > 0;
  const latestDisruption = activeDisruptions[0] || disruptionHistory[0];

  const weatherEntries = Object.entries(liveContext?.weatherReports || {});
  const flightEntries = Object.entries(liveContext?.flightStatuses || {});
  const transferEntries = Object.entries(liveContext?.transferEstimates || {});

  return (
    <div className="rounded-3xl border border-navy/10 bg-white shadow-xs overflow-hidden">
      {/* ── Main Risk Status Banner ── */}
      <div className={`p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 ${
        hasActive
          ? 'bg-gradient-to-r from-amber-500/10 via-rose-500/5 to-transparent border-b border-amber-200/60'
          : 'bg-emerald-50/40 border-b border-emerald-100'
      }`}>
        <div className="flex items-start gap-3 min-w-0">
          <div className={`h-10 w-10 rounded-2xl flex items-center justify-center shrink-0 ${
            hasActive ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
          }`}>
            {hasActive ? <AlertTriangle size={20} /> : <ShieldCheck size={20} />}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-ink-faint">
                Trip Risk Status
              </span>
              {hasActive ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 text-rose-800 px-2 py-0.5 text-[10px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
                  Active Disruption Detected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  Normal • On Schedule
                </span>
              )}
            </div>

            <h3 className="text-sm sm:text-base font-extrabold text-navy mt-0.5 truncate">
              {hasActive
                ? `${latestDisruption?.metadata?.disruption_type || 'Disruption'}: ${latestDisruption?.metadata?.affected_title || latestDisruption?.title || 'Trip Issue'}`
                : 'All connected journey legs are on schedule'}
            </h3>

            {hasActive && (
              <p className="text-xs text-ink-soft mt-0.5 line-clamp-1">
                {latestDisruption?.description || 'Disruption reported against journey schedule.'}
              </p>
            )}

            {hasActive && (
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  id="find-recovery-options-banner-btn"
                  data-testid="find-recovery-options-btn"
                  onClick={() => navigate(tripId ? `/app/trip/${tripId}/recovery` : '/app/recovery', {
                    state: {
                      tripId,
                      disruptionId: latestDisruption?.id,
                      disruption: latestDisruption,
                    },
                  })}
                  className="btn-primary text-xs py-2 px-4 font-bold flex items-center gap-1.5 shadow-md bg-primary hover:bg-primary-light text-white rounded-xl active:scale-95 transition cursor-pointer"
                  title="Find recovery options for active disruption"
                >
                  <Sparkles size={14} className="text-white" />
                  <span>Find Recovery Options</span>
                  <ArrowRight size={14} className="text-white" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {onRunLiveRiskScan && (
            <button
              onClick={onRunLiveRiskScan}
              disabled={isScanningRisk}
              className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 text-primary border-primary/20 hover:bg-primary/5 transition disabled:opacity-60"
              title="Query live weather and flight status APIs"
            >
              <RefreshCw size={13} className={isScanningRisk ? 'animate-spin' : ''} />
              <span>{isScanningRisk ? 'Scanning...' : 'Live Risk Scan'}</span>
            </button>
          )}

          {hasActive && (
            <button
              onClick={() => navigate(tripId ? `/app/trip/${tripId}/recovery` : '/app/recovery', {
                state: {
                  tripId,
                  disruptionId: latestDisruption?.id,
                  disruption: latestDisruption,
                },
              })}
              className="btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5 shadow-md bg-primary hover:bg-primary-light text-white font-bold rounded-xl cursor-pointer"
              title="Find recovery options for active disruption"
            >
              <Sparkles size={13} />
              <span>Find Recovery Options</span>
              <ArrowRight size={13} />
            </button>
          )}

          <button
            onClick={() => onOpenReportModal()}
            className={`btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5 ${
              hasActive ? 'bg-amber-600 hover:bg-amber-700' : ''
            }`}
          >
            <Plus size={13} />
            <span>{hasActive ? 'Report Another Issue' : 'Report Issue'}</span>
          </button>

          {disruptionHistory.length > 0 && (
            <button
              onClick={() => setHistoryOpen((v) => !v)}
              className="btn-secondary text-xs py-2 px-3 flex items-center gap-1"
              title="View Disruption History"
            >
              <History size={13} />
              <span className="hidden sm:inline">History ({disruptionHistory.length})</span>
              {historyOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          )}
        </div>
      </div>

      {/* ── Live API Feeds Status Bar (Open-Meteo, FlightStatus, RouteService) ── */}
      {liveContext && (weatherEntries.length > 0 || flightEntries.length > 0 || transferEntries.length > 0) && (
        <div className="px-4 py-2.5 bg-slate-50/80 border-b border-navy/5 flex flex-wrap items-center gap-3 text-xs">
          <span className="text-[10px] font-bold text-ink-faint uppercase tracking-wider flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live APIs:
          </span>

          {/* Open-Meteo Weather Badges */}
          {weatherEntries.map(([city, w]) => (
            <div
              key={city}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-medium border ${
                w.isAdverse
                  ? 'bg-amber-50 text-amber-900 border-amber-200'
                  : 'bg-white text-navy border-slate-200 shadow-2xs'
              }`}
            >
              <CloudSun size={12} className={w.isAdverse ? 'text-amber-600' : 'text-primary'} />
              <span>{city}: <strong>{w.temperature}°C</strong> ({w.condition})</span>
            </div>
          ))}

          {/* Flight Status Badges */}
          {flightEntries.map(([code, f]) => (
            <div
              key={code}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-medium border ${
                f.is_disrupted
                  ? 'bg-rose-50 text-rose-900 border-rose-200'
                  : 'bg-white text-navy border-slate-200 shadow-2xs'
              }`}
            >
              <Plane size={12} className={f.is_disrupted ? 'text-rose-600' : 'text-primary'} />
              <span>{code}: <strong>{f.flight_status}</strong> {f.delay_minutes > 0 ? `(+${f.delay_minutes}m)` : ''}</span>
            </div>
          ))}

          {/* OpenRouteService Transfer Badges */}
          {transferEntries.map(([key, t]) => (
            <div
              key={key}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-medium bg-white text-navy border border-slate-200 shadow-2xs"
            >
              <Navigation size={12} className="text-cyan-600" />
              <span>Transfer: ≈ {t.duration_minutes}m ({t.distance_km} km)</span>
            </div>
          ))}
        </div>
      )}

      {/* ── AI Explanation (Traveler-friendly) ── */}
      {aiExplanation && (
        <div className="px-4 py-3 bg-indigo-50/50 border-b border-indigo-100 flex items-start gap-2.5 text-xs text-indigo-900">
          <Sparkles size={15} className="text-indigo-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold uppercase tracking-wider text-[10px] text-indigo-600 mr-2">TripSync AI Notice:</span>
            <span>{aiExplanation}</span>
          </div>
        </div>
      )}

      {/* ── Active Disruption Quick Summary Cards ── */}
      {hasActive && (
        <div className="p-4 sm:p-5 bg-white divide-y divide-navy/5 space-y-3">
          {activeDisruptions.map((ad) => {
            const meta = ad.metadata || {};
            const severity = ad.severity || 'medium';
            const isOfflinePending = ad.isOfflinePending;

            return (
              <div key={ad.id} className="pt-3 first:pt-0 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-extrabold text-navy text-xs sm:text-sm">
                      {meta.affected_title || ad.title}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                      {meta.disruption_type || 'Disruption'}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                        severity === 'critical'
                          ? 'bg-rose-100 text-rose-800'
                          : severity === 'high'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {severity} Severity
                    </span>
                    {isOfflinePending && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-semibold">
                        <WifiOff size={10} /> Pending sync
                      </span>
                    )}
                  </div>

                  {ad.description && (
                    <p className="text-ink-soft text-xs line-clamp-2">
                      {ad.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-faint">
                    <span className="inline-flex items-center gap-1">
                      <Clock size={11} /> Reported {formatRelativeTime(ad.detected_at)}
                    </span>
                    {meta.expected_delay_minutes > 0 && (
                      <span className="font-semibold text-amber-700">
                        Delay: ≈ {meta.expected_delay_minutes} min
                      </span>
                    )}
                    <span className="font-semibold text-primary capitalize">
                      Status: {meta.status || 'Reported'}
                    </span>
                  </div>
                </div>

                {/* Primary CTA button on the Active Disruption card */}
                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-navy/5">
                  <button
                    data-testid={`find-recovery-btn-${ad.id}`}
                    onClick={() => navigate(tripId ? `/app/trip/${tripId}/recovery` : '/app/recovery', {
                      state: {
                        tripId,
                        disruptionId: ad.id,
                        disruption: ad,
                      },
                    })}
                    className="btn-primary text-xs py-2 px-4 w-full sm:w-auto flex items-center justify-center gap-1.5 shadow-md bg-primary hover:bg-primary-light text-white font-bold rounded-xl active:scale-95 transition cursor-pointer"
                    title="Find recovery options for this disruption"
                  >
                    <Sparkles size={13} className="text-white" />
                    <span>Find Recovery Options</span>
                    <ArrowRight size={13} className="text-white" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Disruption History Drawer ── */}
      {historyOpen && disruptionHistory.length > 0 && (
        <div className="border-t border-navy/5 bg-slate-50/70 p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-navy uppercase tracking-wider flex items-center gap-1.5">
              <History size={13} className="text-primary" />
              Disruption & Issue History ({disruptionHistory.length})
            </h4>
          </div>

          <div className="space-y-2">
            {disruptionHistory.map((d) => {
              const meta = d.metadata || {};
              const isResolved = Boolean(d.resolved_at || meta.status === 'resolved');

              return (
                <div
                  key={d.id}
                  className="rounded-xl border border-navy/5 bg-white p-3 text-xs flex flex-wrap items-center justify-between gap-2 shadow-2xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-navy truncate">
                        {meta.affected_title || d.title}
                      </span>
                      <span className="text-[10px] text-ink-faint">
                        ({meta.disruption_type || 'Issue'})
                      </span>
                    </div>
                    {d.description && (
                      <p className="text-ink-soft text-[11px] mt-0.5 line-clamp-1">
                        {d.description}
                      </p>
                    )}
                    <p className="text-[10px] text-ink-faint mt-1">
                      Reported {formatRelativeTime(d.detected_at)} {meta.expected_delay_minutes ? `· ${meta.expected_delay_minutes}m delay` : ''}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${
                      isResolved
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {isResolved ? 'Resolved' : 'Reported'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
