/**
 * DashboardShell — top-navigation layout for the main dashboard (/app).
 * All other /app/* routes continue to use AppShell (sidebar layout).
 */
import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plane, Search, Bell, ChevronDown, Sun, LogOut,
  Settings, User, X, Mail, Users, Globe, ShieldAlert, CheckCheck, WifiOff
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import Toasts from '../Toasts.jsx';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../../services/notificationService.js';

function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const past = new Date(dateStr);
  const diffMs = now - past;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffDay > 30) return past.toLocaleDateString();
  if (diffDay > 0) return `${diffDay}d ago`;
  if (diffHr > 0) return `${diffHr}h ago`;
  if (diffMin > 0) return `${diffMin}m ago`;
  return 'Just now';
}

function renderEventIcon(eventType) {
  switch (eventType) {
    case 'group_invitation':
      return <Mail size={15} />;
    case 'member_response':
      return <Users size={15} />;
    case 'passport_expiry':
      return <Globe size={15} />;
    case 'insurance_expiry':
      return <ShieldAlert size={15} />;
    default:
      return <Bell size={15} />;
  }
}

const NAV_ITEMS = [
  { to: '/app',            label: 'Overview',        end: true },
  { to: '/app/twin',        label: 'Weather Twin' },
  { to: '/app/trip',       label: 'My Trips' },
  { to: '/app/documents',  label: 'Documents' },
  { to: '/app/profile',    label: 'Travel Profile' },
];

