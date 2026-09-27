/**
 * flightStatusService.js — TripSync Stage 12 Flight Status Integration
 * Communicates with FastAPI backend proxy to query AviationStack without exposing secret keys.
 * Fails gracefully and supports intelligent demo fallback.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export async function checkFlightStatus(flightIata, flightDate = '') {
  if (!flightIata) return null;

  const cleanIata = flightIata.trim().toUpperCase().replace(/\s+/g, '');
  const url = new URL(`${API_BASE_URL}/api/travel-risk/flight-status`);
  url.searchParams.set('flight_iata', cleanIata);
  if (flightDate) {
    url.searchParams.set('flight_date', flightDate);
  }

  try {
    const res = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`Flight status endpoint returned ${res.status}`);
    }

    const json = await res.json();

    if (json.status === 'success' && json.flight) {
      return {
        source: 'aviationstack_live',
        ...json.flight,
      };
    }

    // If key not configured or flight not found in live sandbox
    return handleFallbackFlight(cleanIata, json.error || 'AviationStack live data unavailable');
  } catch (err) {
    console.warn('[flightStatusService] Live flight check error:', err.message);
    return handleFallbackFlight(cleanIata, err.message);
  }
}

/**
 * Deterministic fallback for known demo flights or offline simulation
 */
function handleFallbackFlight(cleanIata, reason) {
  // Check if this matches AI-123 or common test flights
  const isDemoFlight = cleanIata.includes('AI123') || cleanIata.includes('123');

  return {
    source: 'simulated_fallback',
    note: reason,
    flight_iata: cleanIata,
    airline_name: cleanIata.startsWith('AI') ? 'Air India' : cleanIata.startsWith('6E') ? 'IndiGo' : 'Airline',
    flight_status: isDemoFlight ? 'cancelled' : 'scheduled',
    scheduled_departure: '08:30',
    estimated_departure: isDemoFlight ? null : '08:30',
    scheduled_arrival: '10:45',
    estimated_arrival: isDemoFlight ? null : '10:45',
    delay_minutes: isDemoFlight ? 0 : 0,
    disruption_type: isDemoFlight ? 'Flight Cancellation' : null,
    severity: isDemoFlight ? 'critical' : 'none',
    is_disrupted: isDemoFlight,
  };
}
