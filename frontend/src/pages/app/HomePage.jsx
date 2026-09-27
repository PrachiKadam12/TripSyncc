/**
 * HomePage — AUTH-AWARE DASHBOARD
 * Real user with no trips → Clean dashboard with profile + Plan Trip CTA
 * Real user with trips    → Trip dashboard from Supabase
 * Demo user               → Legacy demo view
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  MapPin, CalendarDays, Users, Clock, Plane, Hotel, Ticket, Car,
  Plus, FileText, ChevronRight, Sparkles, Compass, Wallet,
  ShieldCheck, RotateCcw, Wrench, LifeBuoy, FlaskConical,
  Receipt, Upload, X, AlertCircle, CheckCircle2, UserCheck,
  Bell, TrendingUp, Map, Star, ArrowRight, Zap, Globe,
} from 'lucide-react';
import { useTrip } from '../../context/TripContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { recoveryPlans } from '../../data/demoTrip.js';
import DisruptionBanner from '../../components/DisruptionBanner.jsx';
import DisruptionModal from '../../components/DisruptionModal.jsx';
import StatusChip from '../../components/StatusChip.jsx';
import RefundModal from '../../components/RefundModal.jsx';
import { fetchProfileCompletion } from '../../services/profileService.js';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const BOOKING_ICONS = { flight: Plane, hotel: Hotel, transfer: Car, activity: Ticket, train: Car, bus: Car, cab: Car };

// ─────────────────────────────────────────────
// QUICK ACTIONS — row of shortcut buttons
// ─────────────────────────────────────────────
function QuickActions() {
  const navigate = useNavigate();
  const actions = [
    { icon: Plus,       label: 'Plan Trip',     color: 'bg-sky-500 text-white',         route: '/app/create-trip', primary: true },
    { icon: FileText,   label: 'Documents',     color: 'bg-slate-100 text-navy',         route: '/app/documents' },
    { icon: Wallet,     label: 'Finance',       color: 'bg-slate-100 text-navy',         route: '/app/finance' },
    { icon: LifeBuoy,   label: 'Recovery',      color: 'bg-slate-100 text-navy',         route: '/app/recovery' },
  ];
  return (
    <div className="grid grid-cols-4 gap-3">
      {actions.map(({ icon: Icon, label, color, route, primary }) => (
        <button
          key={label}
          onClick={() => navigate(route)}
          className={`flex flex-col items-center gap-2 py-4 px-2 rounded-2xl ${color} ${
            primary ? 'shadow-lg shadow-sky-500/30' : 'border border-navy/10'
          } hover:opacity-90 active:scale-95 transition-all`}
        >
          <Icon size={20} />
          <span className="text-[11px] font-bold leading-tight text-center">{label}</span>
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// PROFILE SUMMARY CARD
// ─────────────────────────────────────────────
function ProfileSummaryCard({ user, profile, displayName, completion }) {
  const navigate = useNavigate();
  const percentage = completion?.percentage ?? 0;
  const statusKey = completion?.status || 'action_required';

  const statusLabel = statusKey === 'travel_ready'
    ? 'Travel Ready' : statusKey === 'almost_ready'
    ? 'Almost Ready' : 'Action Required';

  const statusColor = statusKey === 'travel_ready'
    ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
    : statusKey === 'almost_ready'
    ? 'text-amber-600 bg-amber-50 border-amber-200'
    : 'text-rose-600 bg-rose-50 border-rose-200';

  const barColor = statusKey === 'travel_ready'
    ? 'from-emerald-400 to-teal-500'
    : statusKey === 'almost_ready'
    ? 'from-amber-400 to-orange-400'
    : 'from-rose-500 to-red-400';

  const initials = (profile?.first_name?.[0] || displayName?.[0] || 'T').toUpperCase();
  const firstName = profile?.first_name || displayName?.split(' ')[0] || 'Traveler';
  const lastName = profile?.last_name || (displayName?.split(' ').slice(1).join(' ') || '');
  const email = profile?.email || user?.email || '';
  const phone = profile?.phone || '';
  const location = [profile?.home_city, profile?.home_country].filter(Boolean).join(', ') || 'Location not set';

  return (
    <div className="rounded-3xl bg-white border border-navy/10 shadow-sm overflow-hidden">
      {/* Top gradient strip */}
      <div className="h-2 bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500" />

      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="flex-shrink-0 h-16 w-16 rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20 text-white text-2xl font-black">
            {initials}
          </div>

          {/* Name & Meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <h2 className="text-base font-black text-navy">
                  {firstName} {lastName}
                </h2>
                <p className="text-xs text-ink-soft mt-0.5 truncate">{email}</p>
                {phone && (
                  <p className="text-xs text-ink-soft">{phone}</p>
                )}
                <div className="flex items-center gap-1 mt-1">
                  <MapPin size={11} className="text-sky-500" />
                  <span className="text-[11px] text-ink-soft">{location}</span>
                </div>
              </div>

              <span className={`inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-full border ${statusColor} shrink-0`}>
                {percentage}% · {statusLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4 space-y-1.5">
          <div className="flex justify-between text-[11px] font-bold text-navy-soft">
            <span>Profile Readiness</span>
            <span>{percentage}%</span>
          </div>
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full bg-gradient-to-r ${barColor}`}
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Footer CTA */}
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-[11px] text-ink-soft">
            {completion?.items_remaining > 0
              ? `${completion.items_remaining} categories still need attention`
              : 'Your travel profile is complete!'}
          </p>
          <button
            onClick={() => navigate('/app/profile')}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 text-[11px] font-bold border border-sky-200 transition-all"
          >
            Edit Profile <ArrowRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// EMPTY STATE — user logged in but no trips
