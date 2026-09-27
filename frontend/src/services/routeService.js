/**
 * routeService.js — TripSync Stage 12 Route & Travel Time Service (OpenRouteService)
 * Queries FastAPI backend proxy for OpenRouteService driving distances and durations.
 * Fails gracefully to geographic road-distance estimations if API key is not configured.
 */

const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || 'http://localhost:8000';

export async function fetchRouteDuration(fromCoords, toCoords, profile = 'driving-car') {
  if (!fromCoords || !toCoords) return null;

  const url = new URL(`${API_BASE_URL}/api/travel-risk/route-duration`);
  url.searchParams.set('from_lng', fromCoords.lng);
  url.searchParams.set('from_lat', fromCoords.lat);
  url.searchParams.set('to_lng', toCoords.lng);
  url.searchParams.set('to_lat', toCoords.lat);
  url.searchParams.set('profile', profile);

  try {
    const res = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`Route service returned status ${res.status}`);
    }

    const json = await res.json();
    if (json.status === 'success' && json.route) {
      return {
        source: 'openrouteservice_live',
        ...json.route,
      };
    }

    return fallbackRouteEstimate(fromCoords, toCoords, json.error);
  } catch (err) {
    console.warn('[routeService] OpenRouteService request error:', err.message);
    return fallbackRouteEstimate(fromCoords, toCoords, err.message);
  }
}

/**
 * Geometric road distance estimation fallback
 */
function fallbackRouteEstimate(from, to, reason) {
  // Haversine formula
  const R = 6371; // Earth radius in km
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((from.lat * Math.PI) / 180) *
      Math.cos((to.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightDistanceKm = R * c;

  // Road factor for mountain or highway terrain (1.4x straight line)
  const estimatedRoadKm = Math.round(straightDistanceKm * 1.38);
  // Average road speed 55 km/h
  const durationMinutes = Math.round((estimatedRoadKm / 52) * 60);

  return {
    source: 'estimated_fallback',
    note: reason,
    distance_km: estimatedRoadKm,
    duration_minutes: durationMinutes,
    profile: 'driving-car',
  };
}