function TopNav() {
  const { user, profile, displayName, signOut } = useAuth();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen]       = useState(false);
  const [notifOpen, setNotifOpen]           = useState(false);
  const [searchVal, setSearchVal]           = useState('');
  const [notifications, setNotifications]   = useState([]);
  const [unreadCount, setUnreadCount]       = useState(0);
  const [isOffline, setIsOffline]           = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const profileRef = useRef(null);
  const notifRef   = useRef(null);

  const initials = (profile?.first_name?.[0] || displayName?.[0] || 'T').toUpperCase();
  const firstName = profile?.first_name || displayName?.split(' ')[0] || 'Traveler';

  function greeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  // Load notifications from IndexedDB + sync with Supabase
  useEffect(() => {
    let mounted = true;
    async function fetchNotifs() {
      try {
        const notifs = await getNotifications(user?.id);
        if (mounted && Array.isArray(notifs)) {
          setNotifications(notifs);
          setUnreadCount(notifs.filter(n => !n.read).length);
        }
      } catch (err) {
        console.warn('Could not load notifications:', err);
      }
    }
    fetchNotifs();

    const handleOnline = () => {
      setIsOffline(false);
      fetchNotifs();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      mounted = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user?.id]);

  const handleMarkAsRead = async (id) => {
    try {
      await markNotificationAsRead(id, user?.id);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.warn('Error marking notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead(user?.id);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.warn('Error marking all notifications as read:', err);
    }
  };

  useEffect(() => {
    function handler(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
      if (notifRef.current  && !notifRef.current.contains(e.target))   setNotifOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/70 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
        <div className="flex h-[72px] items-center gap-5">

          <button onClick={() => navigate('/app')} className="flex items-center gap-2.5 shrink-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 shadow-lg shadow-sky-500/25">
              <Plane size={18} className="text-white" />
            </div>
            <div className="hidden sm:block leading-tight text-left">
              <p className="text-[15px] font-semibold tracking-tight text-navy">TripSync</p>
              <p className="text-[10px] font-medium text-ink-faint">Travel confidently</p>
            </div>
          </button>

          <div className="relative flex-1 max-w-sm hidden md:block">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              value={searchVal}
              onChange={e => setSearchVal(e.target.value)}
              placeholder="Search destinations, trips, documents..."
              className="w-full rounded-full border border-navy/10 bg-periwinkle/70 py-2.5 pl-10 pr-4 text-[13px] text-navy placeholder:text-ink-faint focus:border-sky-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-100 transition"
            />
          </div>

          <nav className="hidden lg:flex items-center gap-1 rounded-full bg-periwinkle/80 p-1">
            {NAV_ITEMS.map(({ to, label, end }) => (
              <NavLink
                key={to} to={to} end={end}
                className={({ isActive }) =>
                  `rounded-full px-4 py-1.5 text-[13px] font-medium transition-all ${
                    isActive
                      ? 'bg-white text-navy shadow-sm'
                      : 'text-ink-soft hover:text-navy'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex-1" />

          <div className="flex items-center gap-1.5">
            <button className="hidden sm:flex h-10 w-10 items-center justify-center rounded-full text-ink-soft hover:bg-periwinkle transition">
              <Sun size={18} />
            </button>

            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen(v => !v)}
                className="relative flex h-10 w-10 items-center justify-center rounded-full text-ink-soft hover:bg-periwinkle transition"
                aria-label="Notifications"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              <AnimatePresence>
                {notifOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                    className="absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl bg-white shadow-float border border-navy/5 overflow-hidden z-50"
                  >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-navy/5 bg-slate-50/50">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-navy">Notifications</p>
                        {unreadCount > 0 && (
                          <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                            {unreadCount} unread
                          </span>
                        )}
                        {isOffline && (
                          <span className="flex items-center gap-1 text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                            <WifiOff size={11} /> Offline Cache
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                          <button
                            onClick={handleMarkAllAsRead}
                            className="text-[11px] font-medium text-primary hover:text-primary-dark transition flex items-center gap-1"
                            title="Mark all as read"
                          >
                            <CheckCheck size={13} />
                            <span>Mark all read</span>
                          </button>
                        )}
                        <button onClick={() => setNotifOpen(false)} className="text-ink-faint hover:text-navy p-1">
                          <X size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="max-h-[360px] overflow-y-auto p-2 space-y-1 divide-y divide-navy/[0.03]">
                      {notifications.length === 0 ? (
                        <div className="py-8 text-center px-4">
                          <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-ink-faint mb-2">
                            <Bell size={18} />
                          </div>
                          <p className="text-sm font-medium text-navy">No notifications</p>
                          <p className="text-xs text-ink-faint mt-1 max-w-[220px] mx-auto">
                            Group invites, member responses, and document expiry alerts will appear here.
                          </p>
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            onClick={() => handleMarkAsRead(n.id)}
                            className={`flex gap-3 p-3 rounded-xl transition cursor-pointer ${
                              !n.read ? 'bg-sky-50/50 hover:bg-sky-50' : 'hover:bg-slate-50 opacity-80 hover:opacity-100'
                            }`}
                          >
                            <div className="shrink-0 mt-0.5">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                n.event_type === 'passport_expiry' || n.event_type === 'insurance_expiry'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-primary/10 text-primary'
                              }`}>
                                {renderEventIcon(n.event_type)}
                              </div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-1">
                                <p className={`text-xs font-semibold truncate ${!n.read ? 'text-navy font-bold' : 'text-navy/80'}`}>
                                  {n.title}
                                </p>
                                {!n.read && (
                                  <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                                )}
                              </div>
                              <p className="text-xs text-ink-soft mt-0.5 line-clamp-2 leading-relaxed">
                                {n.message}
                              </p>
                              <div className="flex items-center justify-between mt-1 text-[10px] text-ink-faint">
                                <span>{formatRelativeTime(n.created_at)}</span>
                                {n.sync_status === 'pending' && (
                                  <span className="text-amber-500 font-medium">Pending sync</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(v => !v)}
                className="flex items-center gap-2.5 rounded-full pl-1 pr-3 py-1 hover:bg-periwinkle transition"
              >
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-sky-400 to-indigo-600 flex items-center justify-center text-white text-sm font-semibold shadow-md">
                  {initials}
                </div>
                <div className="hidden sm:block text-left leading-tight">
                  <p className="text-[11px] text-ink-faint">{greeting()}</p>
                  <p className="text-[13px] font-semibold text-navy">{firstName}</p>
                </div>
                <ChevronDown size={14} className="text-ink-faint" />
              </button>
              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                    className="absolute right-0 mt-3 w-56 rounded-2xl bg-white shadow-float border border-navy/5 overflow-hidden z-50"
                  >
                    <div className="px-4 py-3.5 border-b border-navy/5">
                      <p className="text-sm font-semibold text-navy">{displayName}</p>
                      <p className="text-xs text-ink-faint truncate">{user?.email}</p>
                    </div>
                    <div className="p-1.5 space-y-0.5">
                      <button onClick={() => { navigate('/app/profile'); setProfileOpen(false); }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium text-ink-soft hover:bg-periwinkle">
                        <User size={15} /> Travel Profile
                      </button>
                      <button onClick={() => { navigate('/app/documents'); setProfileOpen(false); }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium text-ink-soft hover:bg-periwinkle">
                        <Settings size={15} /> Settings
                      </button>
                      <button onClick={() => { signOut(); navigate('/'); }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium text-rose-500 hover:bg-rose-50">
                        <LogOut size={15} /> Sign Out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default function DashboardShell({ children }) {
  return (
    <div className="min-h-screen bg-[#F3F6FC] flex flex-col">
      <TopNav />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8 py-6 pb-10">
          {children}
        </div>
      </main>
      <Toasts />
    </div>
  );
}
