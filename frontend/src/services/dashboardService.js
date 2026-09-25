/**
 * dashboardService.js — Frontend service layer connecting React to FastAPI & Supabase
 */
import {
  currentTripMeta,
  traveler,
  currentBookings,
  groupMembers,
  documents as demoDocs,
  BUDGET,
} from '../data/demoTrip.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const DEFAULT_TRIP_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 4000 } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    clearTimeout(id);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

/**
 * Fetch full aggregate dashboard payload from FastAPI / Supabase
 */
export async function fetchDashboard(tripId = DEFAULT_TRIP_ID) {
  try {
    const data = await fetchWithTimeout(`${API_BASE_URL}/api/trips/${tripId}/dashboard`);
    return { data, source: 'backend', error: null };
  } catch (err) {
    console.warn('Backend API request failed or timed out. Falling back to local data:', err.message);
    // Construct robust fallback payload matching schema
    const fallbackData = {
      profile: {
        id: traveler.id,
        username: traveler.id,
        full_name: traveler.name,
        home_city: traveler.city,
      },
      current_trip: {
        id: currentTripMeta.id,
        title: currentTripMeta.title,
        origin: currentTripMeta.route[0] || 'Mumbai',
        destination: currentTripMeta.route[currentTripMeta.route.length - 1] || 'Manali',
        route: currentTripMeta.route,
        start_date: '2026-09-12',
        end_date: '2026-09-18',
        dates_label: currentTripMeta.datesLabel,
        status: 'normal',
        travelers_count: currentTripMeta.travelers,
      },
      next_event: {
        id: 'i1',
        trip_id: currentTripMeta.id,
        title: 'Outbound Flight AI-123',
        type: 'flight',
        location: 'Mumbai (BOM) → Delhi (DEL)',
        start_time: '2026-09-12T08:30:00+05:30',
        end_time: '2026-09-12T10:30:00+05:30',
        status: 'scheduled',
        booking_ref: 'AI9X4K2',
        sort_order: 1,
      },
      itinerary: [
        {
          id: 'i1',
          trip_id: currentTripMeta.id,
          title: 'Outbound Flight AI-123',
          type: 'flight',
          location: 'Mumbai (BOM) → Delhi (DEL)',
          start_time: '2026-09-12T08:30:00+05:30',
          end_time: '2026-09-12T10:30:00+05:30',
          status: 'scheduled',
          booking_ref: 'AI9X4K2',
          sort_order: 1,
        },
      ],
      bookings: Object.values(currentBookings),
      budget: {
        trip_id: currentTripMeta.id,
        total_budget: BUDGET,
        total_spent: 31200,
        at_risk: 6500,
        remaining: BUDGET - 31200,
      },
      expenses: [],
      group_members: groupMembers,
      documents: demoDocs,
    };
    return { data: fallbackData, source: 'local_fallback', error: err.message };
  }
}

/**
 * Fetch profile endpoint
 */
export async function fetchProfile() {
  try {
    const data = await fetchWithTimeout(`${API_BASE_URL}/api/profile/me`);
    return { data, source: 'backend' };
  } catch (err) {
    return {
      data: {
        id: traveler.id,
        username: traveler.id,
        full_name: traveler.name,
        home_city: traveler.city,
      },
      source: 'local_fallback',
    };
  }
}

/**
 * Fetch next upcoming itinerary item
 */
export async function fetchNextEvent(tripId = DEFAULT_TRIP_ID) {
  try {
    const data = await fetchWithTimeout(`${API_BASE_URL}/api/trips/${tripId}/itinerary/next`);
    return { data, source: 'backend' };
  } catch (err) {
    return {
      data: {
        id: 'i1',
        title: 'Outbound Flight AI-123',
        type: 'flight',
        location: 'Mumbai (BOM) → Delhi (DEL)',
        start_time: '2026-09-12T08:30:00+05:30',
        booking_ref: 'AI9X4K2',
      },
      source: 'local_fallback',
    };
  }
}
