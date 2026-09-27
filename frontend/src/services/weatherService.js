/**
 * weatherService.js — TripSync Live Weather Service (Open-Meteo)
 *
 * Open-Meteo is free and requires no API key.
 * Provides live weather, forecasts, geocoding, caching, and deterministic risk scoring.
 */

const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast';
const GEOCODING_BASE = 'https://geocoding-api.open-meteo.com/v1/search';

// ── Cache Configuration ─────────────────────────────────────────────────────
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const weatherCache = new Map();
const geocodeCache = new Map();

// ── Known Coordinates (fallback cache) ─────────────────────────────────────
const KNOWN_COORDINATES = {
  mumbai: { lat: 19.076, lng: 72.8777, name: 'Mumbai' },
  delhi: { lat: 28.6139, lng: 77.209, name: 'Delhi' },
  'new delhi': { lat: 28.6139, lng: 77.209, name: 'New Delhi' },
  manali: { lat: 32.2432, lng: 77.1892, name: 'Manali' },
  kullu: { lat: 31.9579, lng: 77.1095, name: 'Kullu' },
  chandigarh: { lat: 30.7333, lng: 76.7794, name: 'Chandigarh' },
  shimla: { lat: 31.1048, lng: 77.1734, name: 'Shimla' },
  bengaluru: { lat: 12.9716, lng: 77.5946, name: 'Bengaluru' },
  bangalore: { lat: 12.9716, lng: 77.5946, name: 'Bangalore' },
  chennai: { lat: 13.0827, lng: 80.2707, name: 'Chennai' },
  kolkata: { lat: 22.5726, lng: 88.3639, name: 'Kolkata' },
  hyderabad: { lat: 17.385, lng: 78.4867, name: 'Hyderabad' },
  pune: { lat: 18.5204, lng: 73.8567, name: 'Pune' },
  ahmedabad: { lat: 23.0225, lng: 72.5714, name: 'Ahmedabad' },
  jaipur: { lat: 26.9124, lng: 75.7873, name: 'Jaipur' },
  lucknow: { lat: 26.8467, lng: 80.9462, name: 'Lucknow' },
  goa: { lat: 15.2993, lng: 74.124, name: 'Goa' },
  udaipur: { lat: 24.5854, lng: 73.7125, name: 'Udaipur' },
  srinagar: { lat: 34.0837, lng: 74.7973, name: 'Srinagar' },
  leh: { lat: 34.1526, lng: 77.5771, name: 'Leh' },
  'port blair': { lat: 11.6234, lng: 92.7265, name: 'Port Blair' },
  guwahati: { lat: 26.1445, lng: 91.7362, name: 'Guwahati' },
  indore: { lat: 22.7196, lng: 75.8577, name: 'Indore' },
  bhopal: { lat: 23.2599, lng: 77.4126, name: 'Bhopal' },
  nagpur: { lat: 21.1458, lng: 79.0882, name: 'Nagpur' },
  coimbatore: { lat: 11.0168, lng: 76.9558, name: 'Coimbatore' },
  kochi: { lat: 9.9312, lng: 76.2673, name: 'Kochi' },
  trivandrum: { lat: 8.5241, lng: 76.9366, name: 'Thiruvananthapuram' },
  'new york': { lat: 40.7128, lng: -74.006, name: 'New York' },
  london: { lat: 51.5074, lng: -0.1278, name: 'London' },
  dubai: { lat: 25.2048, lng: 55.2708, name: 'Dubai' },
  singapore: { lat: 1.3521, lng: 103.8198, name: 'Singapore' },
  tokyo: { lat: 35.6762, lng: 139.6503, name: 'Tokyo' },
  sydney: { lat: -33.8688, lng: 151.2093, name: 'Sydney' },
  paris: { lat: 48.8566, lng: 2.3522, name: 'Paris' },
  berlin: { lat: 52.52, lng: 13.405, name: 'Berlin' },
  toronto: { lat: 43.6532, lng: -79.3832, name: 'Toronto' },
  'san francisco': { lat: 37.7749, lng: -122.4194, name: 'San Francisco' },
  'los angeles': { lat: 34.0522, lng: -118.2437, name: 'Los Angeles' },
  chicago: { lat: 41.8781, lng: -87.6298, name: 'Chicago' },
};