// ─────────────────────────────────────────────
function EmptyStateDashboard({ user, profile, displayName }) {
  const navigate = useNavigate();
  const [completion, setCompletion] = useState(null);

  useEffect(() => {
    let mounted = true;
    fetchProfileCompletion(user).then(res => {
      if (mounted) setCompletion(res);
    });
    return () => { mounted = false; };
  }, [user]);

  const firstName = profile?.first_name || displayName?.split(' ')[0] || 'Traveler';

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-16">

      {/* Greeting */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center py-4">
        <h1 className="text-2xl sm:text-3xl font-black text-navy">
          {greeting()}, {firstName}! 👋
        </h1>
        <p className="text-sm text-ink-soft mt-1">
          Welcome to your TripSync dashboard.
        </p>
      </motion.div>

      {/* Plan Trip Hero CTA */}
      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        onClick={() => navigate('/app/create-trip')}
        className="w-full flex items-center justify-between gap-4 p-5 rounded-3xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 text-white shadow-xl shadow-sky-500/30 hover:shadow-2xl active:scale-[0.99] transition-all"
      >
        <div className="text-left">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={14} className="text-sky-200" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-sky-200">Ready to travel?</span>
          </div>
          <p className="text-lg font-black">Plan Your First Trip</p>
          <p className="text-xs text-white/70 mt-0.5">Add bookings, invite group members, and track everything in one place.</p>
        </div>
        <div className="flex-shrink-0 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
          <Plus size={28} />
        </div>
      </motion.button>

      {/* Quick Actions */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <QuickActions />
      </motion.div>

      {/* Profile Summary Card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <ProfileSummaryCard
          user={user}
          profile={profile}
          displayName={displayName}
          completion={completion}
        />
      </motion.div>

      {/* Feature Cards */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
        <h3 className="text-xs font-black uppercase tracking-wider text-navy-soft mb-3">Explore TripSync</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              icon: Plane,
              title: 'Smart Bookings',
              desc: 'Link flights, hotels and transport to your connected itinerary.',
              color: 'text-sky-600 bg-sky-50',
              route: '/app/trip',
            },
            {
              icon: ShieldCheck,
              title: 'Document Vault',
              desc: 'Upload tickets, visas and insurance — available even offline.',
              color: 'text-indigo-600 bg-indigo-50',
              route: '/app/documents',
            },
            {
              icon: Wallet,
              title: 'Money & Refunds',
              desc: 'Track spend, split expenses and protect your cancellation deadlines.',
              color: 'text-emerald-600 bg-emerald-50',
              route: '/app/finance',
            },
          ].map(({ icon: Icon, title, desc, color, route }) => (
            <button
              key={title}
              onClick={() => navigate(route)}
              className="group flex flex-col gap-3 p-4 rounded-2xl bg-white border border-navy/10 text-left hover:shadow-md hover:border-sky-200 transition-all"
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
                <Icon size={20} />
              </div>
              <div>
                <p className="text-xs font-black text-navy group-hover:text-sky-600 transition-colors">{title}</p>
                <p className="text-[11px] text-ink-soft mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────
// REAL TRIP DASHBOARD — user has active trip
// ─────────────────────────────────────────────
function RealTripDashboard({ trip, displayName, user, profile }) {
  const navigate = useNavigate();
  const { realTrips, setActiveTrip, setActiveTripId } = useTrip();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [completion, setCompletion] = useState(null);

  useEffect(() => {
    let mounted = true;
    fetchProfileCompletion(user).then(res => {
      if (mounted) setCompletion(res);
    });
    return () => { mounted = false; };
  }, [user]);

  const bookings = trip?.bookings || [];
  const nextBooking = bookings
    .filter(b => b.departure_at && new Date(b.departure_at) > new Date())
    .sort((a, b) => new Date(a.departure_at) - new Date(b.departure_at))[0];
  const NextIcon = (nextBooking && BOOKING_ICONS[nextBooking.booking_type]) || Plane;

  const tripDates = trip
    ? `${new Date(trip.start_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${new Date(trip.end_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : '';

  const firstName = profile?.first_name || displayName?.split(' ')[0] || 'Traveler';

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-16">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-navy">{greeting()}, {firstName}! 👋</h1>
          <p className="text-xs text-ink-soft">Here's your travel command center.</p>
        </div>
        <button
          onClick={() => navigate('/app/create-trip')}
          className="btn-primary px-4 py-2 text-xs font-black rounded-2xl shadow-md flex items-center gap-2 active:scale-95 transition-all"
        >
          <Plus size={15} /> Plan Trip
        </button>
      </div>

      {/* Multi-trip selector */}
      {realTrips?.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {realTrips.map(t => (
            <button key={t.id} onClick={() => { setActiveTrip(t); setActiveTripId(t.id); }}
              className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold border transition-all ${
                t.id === trip?.id ? 'bg-sky-500 text-white border-sky-500' : 'bg-white text-navy border-navy/10 hover:border-sky-400'
              }`}
            >
              {t.name}
            </button>
          ))}
          <button onClick={() => navigate('/app/create-trip')}
            className="shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold border border-dashed border-navy/20 text-ink-soft hover:border-sky-400 hover:text-sky-600 flex items-center gap-1"
          >
            <Plus size={12} /> New Trip
          </button>
        </div>
      )}

      {/* Active Trip Hero */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-navy to-sky-950 p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute inset-0 opacity-15 bg-cover bg-center pointer-events-none"
          style={{ backgroundImage: `url('https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=1200&q=80')` }} />
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-sky-300 uppercase tracking-widest mb-1">
              <Zap size={13} /> Active Trip
            </div>
            <h2 className="text-2xl font-black">{trip?.name || 'Your Trip'}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-200">
              {trip?.origin_city && trip?.destination_city && (
                <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-xl">
                  <MapPin size={13} className="text-sky-400" />
                  {trip.origin_city} → {trip.destination_city}
                </span>
              )}
              {tripDates && (
                <span className="flex items-center gap-1.5">
                  <CalendarDays size={13} /> {tripDates}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 px-3 py-1 text-xs font-bold text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {trip?.status === 'active' ? 'Active Trip' : 'Planned Trip'}
            </span>
          </div>
        </div>
      </header>

      {/* Quick Actions */}
      <QuickActions />

      {/* Profile Summary */}
      <ProfileSummaryCard
        user={user}
        profile={profile}
        displayName={displayName}
        completion={completion}
      />

      {/* Next Booking */}
      {nextBooking && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl border-2 border-sky-500/30 bg-white p-5 sm:p-6 shadow-md"
        >
          <div className="flex items-center gap-2 border-b border-navy/5 pb-3 mb-4">
            <span className="flex h-2 w-2 rounded-full bg-sky-500 animate-ping" />
            <span className="text-xs font-black uppercase tracking-widest text-sky-600">Next Up</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-500 text-white shadow-md">
                <NextIcon size={24} />
              </div>
              <div>
                <h3 className="text-base font-black text-navy">{nextBooking.provider_name}</h3>
                {nextBooking.departure_at && (
                  <p className="mt-0.5 text-xs font-bold text-navy flex items-center gap-1.5">
                    <Clock size={12} className="text-sky-600" />
                    {new Date(nextBooking.departure_at).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                  </p>
                )}
              </div>
            </div>
            <button onClick={() => navigate('/app/trip')}
              className="btn-primary py-2 px-4 text-xs font-bold shadow-md shrink-0"
            >
              View booking <ChevronRight size={14} />
            </button>
          </div>
        </motion.div>
      )}

      {/* + Add button */}
      <div className="flex justify-end">
        <button onClick={() => setAddModalOpen(true)}
          className="flex items-center gap-2 rounded-2xl bg-navy px-4 py-2.5 text-xs font-bold text-white shadow-lg hover:bg-navy/90 active:scale-95 transition-all"
        >
          <Plus size={16} /> Add to trip
        </button>
      </div>

      {/* Add Modal */}
      <AnimatePresence>
        {addModalOpen && (
          <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setAddModalOpen(false)}
          >
            <motion.div className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-2xl border border-navy/10"
              initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-navy/10 pb-3 mb-4">
                <h3 className="text-base font-black text-navy">Add to trip</h3>
                <button onClick={() => setAddModalOpen(false)} className="rounded-full p-1 text-ink-soft hover:bg-navy/5"><X size={18} /></button>
              </div>
              <div className="space-y-2.5">
                {[
                  { label: 'New Trip', desc: 'Plan a completely new trip', icon: Compass, route: '/app/create-trip' },
                  { label: 'Booking', desc: 'Flight, Hotel, Train, or Activity', icon: Plane, route: '/app/trip' },
                  { label: 'Expense', desc: 'Log a personal or group cost', icon: Receipt, route: '/app/finance' },
                  { label: 'Document', desc: 'Upload ticket, voucher, or ID', icon: Upload, route: '/app/documents' },
                ].map(({ label, desc, icon: Icon, route }) => (
                  <button key={label} onClick={() => { setAddModalOpen(false); navigate(route); }}
                    className="flex w-full items-center gap-3.5 rounded-2xl border border-navy/5 p-3.5 text-left hover:border-sky-500 hover:bg-sky-50/50 group transition-all"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 group-hover:bg-sky-500 group-hover:text-white transition-colors">
                      <Icon size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-extrabold text-navy">{label}</p>
                      <p className="text-xs text-ink-soft">{desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────
// DEMO DASHBOARD
// ─────────────────────────────────────────────
function DemoDashboard() {
  const { state, dispatch } = useTrip();
  const navigate = useNavigate();
  const [demoOpen, setDemoOpen] = useState(false);
  const [showDemoControls, setShowDemoControls] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);

  const disrupted = state.phase !== 'normal' && state.phase !== 'recovered';

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-16">
      {/* Demo Banner */}
      <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 flex items-center gap-3">
        <FlaskConical size={16} className="text-amber-600 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold text-amber-800">Demo Mode — Tanvi's Trip (HackCelestial)</p>
          <p className="text-[11px] text-amber-700">
            This is a hackathon demo with mock data.{' '}
            <button onClick={() => navigate('/login')} className="underline font-bold">Sign up</button> for a real account.
          </p>
        </div>
        <button onClick={() => setShowDemoControls(v => !v)}
          className="shrink-0 text-[11px] text-amber-700 font-bold border border-amber-300 rounded-lg px-2 py-1 hover:bg-amber-100"
        >
          {showDemoControls ? 'Hide' : 'Controls'}
        </button>
      </div>

      {showDemoControls && (
        <div className="rounded-2xl border border-navy/10 bg-white/70 p-3 shadow-sm flex flex-wrap gap-2">
          {state.phase === 'normal' ? (
            <button className="btn-danger text-xs py-1.5 px-3 flex items-center gap-1.5" onClick={() => setDemoOpen(true)}>
              <Wrench size={13} /> Simulate disruption
            </button>
          ) : (
            <>
              <button className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
                onClick={() => { dispatch({ type: 'FIND_OPTIONS' }); navigate('/app/recovery'); }}>
                <LifeBuoy size={13} /> Recovery options
              </button>
              <button className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                onClick={() => dispatch({ type: 'RESET_DEMO' })}>
                <RotateCcw size={13} /> Reset demo
              </button>
            </>
          )}
        </div>
      )}

      {/* Hero */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-navy to-sky-950 p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute inset-0 opacity-20 bg-cover bg-center pointer-events-none"
          style={{ backgroundImage: `url('https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=1200&q=80')` }} />
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-sky-300 uppercase tracking-widest">
              <Compass size={14} /> Active Travel Command
            </div>
            <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{greeting()}, Tanvi 👋</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm text-slate-200">
              <span className="flex items-center gap-1.5 font-bold bg-white/10 px-3 py-1 rounded-xl">
                <MapPin size={14} className="text-sky-400" /> Mumbai → Delhi → Manali
              </span>
              <span className="flex items-center gap-1.5"><CalendarDays size={14} /> 12 – 18 Sep 2026</span>
              <span className="flex items-center gap-1.5"><Users size={14} /> 5 travellers</span>
            </div>
          </div>
          <StatusChip status={state.phase === 'normal' ? 'ongoing' : state.phase} />
        </div>
      </header>

      {disrupted && <DisruptionBanner />}
      <DisruptionModal open={demoOpen} onClose={() => setDemoOpen(false)} />
      <RefundModal open={refundOpen} onClose={() => setRefundOpen(false)} deadlineTs={state.deadlineTs} />
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────
export default function HomePage() {
  const { isDemoUser, activeTrip, tripsLoading, tripsLoaded } = useTrip();
  const { displayName, user, profile } = useAuth();

  if (isDemoUser) {
    return <DemoDashboard />;
  }

  if (tripsLoading || !tripsLoaded) {
    return (
      <div className="space-y-4 animate-pulse max-w-2xl mx-auto">
        <div className="h-12 w-64 rounded-2xl bg-navy/10" />
        <div className="h-36 rounded-3xl bg-navy/10" />
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-20 rounded-2xl bg-navy/10" />)}
        </div>
        <div className="h-44 rounded-3xl bg-navy/10" />
      </div>
    );
  }

  if (!activeTrip) {
    return <EmptyStateDashboard user={user} profile={profile} displayName={displayName} />;
  }

  return <RealTripDashboard trip={activeTrip} displayName={displayName} user={user} profile={profile} />;
}