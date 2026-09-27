import { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlarmClock,
  Bot,
  ChevronLeft,
  FileText,
  Home,
  LifeBuoy,
  List,
  LogOut,
  Plane,
  Route,
  Users,
  Wallet,
  Wifi,
  WifiOff,
  Siren,
  Ticket,
  Compass,
  UserCheck,
} from 'lucide-react';
import { useTrip } from '../../context/TripContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

const SIDE_NAV = [
  { to: '/app', label: 'Overview', Icon: Home, end: true },
  { to: '/app/twin', label: 'Weather Twin', Icon: Compass },
  { to: '/app/profile', label: 'Travel Profile', Icon: UserCheck },
  { to: '/app/trip', label: 'Itinerary & Bookings', Icon: Ticket },
  { to: '/app/finance', label: 'Money & Budget', Icon: Wallet },
  { to: '/app/documents', label: 'Digital Wallet', Icon: FileText },
  { to: '/app/group', label: 'Group Travellers', Icon: Users },
  { to: '/app/recovery', label: 'Recovery Center', Icon: LifeBuoy },
  { to: '/app/deadlines', label: 'Deadlines Guard', Icon: AlarmClock },
  { to: '/app/assistant', label: 'AI Assistant', Icon: Bot },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { state, dispatch } = useTrip();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const menuRef = useRef(null);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (_) {}
    navigate('/');
  };

  useEffect(() => {
    if (!menuRef.current) return;
    const el = menuRef.current;
    const handleOutside = (e) => {
      if (!el.contains(e.target)) {
        setCollapsed(true);
      }
    };
    let raf;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(handleOutside);
    };
    window.addEventListener('pointerdown', schedule, true);
    return () => {
      window.removeEventListener('pointerdown', schedule, true);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      {/* Persistent mobile menu button */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="fixed bottom-20 left-4 z-40 lg:hidden rounded-2xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-xl flex items-center gap-2 active:scale-95"
        aria-expanded={!collapsed}
        aria-label={!collapsed ? 'Close navigation menu' : 'Open navigation menu'}
      >
        <List size={16} />
        {!collapsed ? 'Close Menu' : 'Travel Menu'}
      </button>

      {/* Desktop Travel Command Sidebar */}
      <aside
        className={`sticky top-0 hidden lg:flex h-screen shrink-0 flex-col border-r border-navy/10 bg-white/90 backdrop-blur-xl shadow-sm transition-[width] duration-300 ${
          collapsed ? 'w-[78px]' : 'w-64'
        }`}
        aria-label="Main navigation"
      >
        <NavLink
          to="/"
          title="TripSync Travel Command"
          className={`flex items-center gap-3 px-5 py-5 border-b border-navy/5 ${collapsed ? 'justify-center px-0' : ''}`}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-500 text-white shadow-md">
            <Plane size={20} />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-base font-black tracking-tight text-navy">TripSync</p>
              <p className="truncate text-[10px] font-bold text-sky-600 uppercase tracking-widest">Travel Command</p>
            </div>
          )}
        </NavLink>

        <button
          onClick={() => setCollapsed((c) => !c)}
          className={`mx-3 my-3 flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold text-navy-soft hover:bg-navy/5 transition-colors ${
            collapsed ? 'justify-center px-0' : ''
          }`}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft size={15} className={`transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
          {!collapsed && 'Collapse'}
        </button>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {SIDE_NAV.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-xs font-bold transition-all ${
                  collapsed ? 'justify-center px-0' : ''
                } ${
                  isActive
                    ? 'bg-sky-500 text-white shadow-md'
                    : 'text-navy-soft hover:bg-sky-50 hover:text-sky-600'
                }`
              }
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* SOS Emergency Module */}
        <div className="border-t border-navy/5 p-3">
          <button
            onClick={() => {
              dispatch({ type: 'REQUEST_SOS_OPEN' });
              window.dispatchEvent(new CustomEvent('tripsync:sos-open'));
            }}
            title="Open Emergency Assistance"
            className={`flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-xs font-bold transition-all ${
              collapsed ? 'justify-center px-0' : ''
            } bg-red-600 text-white hover:bg-red-700 shadow-md active:scale-95`}
          >
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping bg-white" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
            </span>
            {!collapsed && (
              <span className="flex-1 text-left">
                <Siren size={14} className="inline mr-1" />
                Emergency SOS
              </span>
            )}
          </button>
        </div>

        {/* Online / Offline status */}
        <div className="border-t border-navy/5 p-3">
          <button
            onClick={() => dispatch({ type: 'SET_OFFLINE', offline: !state.offline })}
            className={`flex w-full items-center gap-2.5 rounded-2xl px-3 py-2 text-xs font-bold transition-colors ${
              collapsed ? 'justify-center px-0' : ''
            } ${state.offline ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'}`}
          >
            <span className={`h-2 w-2 rounded-full ${state.offline ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            {!collapsed && (
              <span className="flex-1 text-left truncate">
                {state.offline ? 'Simulated Offline' : 'Live Sync Active'}
              </span>
            )}
          </button>
        </div>

        {/* Sign Out */}
        <div className="border-t border-navy/5 p-3">
          <button
            onClick={handleSignOut}
            title="Sign Out"
            className={`flex w-full items-center gap-2.5 rounded-2xl px-3 py-2 text-xs font-bold text-rose-500 hover:bg-rose-50 transition-colors ${
              collapsed ? 'justify-center px-0' : ''
            }`}
          >
            <LogOut size={16} className="shrink-0" />
            {!collapsed && <span className="flex-1 text-left">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Slide-Out Drawer Menu */}
      <AnimatePresence>
        {!collapsed && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCollapsed(true)}
            />
            <motion.nav
              ref={menuRef}
              className="fixed left-0 top-0 z-50 h-full w-72 max-w-full bg-white shadow-2xl lg:hidden flex flex-col"
              initial={{ x: -100 }}
              animate={{ x: 0 }}
              exit={{ x: -100 }}
              transition={{ type: 'tween', duration: 0.2 }}
            >
              <div className="flex items-center justify-between border-b border-navy/10 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-500 text-white shadow-md">
                    <Plane size={20} />
                  </div>
                  <div>
                    <p className="text-base font-black text-navy">TripSync</p>
                    <p className="text-[10px] font-bold text-sky-600 uppercase">Digital Travel Command</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCollapsed(true)}
                  className="rounded-full p-2 text-ink-soft hover:bg-navy/5"
                >
                  <ChevronLeft size={20} className="rotate-180" />
                </button>
              </div>

              <div className="flex-1 space-y-1.5 overflow-y-auto p-4">
                {SIDE_NAV.map(({ to, label, Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setCollapsed(true)}
                    className={({ isActive }) =>
                      `flex items-center gap-3.5 rounded-2xl px-4 py-3 text-xs font-bold transition-all ${
                        isActive
                          ? 'bg-sky-500 text-white shadow-md'
                          : 'text-navy-soft hover:bg-sky-50 hover:text-sky-600'
                      }`
                    }
                  >
                    <Icon size={18} className="shrink-0" />
                    <span className="truncate">{label}</span>
                  </NavLink>
                ))}
              </div>

              <div className="p-4 border-t border-navy/10 space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    dispatch({ type: 'REQUEST_SOS_OPEN' });
                    setCollapsed(true);
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-xs font-bold text-white shadow-md active:scale-95"
                >
                  <Siren size={16} /> Emergency SOS
                </button>
                <button
                  type="button"
                  onClick={() => { setCollapsed(true); handleSignOut(); }}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-100 transition active:scale-95"
                >
                  <LogOut size={15} /> Sign Out
                </button>
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