// ── Weather Risk Thresholds (configurable in one place) ────────────────────
export const RISK_THRESHOLDS = {
  rainfall: { moderate: 3, high: 8, severe: 20, extreme: 35 },
  precipitationProbability: { moderate: 40, high: 65, severe: 85 },
  windSpeed: { moderate: 20, high: 35, severe: 50, extreme: 70 },
  visibility: { moderate: 4000, high: 2000, severe: 1000, extreme: 500 },
  temperature: { cold: 0, hot: 38, extremeCold: -5, extremeHot: 42 },
};

// ── Location Resolution ────────────────────────────────────────────────────

/**
 * Resolve coordinates for a location name.
 * Checks cache first, then known coordinates, then geocoding API.
 */
export async function resolveLocationCoordinates(location) {
  if (!location) return null;
  const normalized = location.trim().toLowerCase();

  // Check geocode cache
  if (geocodeCache.has(normalized)) {
    return geocodeCache.get(normalized);
  }

  // Check known coordinates
  for (const [key, coords] of Object.entries(KNOWN_COORDINATES)) {
    if (normalized.includes(key)) {
      geocodeCache.set(normalized, coords);
      return coords;
    }
  }

  // Geocode via Open-Meteo
  try {
    const res = await fetch(
      `${GEOCODING_BASE}?name=${encodeURIComponent(location)}&count=1&language=en&format=json`
    );
    if (!res.ok) throw new Error('Geocoding failed');
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      const match = data.results[0];
      const coords = {
        lat: match.latitude,
        lng: match.longitude,
        name: match.name,
      };
      geocodeCache.set(normalized, coords);
      return coords;
    }
  } catch (err) {
    console.warn(`[weatherService] Geocoding error for ${location}:`, err.message);
  }
  return null;
}

// ── Cache Helpers ──────────────────────────────────────────────────────────

function getCachedWeather(lat, lng) {
  const key = `${lat.toFixed(2)}_${lng.toFixed(2)}`;
  const cached = weatherCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_DURATION_MS) {
    return cached.data;
  }
  return null;
}

function setCachedWeather(lat, lng, data) {
  const key = `${lat.toFixed(2)}_${lng.toFixed(2)}`;
  weatherCache.set(key, { data, fetchedAt: Date.now() });
}

// ── WMO Weather Code Parser ────────────────────────────────────────────────

function parseWeatherCode(code) {
  if (code === 0) return { condition: 'Clear sky', isAdverse: false };
  if (code >= 1 && code <= 3) return { condition: 'Partly cloudy', isAdverse: false };
  if (code >= 45 && code <= 48) return { condition: 'Fog / Low visibility', isAdverse: true };
  if (code >= 51 && code <= 55) return { condition: 'Drizzle', isAdverse: false };
  if (code >= 61 && code <= 65) return { condition: code === 65 ? 'Heavy rain' : 'Rain', isAdverse: code === 65 };
  if (code >= 71 && code <= 77) return { condition: 'Snow / Sleet', isAdverse: true };
  if (code >= 80 && code <= 82) return { condition: code === 82 ? 'Violent rain showers' : 'Rain showers', isAdverse: code === 82 };
  if (code >= 95 && code <= 99) return { condition: 'Thunderstorm', isAdverse: true };
  return { condition: 'Unknown', isAdverse: false };
}

// ── Deterministic Weather Risk Engine ──────────────────────────────────────

/**
 * Calculate weather risk based on deterministic thresholds.
 * Returns { level, score, reasons }
 */
