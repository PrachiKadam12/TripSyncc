import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  AlarmClock,
  ArrowRight,
  BadgeCheck,
  Bot,
  CalendarDays,
  FileText,
  FlaskConical,
  LifeBuoy,
  MapPin,
  RotateCcw,
  Users,
  Wrench,
  Clock,
  Plus,
  Receipt,
  Upload,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Plane,
  Hotel,
  Ticket,
  Car,
  X,
  Sparkles,
  Wallet,
  ShieldCheck,
  Compass,
} from 'lucide-react';
import { useTrip } from '../../context/TripContext.jsx';
import { recoveryPlans } from '../../data/demoTrip.js';
import { whatChanged } from '../../utils/impact.js';
import DisruptionBanner from '../../components/DisruptionBanner.jsx';
import DisruptionModal from '../../components/DisruptionModal.jsx';
import StatusChip from '../../components/StatusChip.jsx';
import RefundModal from '../../components/RefundModal.jsx';
import { fetchDashboard } from '../../services/dashboardService.js';
import { formatInr } from '../../utils/finance.js';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const NEXT_UP_ICONS = {
  flight: Plane,
  hotel: Hotel,
  transfer: Car,
  activity: Ticket,
};

export default function HomePage() {
  const { state, dispatch } = useTrip();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [dataSource, setDataSource] = useState('loading');
  const [apiError, setApiError] = useState(null);

  const [demoOpen, setDemoOpen] = useState(false);
  const [showDemoControls, setShowDemoControls] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      const res = await fetchDashboard();
      if (isMounted) {
        setDashboardData(res.data);
        setDataSource(res.source);
        setApiError(res.error);
        setLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleAddAction = (type, route) => {
    setAddModalOpen(false);
    triggerToast(`Opening Add ${type}...`);
    setTimeout(() => navigate(route), 400);
  };

  const disrupted = state.phase !== 'normal' && state.phase !== 'recovered';
  const changed = whatChanged(state);
  const appliedPlan = recoveryPlans.find((p) => p.id === state.appliedPlanId) || null;

  // Real or fallback data sources
  const profile = dashboardData?.profile || { full_name: 'Tanvi' };
  const currentTrip = dashboardData?.current_trip || {
    title: 'Mumbai → Delhi → Manali',
    dates_label: '12 – 18 Sep 2026',
    route: ['Mumbai', 'Delhi', 'Manali'],
    travelers_count: 5,
  };
  const nextEvent = dashboardData?.next_event;
  const bookings = dashboardData?.bookings || [];
  const groupMembers = dashboardData?.group_members || [];
  const documents = dashboardData?.documents || [];
  const budget = dashboardData?.budget || {
    total_budget: 40000,
    total_spent: 31200,
    remaining: 8800,
  };

  const spentPercent = Math.min(100, Math.round((budget.total_spent / (budget.total_budget || 1)) * 100));
  const NextIcon = (nextEvent && NEXT_UP_ICONS[nextEvent.type]) || Plane;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-5 right-5 z-50 flex items-center gap-2 rounded-2xl bg-navy px-4 py-3 text-xs font-bold text-white shadow-2xl"
          >
            <Sparkles size={15} className="text-sky-400" />
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Discreet Demo Controls Toolbar */}
      <div className="rounded-2xl border border-navy/10 bg-white/70 backdrop-blur-md p-2.5 shadow-sm text-xs">
        <div className="flex items-center justify-between px-2">
          <button
            onClick={() => setShowDemoControls((v) => !v)}
            className="flex items-center gap-1.5 font-bold text-navy-soft hover:text-navy transition-colors"
          >
            <FlaskConical size={15} className="text-sky-600" />
            <span>Demo Controls</span>
            <span className="text-[10px] text-ink-faint">({showDemoControls ? 'Hide' : 'Show'})</span>
          </button>
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
              dataSource === 'backend'
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                : 'bg-amber-100 text-amber-800 border border-amber-200'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${dataSource === 'backend' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            {dataSource === 'backend' ? 'FastAPI / Supabase Connected' : 'Demo Mode'}
          </span>
        </div>

        {showDemoControls && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-2.5 pt-2 border-t border-navy/10 flex flex-wrap items-center gap-2 px-2"
          >
            {state.phase === 'normal' ? (
              <button className="btn-danger text-xs py-1.5 px-3" onClick={() => setDemoOpen(true)}>
                <Wrench size={13} /> Simulate disruption
              </button>
            ) : (
              <>
                <button
                  className="btn-primary text-xs py-1.5 px-3"
                  onClick={() => {
                    dispatch({ type: 'FIND_OPTIONS' });
                    navigate('/app/recovery');
                  }}
                >
                  <LifeBuoy size={13} /> Recovery options
                </button>
                <button className="btn-secondary text-xs py-1.5 px-3" onClick={() => dispatch({ type: 'RESET_DEMO' })}>
                  <RotateCcw size={13} /> Reset demo
                </button>
              </>
            )}
          </motion.div>
        )}
      </div>

      {/* 1. TRAVEL HERO BANNER & GREETING */}
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-navy to-sky-950 p-6 sm:p-8 text-white shadow-xl">
        <div
          className="absolute inset-0 opacity-20 bg-cover bg-center pointer-events-none"
          style={{ backgroundImage: `url('https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?auto=format&fit=crop&w=1200&q=80')` }}
        />
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-sky-300 uppercase tracking-widest">
              <Compass size={14} className="animate-spin-slow" /> Active Travel Command
            </div>
            <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
              {greeting()}, {profile.full_name} 👋
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm text-slate-200">
              <span className="flex items-center gap-1.5 font-bold bg-white/10 px-3 py-1 rounded-xl backdrop-blur-md">
                <MapPin size={14} className="text-sky-400" />
                {currentTrip.title}
              </span>
              <span className="flex items-center gap-1.5">
                <CalendarDays size={14} /> {currentTrip.dates_label}
              </span>
              <span className="flex items-center gap-1.5">
                <Users size={14} /> {currentTrip.travelers_count} travellers
              </span>
            </div>
          </div>
          <StatusChip status={state.phase === 'normal' ? 'ongoing' : state.phase} />
        </div>
      </header>

      {/* Disruption Banner when active */}
      {disrupted && <DisruptionBanner />}

      {/* Skeleton Loading View */}
      {loading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-44 rounded-3xl bg-navy/10" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="h-24 rounded-2xl bg-navy/10" />
            <div className="h-24 rounded-2xl bg-navy/10" />
            <div className="h-24 rounded-2xl bg-navy/10" />
            <div className="h-24 rounded-2xl bg-navy/10" />
          </div>
        </div>
      ) : (
        <>
          {/* 2. NEXT UP — MOST IMPORTANT SECTION */}
          {nextEvent && (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              aria-label="Next Up"
            >
              <div className="relative overflow-hidden rounded-3xl border-2 border-sky-500/30 bg-white p-5 sm:p-6 shadow-md transition-all hover:shadow-lg">
                <div className="flex items-center justify-between gap-2 border-b border-navy/5 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-sky-500 animate-ping" />
                    <span className="text-xs font-black uppercase tracking-widest text-sky-600">
                      NEXT UP ON YOUR TRIP
                    </span>
                  </div>
                  {nextEvent.booking_ref && (
                    <span className="rounded-lg bg-sky-50 px-2.5 py-1 text-[11px] font-mono font-bold text-sky-700 border border-sky-200">
                      PNR {nextEvent.booking_ref}
                    </span>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-500 text-white shadow-md">
                      <NextIcon size={24} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg font-black text-navy truncate">{nextEvent.title}</h3>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-soft">
                        <MapPin size={13} className="text-sky-500 shrink-0" />
                        {nextEvent.location}
                      </p>
                      <p className="mt-1 text-xs font-bold text-navy flex items-center gap-1.5">
                        <Clock size={13} className="text-sky-600" />
                        {nextEvent.start_time ? new Date(nextEvent.start_time).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : 'Scheduled'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => navigate('/app/trip')}
                    className="btn-primary py-2.5 px-4 text-xs font-bold shadow-md hover:shadow-lg shrink-0 self-center"
                  >
                    View booking <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </motion.section>
          )}

          {/* 3. TRIP AT A GLANCE (2x2 Interactive Travel Wallet Grid) */}
          <section aria-label="Your Trip Navigation">
            <h2 className="text-xs font-black uppercase tracking-wider text-ink-faint mb-3">
              YOUR TRIP WALLET
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <button
                onClick={() => navigate('/app/trip')}
                className="group flex flex-col justify-between rounded-2xl border border-navy/10 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-1 hover:border-sky-400 hover:shadow-md active:scale-95"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600 font-bold group-hover:bg-sky-500 group-hover:text-white transition-colors">
                    <CalendarDays size={18} />
                  </div>
                  <ChevronRight size={16} className="text-ink-faint group-hover:text-sky-500 transition-colors" />
                </div>
                <div className="mt-4">
                  <p className="text-sm font-extrabold text-navy">Itinerary</p>
                  <p className="text-xs text-ink-soft font-medium">5 scheduled →</p>
                </div>
              </button>

              <button
                onClick={() => navigate('/app/trip')}
                className="group flex flex-col justify-between rounded-2xl border border-navy/10 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-1 hover:border-sky-400 hover:shadow-md active:scale-95"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 font-bold group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                    <Ticket size={18} />
                  </div>
                  <ChevronRight size={16} className="text-ink-faint group-hover:text-emerald-500 transition-colors" />
                </div>
                <div className="mt-4">
                  <p className="text-sm font-extrabold text-navy">Bookings</p>
                  <p className="text-xs text-ink-soft font-medium">{bookings.length} booked →</p>
                </div>
              </button>

              <button
                onClick={() => navigate('/app/group')}
                className="group flex flex-col justify-between rounded-2xl border border-navy/10 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-1 hover:border-sky-400 hover:shadow-md active:scale-95"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 font-bold group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                    <Users size={18} />
                  </div>
                  <ChevronRight size={16} className="text-ink-faint group-hover:text-indigo-500 transition-colors" />
                </div>
                <div className="mt-4">
                  <p className="text-sm font-extrabold text-navy">Group</p>
                  <p className="text-xs text-ink-soft font-medium">{groupMembers.length} travellers →</p>
                </div>
              </button>

              <button
                onClick={() => navigate('/app/documents')}
                className="group flex flex-col justify-between rounded-2xl border border-navy/10 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-1 hover:border-sky-400 hover:shadow-md active:scale-95"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600 font-bold group-hover:bg-purple-500 group-hover:text-white transition-colors">
                    <FileText size={18} />
                  </div>
                  <ChevronRight size={16} className="text-ink-faint group-hover:text-purple-500 transition-colors" />
                </div>
                <div className="mt-4">
                  <p className="text-sm font-extrabold text-navy">Documents</p>
                  <p className="text-xs text-ink-soft font-medium">{documents.length} saved →</p>
                </div>
              </button>
            </div>
          </section>

          {/* 4. MONEY — COMPACT TRAVEL BUDGET SECTION */}
          <section aria-label="Money" className="rounded-3xl border border-navy/10 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-black uppercase tracking-wider text-navy flex items-center gap-1.5">
                <Wallet size={16} className="text-emerald-600" /> TRAVEL BUDGET
              </h2>
              <button onClick={() => navigate('/app/finance')} className="btn-ghost text-xs py-0 font-bold text-sky-600">
                View expenses →
              </button>
            </div>

            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <span className="text-2xl font-black text-navy">{formatInr(budget.remaining)}</span>
                <span className="text-xs font-bold text-emerald-600 ml-2">remaining</span>
              </div>
              <p className="text-xs text-ink-soft font-medium">
                {formatInr(budget.total_spent)} spent of {formatInr(budget.total_budget)}
              </p>
            </div>

            {/* Travel Green Budget Progress Bar */}
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-emerald-500 transition-all duration-500 rounded-full"
                style={{ width: `${spentPercent}%` }}
              />
            </div>
          </section>

          {/* 5. DIGITAL TRAVEL WALLET — DOCUMENTS PREVIEW */}
          <section aria-label="Important Documents" className="rounded-3xl border border-navy/10 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-black uppercase tracking-wider text-navy flex items-center gap-1.5">
                <ShieldCheck size={16} className="text-sky-600" /> DIGITAL TRAVEL WALLET
              </h2>
              <button onClick={() => navigate('/app/documents')} className="btn-ghost text-xs py-0 font-bold text-sky-600">
                View all →
              </button>
            </div>

            <div className="space-y-2">
              {documents.slice(0, 3).map((d) => (
                <div key={d.id || d.doc_key} className="flex items-center justify-between rounded-2xl bg-slate-50 p-3 text-xs border border-slate-100">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText size={16} className="text-sky-600 shrink-0" />
                    <span className="font-extrabold text-navy truncate">{d.title}</span>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 shrink-0">
                    {d.is_offline ? 'Offline Ready' : 'Cloud'}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* 6. UNIFIED "+ Add to trip" ACTION BUTTON */}
          <div className="pt-2 flex justify-center">
            <button
              onClick={() => setAddModalOpen(true)}
              className="btn-primary w-full sm:w-auto px-8 py-3.5 rounded-2xl text-sm font-black shadow-lg flex items-center justify-center gap-2 hover:shadow-xl active:scale-95 transition-all"
            >
              <Plus size={20} /> Add to trip
            </button>
          </div>
        </>
      )}

      {/* Add To Trip Sheet Modal */}
      <AnimatePresence>
        {addModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-4 backdrop-blur-sm"
            onClick={() => setAddModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-float border border-navy/10"
            >
              <div className="flex items-center justify-between border-b border-navy/10 pb-3">
                <h3 className="text-base font-black text-navy">Add to trip</h3>
                <button onClick={() => setAddModalOpen(false)} className="rounded-full p-1 text-ink-soft hover:bg-navy/5">
                  <X size={18} />
                </button>
              </div>

              <div className="mt-4 space-y-2.5">
                {[
                  { label: 'Booking', desc: 'Flight, Hotel, Cab, or Activity', icon: Plane, route: '/app/trip' },
                  { label: 'Expense', desc: 'Log a personal or group cost', icon: Receipt, route: '/app/finance' },
                  { label: 'Document', desc: 'Upload ticket, voucher, or ID', icon: Upload, route: '/app/documents' },
                  { label: 'Itinerary Item', desc: 'Schedule a plan or reminder', icon: CalendarDays, route: '/app/trip' },
                ].map(({ label, desc, icon: Icon, route }) => (
                  <button
                    key={label}
                    onClick={() => handleAddAction(label, route)}
                    className="flex w-full items-center gap-3.5 rounded-2xl border border-navy/5 p-3.5 text-left transition-all hover:border-sky-500 hover:bg-sky-50/50 group"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 font-bold group-hover:bg-sky-500 group-hover:text-white transition-colors">
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

      <DisruptionModal open={demoOpen} onClose={() => setDemoOpen(false)} />
      <RefundModal open={refundOpen} onClose={() => setRefundOpen(false)} deadlineTs={state.deadlineTs} />
    </div>
  );
}