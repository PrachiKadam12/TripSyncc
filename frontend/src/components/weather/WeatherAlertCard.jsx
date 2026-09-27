/**
 * WeatherAlertCard.jsx — TripSync Stage 22 Weather Risk & Advisory Card
 * 
 * Displays live weather conditions for journey segments with:
 * - Temperature, precipitation, wind, visibility metrics
 * - Clear severity badges (Critical, High, Medium, Stable)
 * - Associated itinerary segment
 * - Factual, non-speculative traveler guidance
 */

import { CloudRain, Wind, Eye, Thermometer, ShieldAlert, CheckCircle2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SEVERITY_CONFIG = {
  critical: {
    badge: 'bg-rose-100 text-rose-800 border-rose-300',
    dot: 'bg-rose-500 animate-pulse',
    border: 'border-rose-300 ring-1 ring-rose-200',
    label: 'Adverse Weather Alert',
  },
  high: {
    badge: 'bg-amber-100 text-amber-800 border-amber-300',
    dot: 'bg-amber-500',
    border: 'border-amber-300 ring-1 ring-amber-100',
    label: 'Weather Advisory',
  },
  medium: {
    badge: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    dot: 'bg-indigo-500',
    border: 'border-navy/10',
    label: 'Moderate Conditions',
  },
  low: {
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-500',
    border: 'border-navy/10',
    label: 'Weather Stable & Favorable',
  },
};

export default function WeatherAlertCard({ alert, tripId = null }) {
  const navigate = useNavigate();
  const sev = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.medium;

  return (
    <div className={`rounded-3xl border bg-white p-5 sm:p-6 shadow-sm transition-all hover:shadow-md ${sev.border}`}>
      {/* Top Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-navy/5 pb-3">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${sev.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${sev.dot}`} />
          {sev.label}
        </span>

        <span className="text-[11px] text-ink-faint font-semibold">
          Source: {alert.dataSource || 'Open-Meteo'}
        </span>
      </div>

      {/* Main Alert Info */}
      <div className="mt-3.5 space-y-3">
        <div>
          <h3 className="text-base sm:text-lg font-black text-navy">
            {alert.title}
          </h3>
          <p className="text-xs text-ink-soft font-medium mt-0.5">
            Connected Segment: <strong className="text-navy">{alert.associatedItemTitle || alert.location}</strong>
          </p>
        </div>

        {/* Live Weather Metrics Strip */}
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-50/90 border border-navy/5 p-3 text-center text-xs">
          <div>
            <span className="text-[10px] font-bold uppercase text-ink-faint flex items-center justify-center gap-1">
              <Thermometer size={12} className="text-primary" /> Temp
            </span>
            <span className="font-extrabold text-navy text-sm mt-0.5 block">
              {alert.temperature}°C
            </span>
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase text-ink-faint flex items-center justify-center gap-1">
              <Wind size={12} className="text-sky-600" /> Wind
            </span>
            <span className="font-extrabold text-navy text-sm mt-0.5 block">
              {alert.windSpeed} km/h
            </span>
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase text-ink-faint flex items-center justify-center gap-1">
              <CloudRain size={12} className="text-indigo-600" /> Rain
            </span>
            <span className="font-extrabold text-navy text-sm mt-0.5 block">
              {alert.precipitation > 0 ? `${alert.precipitation} mm` : '0 mm'}
            </span>
          </div>
        </div>

        {/* Explanation Message */}
        <p className="text-xs text-ink-soft leading-relaxed">
          {alert.message}
        </p>

        {/* Action Advice Box */}
        <div className="rounded-2xl bg-amber-50/80 border border-amber-200/90 p-3 text-xs text-amber-950 flex items-start gap-2.5">
          <ShieldAlert size={16} className="text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold text-[11px]">Traveler Advisory:</p>
            <p className="text-[11px] leading-relaxed text-amber-900">{alert.actionAdvice}</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      {tripId && (
        <div className="mt-4 pt-3 border-t border-navy/5 flex justify-end">
          <button
            onClick={() => navigate(`/app/trip/${tripId}/timeline`)}
            className="text-xs font-semibold text-primary hover:text-primary-dark flex items-center gap-1 transition"
          >
            <span>View Segment in Timeline</span>
            <ArrowRight size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