export function calculateWeatherRisk(weather) {
  if (!weather) return { level: 'LOW', score: 0, reasons: [] };

  const reasons = [];
  let score = 0;

  const rainfall = weather.precipitation || weather.rain || 0;
  const precipProb = weather.precipitationProbability || 0;
  const wind = weather.windSpeed || 0;
  const visibility = weather.visibility || 10000;
  const temp = weather.temperature || 20;

  // Rainfall scoring
  if (rainfall >= RISK_THRESHOLDS.rainfall.extreme) {
    score += 30;
    reasons.push(`Extreme rainfall: ${rainfall} mm`);
  } else if (rainfall >= RISK_THRESHOLDS.rainfall.severe) {
    score += 22;
    reasons.push(`Heavy rainfall: ${rainfall} mm`);
  } else if (rainfall >= RISK_THRESHOLDS.rainfall.high) {
    score += 15;
    reasons.push(`Significant rainfall: ${rainfall} mm`);
  } else if (rainfall >= RISK_THRESHOLDS.rainfall.moderate) {
    score += 8;
    reasons.push(`Moderate rainfall: ${rainfall} mm`);
  }

  // Precipitation probability
  if (precipProb >= RISK_THRESHOLDS.precipitationProbability.severe) {
    score += 15;
    reasons.push(`Very high precipitation probability: ${precipProb}%`);
  } else if (precipProb >= RISK_THRESHOLDS.precipitationProbability.high) {
    score += 10;
    reasons.push(`High precipitation probability: ${precipProb}%`);
  } else if (precipProb >= RISK_THRESHOLDS.precipitationProbability.moderate) {
    score += 5;
    reasons.push(`Moderate precipitation probability: ${precipProb}%`);
  }

  // Wind scoring
  if (wind >= RISK_THRESHOLDS.windSpeed.extreme) {
    score += 25;
    reasons.push(`Extreme wind: ${wind} km/h`);
  } else if (wind >= RISK_THRESHOLDS.windSpeed.severe) {
    score += 18;
    reasons.push(`Very strong wind: ${wind} km/h`);
  } else if (wind >= RISK_THRESHOLDS.windSpeed.high) {
    score += 12;
    reasons.push(`Strong wind: ${wind} km/h`);
  } else if (wind >= RISK_THRESHOLDS.windSpeed.moderate) {
    score += 6;
    reasons.push(`Moderate wind: ${wind} km/h`);
  }

  // Visibility scoring
  if (visibility <= RISK_THRESHOLDS.visibility.extreme) {
    score += 20;
    reasons.push(`Extremely poor visibility: ${(visibility / 1000).toFixed(1)} km`);
  } else if (visibility <= RISK_THRESHOLDS.visibility.severe) {
    score += 14;
    reasons.push(`Severely reduced visibility: ${(visibility / 1000).toFixed(1)} km`);
  } else if (visibility <= RISK_THRESHOLDS.visibility.high) {
    score += 9;
    reasons.push(`Reduced visibility: ${(visibility / 1000).toFixed(1)} km`);
  } else if (visibility <= RISK_THRESHOLDS.visibility.moderate) {
    score += 4;
    reasons.push(`Moderate visibility: ${(visibility / 1000).toFixed(1)} km`);
  }

  // Temperature extremes
  if (temp <= RISK_THRESHOLDS.temperature.extremeCold || temp >= RISK_THRESHOLDS.temperature.extremeHot) {
    score += 15;
    reasons.push(`Extreme temperature: ${temp}°C`);
  } else if (temp <= RISK_THRESHOLDS.temperature.cold || temp >= RISK_THRESHOLDS.temperature.hot) {
    score += 8;
    reasons.push(`Temperature extreme: ${temp}°C`);
  }

  // Weather code based
  const codeInfo = parseWeatherCode(weather.weatherCode || 0);
  if (codeInfo.condition === 'Thunderstorm') {
    score += 20;
    reasons.push('Thunderstorm detected');
  } else if (codeInfo.condition === 'Heavy rain') {
    score += 12;
    reasons.push('Heavy rain detected');
  } else if (codeInfo.condition === 'Snow / Sleet') {
    score += 12;
    reasons.push('Snow or sleet detected');
  } else if (codeInfo.condition === 'Fog / Low visibility') {
    score += 8;
    reasons.push('Fog or low visibility');
  }

  score = Math.min(100, score);

  let level = 'LOW';
  if (score >= 70) level = 'SEVERE';
  else if (score >= 45) level = 'HIGH';
  else if (score >= 20) level = 'MODERATE';

  return { level, score, reasons };
}

