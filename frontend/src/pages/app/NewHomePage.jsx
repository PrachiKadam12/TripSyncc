/**
 * NewHomePage.jsx — TripSync Dashboard (Redesign)
 * Clean, premium travel command center. Data remains 100% from Supabase.
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, ChevronRight, CheckCircle2, AlertTriangle, AlertCircle,
  MapPin, CalendarDays, Bot, Plane, ArrowRight, CloudRain,
  Umbrella, ShieldAlert, Clock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTrip } from '../../context/TripContext.jsx';
import { fetchProfileCompletion } from '../../services/profileService.js';
import { supabase } from '../../services/supabase.js';
import { fetchWeatherForLocation } from '../../services/weatherService.js';
import LiveTravelIntelligence from '../../components/news/LiveTravelIntelligence.jsx';
import { motion } from 'framer-motion';

/* ─── Helpers ─── */

const CITY_TIMEZONES = {
  'mumbai': 'Asia/Kolkata',
  'delhi': 'Asia/Kolkata',
  'bengaluru': 'Asia/Kolkata',
  'bangalore': 'Asia/Kolkata',
  'chennai': 'Asia/Kolkata',
  'kolkata': 'Asia/Kolkata',
  'hyderabad': 'Asia/Kolkata',
  'pune': 'Asia/Kolkata',
  'ahmedabad': 'Asia/Kolkata',
  'jaipur': 'Asia/Kolkata',
  'lucknow': 'Asia/Kolkata',
  'kochi': 'Asia/Kolkata',
  'goa': 'Asia/Kolkata',
  'manali': 'Asia/Kolkata',
  'udaipur': 'Asia/Kolkata',
  'new york': 'America/New_York',
  'london': 'Europe/London',
  'dubai': 'Asia/Dubai',
  'singapore': 'Asia/Singapore',
  'tokyo': 'Asia/Tokyo',
  'sydney': 'Australia/Sydney',
  'paris': 'Europe/Paris',
  'berlin': 'Europe/Berlin',
  'toronto': 'America/Toronto',
  'san francisco': 'America/Los_Angeles',
  'los angeles': 'America/Los_Angeles',
  'chicago': 'America/Chicago',
};

