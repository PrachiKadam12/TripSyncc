/**
 * tripContext.jsx — Shared trip state that is AUTH-AWARE.
 *
 * Real users get real trips from Supabase.
 * Demo mode (isDemoUser=true) loads demoTrip.js data — completely isolated.
 */
import { createContext, useContext, useEffect, useMemo, useReducer, useState, useCallback } from 'react';
import { getInitialState, tripReducer } from '../utils/tripReducer.js';
import { supabase } from '../services/supabase.js';

const STORAGE_KEY = 'tripsync-state-v1';
const DEMO_STORAGE_KEY = 'tripsync-demo-state-v1';

function loadDemoState() {
  try {
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.phase && parsed?.bookings) return { ...parsed, toasts: [] };
    }
  } catch (_) { /* ignore */ }
  return getInitialState();
}

const TripContext = createContext(null);

export function TripProvider({ children }) {
  const [isDemoUser, setIsDemoUser] = useState(false);
  const [demoState, demoDispatch] = useReducer(tripReducer, undefined, loadDemoState);

  // Real user state
  const [realTrips, setRealTrips] = useState([]);
  const [activeTrip, setActiveTrip] = useState(null);
  const [activeTripId, setActiveTripId] = useState(null);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [tripsLoaded, setTripsLoaded] = useState(false);

  // Persist demo state
  useEffect(() => {
    if (!isDemoUser) return;
    try {
      const { toasts, ...persisted } = demoState;
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(persisted));
    } catch (_) { /* ignore */ }
  }, [demoState, isDemoUser]);

  // Load real trips when auth changes
  const loadRealTrips = useCallback(async () => {
    setTripsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setRealTrips([]);
        setActiveTrip(null);
        setTripsLoaded(true);
        return;
      }
      const { data: trips, error } = await supabase
        .from('trips')
        .select(`
          *,
          bookings(*),
          trip_members(*),
          itinerary_items(*),
          documents(*)
        `)
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setRealTrips(trips || []);

      // Set the most recent active/planned trip as the active one
      const current = trips?.find(t => ['active', 'planned'].includes(t.status)) || trips?.[0] || null;
      setActiveTrip(current);
      setActiveTripId(current?.id || null);
    } catch (err) {
      console.warn('Failed to load trips:', err.message);
      setRealTrips([]);
      setActiveTrip(null);
    } finally {
      setTripsLoading(false);
      setTripsLoaded(true);
    }
  }, []);

  // Reload trips on auth change
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        loadRealTrips();
      } else if (event === 'SIGNED_OUT') {
        setRealTrips([]);
        setActiveTrip(null);
        setActiveTripId(null);
        setTripsLoaded(false);
        setIsDemoUser(false);
      }
    });
    // Initial load
    loadRealTrips();
    return () => subscription.unsubscribe();
  }, [loadRealTrips]);

  const enableDemoMode = useCallback(() => {
    setIsDemoUser(true);
  }, []);

  const disableDemoMode = useCallback(() => {
    setIsDemoUser(false);
  }, []);

  const value = useMemo(() => ({
    // Mode
    isDemoUser,
    enableDemoMode,
    disableDemoMode,

    // Demo state (only valid when isDemoUser=true)
    state: isDemoUser ? demoState : { toasts: [], phase: 'normal', sos: {} },
    dispatch: isDemoUser ? demoDispatch : () => {},

    // Real trip data
    realTrips,
    activeTrip,
    activeTripId,
    tripsLoading,
    tripsLoaded,
    loadRealTrips,
    setActiveTrip,
    setActiveTripId,
    setRealTrips,
  }), [isDemoUser, demoState, realTrips, activeTrip, activeTripId, tripsLoading, tripsLoaded, loadRealTrips, enableDemoMode, disableDemoMode]);

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip() {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error('useTrip must be used inside TripProvider');
  return ctx;
}