// ── Main Weather Fetcher ──────────────────────────────────────────────────

/**
 * Fetch live weather for coordinates with full Open-Meteo data.
 * Returns normalized response with current, hourly, daily, and risk.
 */
export async function fetchWeather(lat, lng) {
  // Check cache first
  const cached = getCachedWeather(lat, lng);
  if (cached) {
    return { ...cached, fromCache: true };
  }

  try {
    const url = `${OPEN_METEO_BASE}?latitude=${lat}&longitude=${lng}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,snowfall,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility` +
      `&hourly=temperature_2m,precipitation_probability,precipitation,rain,showers,snowfall,weather_code,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,visibility` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,rain_sum,precipitation_probability_max,wind_speed_10m_max` +
      `&timezone=auto&forecast_days=3`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Weather fetch failed: ${res.status}`);
    const data = await res.json();

    const current = data.current || {};
    const hourly = data.hourly || {};
    const daily = data.daily || {};

    const codeInfo = parseWeatherCode(current.weather_code ?? 0);

    const weatherData = {
      location: {
        name: '',
        latitude: lat,
        longitude: lng,
      },
      current: {
        temperature: current.temperature_2m ?? null,
        apparentTemperature: current.apparent_temperature ?? null,
        humidity: current.relative_humidity_2m ?? null,
        precipitation: current.precipitation ?? 0,
        rain: current.rain ?? 0,
        showers: current.showers ?? 0,
        snowfall: current.snowfall ?? 0,
        weatherCode: current.weather_code ?? 0,
        cloudCover: current.cloud_cover ?? null,
        windSpeed: current.wind_speed_10m ?? null,
        windDirection: current.wind_direction_10m ?? null,
        windGusts: current.wind_gusts_10m ?? null,
        visibility: current.visibility ?? null,
        condition: codeInfo.condition,
        isAdverse: codeInfo.isAdverse,
      },
      hourly: (hourly.time || []).slice(0, 24).map((t, i) => ({
        time: t,
        temperature: hourly.temperature_2m?.[i] ?? null,
        precipitationProbability: hourly.precipitation_probability?.[i] ?? null,
        precipitation: hourly.precipitation?.[i] ?? 0,
        rain: hourly.rain?.[i] ?? 0,
        weatherCode: hourly.weather_code?.[i] ?? 0,
        humidity: hourly.relative_humidity_2m?.[i] ?? null,
        windSpeed: hourly.wind_speed_10m?.[i] ?? null,
        visibility: hourly.visibility?.[i] ?? null,
      })),
      daily: (daily.time || []).map((t, i) => ({
        date: t,
        weatherCode: daily.weather_code?.[i] ?? 0,
        tempMax: daily.temperature_2m_max?.[i] ?? null,
        tempMin: daily.temperature_2m_min?.[i] ?? null,
        precipitationSum: daily.precipitation_sum?.[i] ?? 0,
        rainSum: daily.rain_sum?.[i] ?? 0,
        precipProbabilityMax: daily.precipitation_probability_max?.[i] ?? null,
        windSpeedMax: daily.wind_speed_10m_max?.[i] ?? null,
      })),
      source: 'Open-Meteo',
      fetchedAt: new Date().toISOString(),
    };

    // Calculate risk
    weatherData.risk = calculateWeatherRisk({
      precipitation: weatherData.current.precipitation,
      rain: weatherData.current.rain,
      precipitationProbability: weatherData.hourly[0]?.precipitationProbability || 0,
      windSpeed: weatherData.current.windSpeed,
      visibility: weatherData.current.visibility,
      temperature: weatherData.current.temperature,
      weatherCode: weatherData.current.weatherCode,
    });

    // Cache the result
    setCachedWeather(lat, lng, weatherData);

    return { ...weatherData, fromCache: false };
  } catch (err) {
    console.warn('[weatherService] Fetch weather error:', err.message);
    return {
      success: false,
      error: err.message,
      data: null,
    };
  }
}