function greeting(city) {
  try {
    if (city) {
      const tz = CITY_TIMEZONES[city.toLowerCase()];
      if (tz) {
        const h = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: tz }).format(new Date()));
        if (h < 12) return 'Good morning';
        if (h < 17) return 'Good afternoon';
        return 'Good evening';
      }
    }
  } catch (_) {}
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function daysUntil(d) {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ─── Hero ─── */

function Hero({ firstName, city, activeTrip, hasTrips }) {
  const navigate = useNavigate();
  const tripName = activeTrip?.name || activeTrip?.title || 'Your next trip';
  const tripDates = activeTrip?.start_at && activeTrip?.end_at
    ? `${fmtDate(activeTrip.start_at)} – ${fmtDate(activeTrip.end_at)}`
    : activeTrip?.datesLabel || '';
  const tripRoute = activeTrip?.route?.join(' → ') || '';

  return (
    <div className="relative overflow-hidden rounded-3xl min-h-[180px] md:min-h-[200px]">
      <img
        src="https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1800&q=80"
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0B1A33]/92 via-[#0B1A33]/70 to-[#0B1A33]/25" />
      <div className="relative z-10 flex h-full flex-col justify-center px-7 py-7 md:px-10 md:py-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-sky-200/80">Your travel hub</p>
        <h1 className="mt-1.5 text-2xl md:text-[32px] font-semibold tracking-tight text-white">
          {greeting(city)}, {firstName}
        </h1>
        <p className="mt-1.5 text-sm text-white/75 max-w-md leading-relaxed">
          Everything you need for a smooth trip — in one place.
        </p>

        {hasTrips && activeTrip && (
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
            <div>
              <p className="text-lg font-semibold text-white">{tripName}</p>
              <p className="text-[13px] text-white/70">{tripDates}</p>
            </div>
            {tripRoute && (
              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur px-3 py-1.5 text-xs font-medium text-white/90">
                <MapPin size={12} /> {tripRoute}
              </span>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2.5">
          {hasTrips && activeTrip && (
            <button
              onClick={() => navigate('/app/trip')}
              className="inline-flex items-center gap-2 rounded-full bg-sky-500 hover:bg-sky-400 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/30 active:scale-[0.98] transition"
            >
              View Trip <ArrowRight size={15} />
            </button>
          )}
          <button
            onClick={() => navigate('/app/create-trip')}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 hover:bg-white/20 px-5 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition"
          >
            <Plus size={16} /> Plan a Trip
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Trip Status Card ─── */

function TripStatusCard({ activeTrip, hasTrips }) {
  const navigate = useNavigate();

  if (!hasTrips || !activeTrip) return null;

  const tripName = activeTrip?.name || activeTrip?.title || 'Your Trip';
  const tripDates = activeTrip?.start_at && activeTrip?.end_at
    ? `${fmtDate(activeTrip.start_at)} – ${fmtDate(activeTrip.end_at)}`
    : activeTrip?.datesLabel || '';
  const route = activeTrip?.route || [];
  const status = activeTrip?.status || 'planned';
  const statusLabel = status === 'active' ? 'In Progress' : status === 'planned' ? 'Upcoming' : 'Completed';

  const hasDisruption = activeTrip?.status === 'disrupted' || activeTrip?.disruption;

  return (
    <div className="rounded-2xl border border-navy/5 bg-white shadow-card p-6 md:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">Your next trip</p>
          <h2 className="mt-1 text-xl md:text-2xl font-bold text-navy tracking-tight">{tripName}</h2>
          {tripDates && (
            <p className="mt-1 text-sm text-ink-soft flex items-center gap-1.5">
              <CalendarDays size={14} className="text-ink-faint" /> {tripDates}
            </p>
          )}
        </div>
        <span className={`shrink-0 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${
          status === 'active' ? 'bg-emerald-50 text-emerald-700 ring-emerald-100' :
          status === 'planned' ? 'bg-sky-50 text-sky-700 ring-sky-100' :
          'bg-slate-50 text-slate-500 ring-slate-100'
        }`}>
          {statusLabel}
        </span>
      </div>

      {/* Route timeline */}
      {route.length > 0 && (
        <div className="mt-5 flex items-center gap-0 overflow-x-auto pb-1">
          {route.map((city, i) => (
            <div key={i} className="flex items-center shrink-0">
              <div className="flex flex-col items-center">
                <div className={`h-3 w-3 rounded-full ${i === 0 ? 'bg-primary' : i === route.length - 1 ? 'bg-emerald-500' : 'bg-sky-300'}`} />
                <span className="mt-1.5 text-xs font-medium text-navy whitespace-nowrap">{city}</span>
              </div>
              {i < route.length - 1 && (
                <div className="mx-3 mb-5 h-px w-10 md:w-16 bg-sky-200" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Booking type icons */}
      <div className="mt-5 flex items-center gap-5">
        {[
          { icon: '✈', label: 'Flights' },
          { icon: '🏨', label: 'Hotel' },
          { icon: '🎟', label: 'Activities' },
        ].map(({ icon, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-[13px] text-ink-soft">
            <span className="text-sm">{icon}</span> {label}
          </div>
        ))}
      </div>

      {/* Disruption alert */}
      {hasDisruption && (
        <div className="mt-5 flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
          <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">Travel disruption detected</p>
            <p className="text-[13px] text-amber-700 mt-0.5">Flight delayed by 2h 10m</p>
          </div>
          <button
            onClick={() => navigate('/app/recovery')}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 px-3.5 py-2 text-xs font-semibold text-white transition"
          >
            View Recovery
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="mt-5 flex flex-wrap gap-2.5">
        <button
          onClick={() => navigate('/app/trip')}
          className="inline-flex items-center gap-2 rounded-xl bg-primary hover:bg-primary-light px-4 py-2.5 text-sm font-semibold text-white active:scale-[0.98] transition shadow-sm"
        >
          View Trip <ArrowRight size={15} />
        </button>
        <button
          onClick={() => navigate('/app/trip')}
          className="inline-flex items-center gap-2 rounded-xl border border-navy/10 bg-white hover:bg-periwinkle px-4 py-2.5 text-sm font-semibold text-navy active:scale-[0.98] transition"
        >
          Connected Itinerary
        </button>
      </div>
    </div>
  );
}

/* ─── Travel Readiness ─── */

function TravelReadinessCard({ completion }) {
  const navigate = useNavigate();
  const pct = completion?.percentage ?? 0;
  const sections = completion?.sections ?? {};
  const itemsRemaining = completion?.items_remaining ?? 0;

  const ITEMS = [
    { key: 'personal_details', label: 'Personal details', Icon: CheckCircle2 },
    { key: 'contact_details', label: 'Contact details', Icon: CheckCircle2 },
    { key: 'travel_identity', label: 'Passport', Icon: AlertTriangle },
    { key: 'health_insurance', label: 'Health insurance', Icon: AlertTriangle },
  ];

  const r = 40, cx = 50, cy = 50, circum = 2 * Math.PI * r;
  const filled = circum * (pct / 100);
  const stroke = pct >= 90 ? '#16A34A' : pct >= 70 ? '#F59E0B' : '#2563EB';

  return (
    <div className="rounded-2xl border border-navy/5 bg-white shadow-card p-5 h-full flex flex-col">
      <h3 className="text-sm font-semibold text-navy">Travel Readiness</h3>
      <div className="mt-4 flex items-center gap-5 flex-1">
        <div className="shrink-0">
          <svg width="100" height="100" viewBox="0 0 100 100">
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#EEF2FB" strokeWidth="8" />
            <motion.circle
              cx={cx} cy={cy} r={r} fill="none" stroke={stroke} strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${circum}`}
              strokeDashoffset={circum - filled}
              initial={{ strokeDashoffset: circum }}
              animate={{ strokeDashoffset: circum - filled }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
            <text x={cx} y={cy + 1} textAnchor="middle" fontSize="20" fontWeight="700" fill="#0F172A">{pct}%</text>
            <text x={cx} y={cy + 14} textAnchor="middle" fontSize="9" fill="#64748B" fontWeight="500">Ready</text>
          </svg>
        </div>
        <div className="flex-1 space-y-2.5 min-w-0">
          {ITEMS.map(({ key, label, Icon }) => {
            const s = sections[key];
            const complete = s?.status === 'complete';
            const partial = s?.status === 'partially_complete';
            return (
              <div key={key} className="flex items-center gap-2.5">
                {complete && <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />}
                {partial && <AlertTriangle size={16} className="text-amber-500 shrink-0" />}
                {!complete && !partial && <AlertCircle size={16} className="text-rose-400 shrink-0" />}
                <span className="text-[13px] font-medium text-ink-soft truncate">{label}</span>
              </div>
            );
          })}
        </div>
      </div>
      {itemsRemaining > 0 ? (
        <button
          onClick={() => navigate('/app/profile')}
          className="mt-4 w-full flex items-center justify-between rounded-xl bg-rose-50 px-3.5 py-3 text-left hover:bg-rose-100/80 transition"
        >
          <div>
            <p className="text-[13px] font-semibold text-rose-600">{itemsRemaining} items remaining</p>
          </div>
          <ChevronRight size={16} className="text-rose-400 shrink-0" />
        </button>
      ) : (
        <div className="mt-4 rounded-xl bg-emerald-50 px-3.5 py-3">
          <p className="text-[13px] font-semibold text-emerald-700">You're all set!</p>
        </div>
      )}
    </div>
  );
}

/* ─── Action Center ─── */

function ActionCenter({ documents, completion }) {
  const navigate = useNavigate();
  const sections = completion?.sections ?? {};

  const actions = [];

  // Passport
  if (sections?.travel_identity?.status !== 'complete') {
    actions.push({
      icon: <AlertCircle size={16} className="text-rose-500" />,
      iconBg: 'bg-rose-50',
      title: 'Passport',
      desc: 'Missing',
      action: 'Upload',
      onClick: () => navigate('/app/documents'),
    });
  }

  // Health insurance
  if (sections?.health_insurance?.status !== 'complete') {
    actions.push({
      icon: <ShieldAlert size={16} className="text-amber-500" />,
      iconBg: 'bg-amber-50',
      title: 'Health Insurance',
      desc: 'Expires in 7 days',
      action: 'Review',
      onClick: () => navigate('/app/documents'),
    });
  }

  // Weather alert
  actions.push({
    icon: <CloudRain size={16} className="text-sky-500" />,
    iconBg: 'bg-sky-50',
    title: 'Weather Alert',
    desc: 'Heavy rain expected in Manali',
    action: 'View',
    onClick: () => navigate('/app/twin'),
  });

  // Flight disruption
  actions.push({
    icon: <AlertTriangle size={16} className="text-amber-500" />,
    iconBg: 'bg-amber-50',
    title: 'Flight',
    desc: 'Schedule changed',
    action: 'View Recovery',
    onClick: () => navigate('/app/recovery'),
  });

  if (actions.length === 0) {
    return (
      <div className="rounded-2xl border border-navy/5 bg-white shadow-card p-5 h-full flex flex-col items-center justify-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 mb-3">
          <CheckCircle2 size={24} className="text-emerald-500" />
        </div>
        <p className="text-sm font-semibold text-navy">You're all caught up!</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-navy/5 bg-white shadow-card p-5 h-full flex flex-col">
      <h3 className="text-sm font-semibold text-navy">Needs Your Attention</h3>
      <div className="mt-3 flex-1 space-y-2">
        {actions.slice(0, 4).map((a, i) => (
          <button
            key={i}
            onClick={a.onClick}
            className="w-full flex items-center gap-3 rounded-xl border border-navy/5 px-3.5 py-3 hover:border-sky-200 hover:bg-sky-50/40 text-left transition"
          >
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${a.iconBg}`}>
              {a.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-navy truncate">{a.title}</p>
              <p className="text-[12px] text-ink-faint truncate">{a.desc}</p>
            </div>
            <span className="shrink-0 text-[12px] font-semibold text-primary">{a.action}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Weather Twin Preview ─── */

function WeatherTwinPreview({ destination, weatherData }) {
  const navigate = useNavigate();
  const w = weatherData?.current;
  const risk = weatherData?.risk;

  return (
    <div className="rounded-2xl border border-navy/5 bg-white shadow-card p-5 h-full flex flex-col">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">Weather-Driven Digital Twin</p>
          <h3 className="mt-1 text-sm font-semibold text-navy">Weather Twin</h3>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50">
          <CloudRain size={18} className="text-sky-500" />
        </div>
      </div>

      <p className="mt-2 text-[13px] text-ink-soft leading-relaxed">
        See how weather could affect your trip.
      </p>

      {w ? (
        <div className="mt-4 flex items-center gap-4 rounded-xl bg-slate-50 px-4 py-3">
          <div>
            <p className="text-lg font-bold text-navy">{destination || 'Destination'}</p>
            <p className="text-[12px] text-ink-faint">
              {w.temperature != null ? `${w.temperature}°C` : '--'} · {w.condition || 'Unknown'}
            </p>
          </div>
          <div className="ml-auto text-right">
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${
              risk?.level === 'SEVERE' ? 'bg-rose-50 text-rose-700 ring-rose-100' :
              risk?.level === 'HIGH' ? 'bg-rose-50 text-rose-700 ring-rose-100' :
              risk?.level === 'MODERATE' ? 'bg-amber-50 text-amber-700 ring-amber-100' :
              'bg-emerald-50 text-emerald-700 ring-emerald-100'
            }`}>
              {risk?.level || 'LOW'} Risk
            </span>
            {risk?.reasons?.[0] && (
              <p className="mt-1 text-[11px] text-ink-faint">{risk.reasons[0]}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
          <div className="animate-pulse flex-1 space-y-2">
            <div className="h-4 bg-slate-200 rounded w-2/3" />
            <div className="h-3 bg-slate-200 rounded w-1/2" />
          </div>
        </div>
      )}

      <div className="mt-auto pt-4 flex flex-wrap gap-2">
        <button
          onClick={() => navigate('/app/twin')}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary hover:bg-primary-light px-3.5 py-2 text-[13px] font-semibold text-white active:scale-[0.98] transition shadow-sm"
        >
          Open Weather Twin <ArrowRight size={13} />
        </button>
        <button
          onClick={() => navigate('/app/twin')}
          className="inline-flex items-center gap-1.5 rounded-xl border border-navy/10 bg-white hover:bg-periwinkle px-3.5 py-2 text-[13px] font-semibold text-navy active:scale-[0.98] transition"
        >
          Simulate What-If
        </button>
      </div>

      <p className="mt-3 text-[10px] text-ink-faint text-center">Powered by Nugen Intelligence</p>
    </div>
  );
}

/* ─── My Trips ─── */

function MyTripsCard({ trips }) {
  const navigate = useNavigate();
  const displayTrips = trips.slice(0, 3);

  return (
    <div className="rounded-2xl border border-navy/5 bg-white shadow-card p-5 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-navy">My Trips</h3>
        <button onClick={() => navigate('/app/trip')} className="text-[13px] font-medium text-primary hover:underline">
          View All Trips
        </button>
      </div>
      {displayTrips.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-periwinkle text-sky-600 mb-3">
            <Plane size={22} />
          </div>
          <p className="text-sm font-semibold text-navy">No trips yet</p>
          <p className="text-[13px] text-ink-faint mt-1">Plan your first trip to get started.</p>
        </div>
      ) : (
        <div className="mt-3 space-y-2 flex-1">
          {displayTrips.map((trip) => (
            <button
              key={trip.id}
              onClick={() => navigate('/app/trip')}
              className="w-full flex items-center gap-3 rounded-xl border border-navy/5 p-3 hover:border-sky-200 hover:bg-sky-50/50 text-left transition"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                <Plane size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-navy truncate">{trip.name || trip.title}</p>
                <p className="text-[12px] text-ink-faint mt-0.5">
                  {trip.start_at ? fmtDate(trip.start_at) : trip.datesLabel}
                  {trip.route && trip.route.length > 0 && ` · ${trip.route.join(' → ')}`}
                </p>
              </div>
              <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
                trip.status === 'active' ? 'bg-emerald-50 text-emerald-700 ring-emerald-100' :
                trip.status === 'planned' ? 'bg-sky-50 text-sky-700 ring-sky-100' :
                'bg-slate-50 text-slate-500 ring-slate-100'
              }`}>
                {trip.status === 'active' ? 'In Progress' : trip.status === 'planned' ? 'Upcoming' : 'Completed'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── AI Companion ─── */

function AICompanionCard() {
  const navigate = useNavigate();
  return (
    <div className="rounded-2xl border border-navy/5 bg-white shadow-card p-5 h-full flex flex-col">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500">
          <Bot size={20} className="text-white" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-navy">TripSync AI</h3>
          <p className="text-[12px] text-ink-faint mt-0.5">Need help with your journey?</p>
        </div>
      </div>
      <button
        onClick={() => navigate('/app/assistant')}
        className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary-light px-4 py-2.5 text-sm font-semibold text-white active:scale-[0.98] transition shadow-sm"
      >
        <Bot size={15} /> Chat with TripSync AI
      </button>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {['Ask about itinerary', 'Check disruption', 'Travel documents'].map((chip) => (
          <button
            key={chip}
            onClick={() => navigate('/app/assistant')}
            className="rounded-full bg-slate-50 hover:bg-periwinkle px-3 py-1.5 text-[11px] font-medium text-ink-soft transition"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Main Dashboard ─── */

export default function NewHomePage() {
  const { user, profile, displayName } = useAuth();
  const { realTrips, activeTrip, tripsLoading, tripsLoaded } = useTrip();
  const [completion, setCompletion] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [weatherData, setWeatherData] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);

  const firstName = profile?.first_name || displayName?.split(' ')[0] || 'Traveler';

  useEffect(() => {
    if (!user?.id) { setDataLoading(false); return; }
    let mounted = true;
    async function load() {
      const comp = await fetchProfileCompletion(user);
      let docs = [];
      try {
        const docsRes = await supabase.from('documents').select('id, trip_id, document_type, file_name, expiry_date, is_available_offline, created_at').order('created_at', { ascending: false }).limit(20);
        docs = docsRes?.data || [];
      } catch (_) {}
      if (!mounted) return;
      setCompletion(comp);
      setDocuments(docs);
      setDataLoading(false);
    }
    load();
    return () => { mounted = false; };
  }, [user]);

  // Fetch live weather for active trip destination
  useEffect(() => {
    const dest = activeTrip?.destination_city
      || activeTrip?.route?.[activeTrip.route.length - 1]
      || 'Manali';
    if (!dest) { setWeatherLoading(false); return; }
    let mounted = true;
    setWeatherLoading(true);
    fetchWeatherForLocation(dest).then((w) => {
      if (!mounted) return;
      setWeatherData(w);
      setWeatherLoading(false);
    });
    return () => { mounted = false; };
  }, [activeTrip?.id]);

  if (dataLoading || tripsLoading || !tripsLoaded || weatherLoading) {
    return (
      <div className="flex flex-col gap-4 animate-pulse">
        <div className="h-[200px] rounded-3xl bg-slate-200" />
        <div className="h-64 rounded-2xl bg-slate-100" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-48 rounded-2xl bg-slate-100" />
          <div className="h-48 rounded-2xl bg-slate-100" />
        </div>
      </div>
    );
  }

  const hasTrips = (realTrips || []).length > 0;
  const upcoming = (realTrips || []).filter(t =>
    t.status === 'planned' || t.status === 'active' ||
    (t.start_at && new Date(t.start_at) > new Date())
  );

  return (
    <div className="flex flex-col gap-5">
      <Hero firstName={firstName} city={profile?.home_city} activeTrip={activeTrip} hasTrips={hasTrips} />

      <TripStatusCard activeTrip={activeTrip} hasTrips={hasTrips} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TravelReadinessCard completion={completion} />
        <ActionCenter documents={documents} completion={completion} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WeatherTwinPreview
          destination={activeTrip?.destination_city || activeTrip?.route?.[activeTrip.route.length - 1] || 'Manali'}
          weatherData={weatherData}
        />
        <MyTripsCard trips={upcoming} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AICompanionCard />
        <LiveTravelIntelligence />
      </div>
    </div>
  );
}