/**
 * Fetch weather for a named location (resolves coordinates first).
 */
export async function fetchWeatherForLocation(locationName) {
  const coords = await resolveLocationCoordinates(locationName);
  if (!coords) return { success: false, error: `Could not resolve location: ${locationName}`, data: null };

  const result = await fetchWeather(coords.lat, coords.lng);
  if (result.location) {
    result.location.name = coords.name || locationName;
  }
  return result;
}

/**
 * Fetch weather for all stops in a trip.
 * Returns normalized trip weather with per-location data and overall risk.
 */
export async function getTripWeather(trip) {
  const stops = [];

  // Extract locations from trip data
  if (trip?.route && Array.isArray(trip.route)) {
    trip.route.forEach((city) => {
      if (typeof city === 'string') stops.push({ name: city, type: 'route' });
    });
  }
  if (trip?.origin_city) stops.push({ name: trip.origin_city, type: 'origin' });
  if (trip?.destination_city) stops.push({ name: trip.destination_city, type: 'destination' });
  if (trip?.bookings) {
    trip.bookings.forEach((b) => {
      if (b.origin_name) stops.push({ name: b.origin_name, type: 'booking' });
      if (b.destination_name) stops.push({ name: b.destination_name, type: 'booking' });
    });
  }
  if (trip?.itinerary_items) {
    trip.itinerary_items.forEach((item) => {
      if (item.location) stops.push({ name: item.location, type: 'item' });
      if (item.origin_name) stops.push({ name: item.origin_name, type: 'item' });
      if (item.destination_name) stops.push({ name: item.destination_name, type: 'item' });
    });
  }

  // Deduplicate by name
  const seen = new Set();
  const uniqueStops = stops.filter((s) => {
    const key = s.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 5);

  // Fallback if no stops found
  if (uniqueStops.length === 0) {
    uniqueStops.push({ name: 'Mumbai', type: 'origin' });
    uniqueStops.push({ name: 'Delhi', type: 'transit' });
    uniqueStops.push({ name: 'Manali', type: 'destination' });
  }

  // Fetch weather for each stop
  const locations = [];
  for (const stop of uniqueStops) {
    try {
      const coords = await resolveLocationCoordinates(stop.name);
      if (!coords) continue;

      const weather = await fetchWeather(coords.lat, coords.lng);
      locations.push({
        name: coords.name || stop.name,
        type: stop.type,
        coordinates: { lat: coords.lat, lng: coords.lng },
        current: weather.current,
        hourly: weather.hourly,
        daily: weather.daily,
        risk: weather.risk,
        fromCache: weather.fromCache,
        fetchedAt: weather.fetchedAt,
      });
    } catch (err) {
      console.warn(`[weatherService] Trip weather fetch failed for ${stop.name}:`, err.message);
    }
  }

  // Calculate overall risk (highest across all locations)
  let overallRisk = { level: 'LOW', score: 0, reasons: [] };
  if (locations.length > 0) {
    const riskOrder = { LOW: 0, MODERATE: 1, HIGH: 2, SEVERE: 3 };
    const highest = locations.reduce((max, loc) => {
      if (riskOrder[loc.risk.level] > riskOrder[max.risk.level]) return loc;
      return max;
    }, locations[0]);
    overallRisk = highest.risk;
  }

  return {
    tripId: trip?.id || null,
    locations,
    overallRisk,
    fetchedAt: new Date().toISOString(),
  };
}

// ── Legacy exports (backward compatibility) ────────────────────────────────

/**
 * @deprecated Use fetchWeatherForLocation instead
 */
export async function getCoordinates(cityName) {
  return resolveLocationCoordinates(cityName);
}
