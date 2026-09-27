/**
 * weatherTwinService.js — TripSync Weather-Driven Digital Twin Engine
 *
 * Uses live weather data from weatherService.js.
 * Models cascading impacts and supports what-if simulation.
 */

import { resolveLocationCoordinates, fetchWeather, calculateWeatherRisk, getTripWeather } from './weatherService.js';

/**
 * Fetch live weather for trip stops.
 * Accepts a trip object or array of stop objects.
 */
export async function fetchAllStopsWeather(tripOrStops) {
  let stops = [];

  if (Array.isArray(tripOrStops)) {
    stops = tripOrStops;
  } else if (tripOrStops?.route) {
    stops = tripOrStops.route.map((city, i) => ({
      city,
      type: i === 0 ? 'origin' : i === tripOrStops.route.length - 1 ? 'destination' : 'transit',
    }));
  }

  if (stops.length === 0) {
    stops = [
      { city: 'Mumbai', type: 'origin' },
      { city: 'Delhi', type: 'transit' },
      { city: 'Manali', type: 'destination' },
    ];
  }

  const results = [];
  for (const stop of stops.slice(0, 5)) {
    try {
      const cityName = stop.city || stop.name;
      const coords = await resolveLocationCoordinates(cityName);
      if (!coords) continue;

      const weather = await fetchWeather(coords.lat, coords.lng);
      results.push({
        city: coords.name || cityName,
        date: stop.date || '',
        lat: coords.lat,
        lng: coords.lng,
        type: stop.type || 'stop',
        weather: weather.current,
        risk: weather.risk,
        daily: weather.daily,
        hourly: weather.hourly,
        success: true,
        fromCache: weather.fromCache,
      });
    } catch (err) {
      console.warn(`[weatherTwin] Failed weather fetch for ${stop.city}:`, err.message);
      results.push({ ...stop, weather: null, risk: null, success: false });
    }
  }
  return results;
}

/**
 * Calculate cascading impacts from weather parameters.
 * Deterministic thresholds based on meteorological standards.
 */
export function simulateImpact(params = {}) {
  const {
    rainfall = 0,
    temperature = 20,
    stormDuration = 0,
    floodRisk = 'Low',
    windSpeed = 0,
    location = 'Manali',
  } = params;

  // ── Transportation Impact ──
  let transportRisk = 'Low';
  let transportProb = 15;
  let transportETA = 0;
  let transportConfidence = 90;

  if (rainfall > 30) {
    transportRisk = 'Severe'; transportProb = 92; transportETA = 120; transportConfidence = 88;
  } else if (rainfall > 15) {
    transportRisk = 'High'; transportProb = 74; transportETA = 55; transportConfidence = 82;
  } else if (rainfall > 7) {
    transportRisk = 'Moderate'; transportProb = 48; transportETA = 30; transportConfidence = 78;
  } else if (rainfall > 3) {
    transportRisk = 'Low'; transportProb = 22; transportETA = 10; transportConfidence = 85;
  }

  if (windSpeed > 60) {
    transportRisk = 'Severe'; transportProb = Math.max(transportProb, 88); transportETA += 90;
  } else if (windSpeed > 40) {
    transportProb = Math.max(transportProb, 60); transportETA += 35;
  }

  // ── Hotel Check-in Impact ──
  let hotelRisk = 'Low'; let hotelProb = 12; let hotelConfidence = 88;
  if (transportETA > 60) {
    hotelRisk = 'High'; hotelProb = 72; hotelConfidence = 75;
  } else if (transportETA > 30) {
    hotelRisk = 'Moderate'; hotelProb = 54; hotelConfidence = 71;
  }
  if (floodRisk === 'High' || floodRisk === 'Severe') {
    hotelProb = Math.max(hotelProb, 65); hotelRisk = 'High';
  }

  // ── Activities Impact ──
  let activitiesRisk = 'Low'; let activitiesProb = 10; let activitiesConfidence = 90;
  if (rainfall > 20 || stormDuration > 4) {
    activitiesRisk = 'High'; activitiesProb = 78; activitiesConfidence = 76;
  } else if (rainfall > 10 || stormDuration > 2) {
    activitiesRisk = 'Moderate'; activitiesProb = 52; activitiesConfidence = 80;
  } else if (rainfall > 5) {
    activitiesRisk = 'Low'; activitiesProb = 28; activitiesConfidence = 85;
  }
  if (temperature < 0) {
    activitiesProb = Math.max(activitiesProb, 60);
    activitiesRisk = activitiesRisk === 'Low' ? 'Moderate' : activitiesRisk;
  }

  // ── Traveler Movement Impact ──
  let movementRisk = 'Low'; let movementProb = 8; let movementConfidence = 92;
  if (rainfall > 25 || floodRisk === 'High' || floodRisk === 'Severe') {
    movementRisk = 'High'; movementProb = 68; movementConfidence = 73;
  } else if (rainfall > 12 || stormDuration > 3) {
    movementRisk = 'Moderate'; movementProb = 44; movementConfidence = 78;
  }

  // ── Overall Disruption Score ──
  const overallProb = Math.round(
    transportProb * 0.35 + hotelProb * 0.2 + activitiesProb * 0.25 + movementProb * 0.2
  );
  const overallConfidence = Math.round(
    transportConfidence * 0.35 + hotelConfidence * 0.2 + activitiesConfidence * 0.25 + movementConfidence * 0.2
  );

  // ── Impact Propagation Chain ──
  const propagation = [];
  if (rainfall > 5) {
    propagation.push({ label: `Heavy Rainfall (${rainfall} mm/hr)`, icon: 'cloud-rain', risk: rainfall > 20 ? 'High' : rainfall > 10 ? 'Moderate' : 'Low' });
  }
  if (transportETA > 15) {
    propagation.push({ label: 'Road Travel Slower', icon: 'car', risk: transportRisk, detail: `+${transportETA}-${transportETA + 15} min` });
  }
  if (activitiesProb > 30) {
    propagation.push({ label: 'Activity Accessibility', icon: 'compass', risk: activitiesRisk });
  }
  if (hotelProb > 30) {
    propagation.push({ label: 'Hotel Arrival', icon: 'building', risk: hotelRisk, detail: hotelProb > 60 ? 'Likely delayed' : 'May be delayed' });
  }
  propagation.push({ label: 'Trip Disruption Score', icon: 'alert-triangle', risk: overallProb > 60 ? 'High' : overallProb > 35 ? 'Moderate' : 'Low', detail: `${overallProb}%` });

  return {
    overall: {
      disruptionProbability: overallProb,
      confidence: overallConfidence,
    },
    categories: {
      transportation: { risk: transportRisk, probability: transportProb, confidence: transportConfidence, detail: transportETA > 0 ? `ETA +${transportETA}-${transportETA + 15} min` : 'On schedule' },
      hotel: { risk: hotelRisk, probability: hotelProb, confidence: hotelConfidence, detail: hotelProb > 50 ? 'May be delayed' : 'On schedule' },
      activities: { risk: activitiesRisk, probability: activitiesProb, confidence: activitiesConfidence, detail: activitiesProb > 50 ? 'Possible cancellation' : 'Likely on schedule' },
      movement: { risk: movementRisk, probability: movementProb, confidence: movementConfidence, detail: movementProb > 50 ? 'Slower travel' : 'Normal movement' },
    },
    propagation,
    scenarioParams: { rainfall, temperature, stormDuration, floodRisk, windSpeed, location },
  };
}

/**
 * Build initial simulation from live weather data at trip stops.
 */
export function buildLiveSimulation(stopsWithWeather = []) {
  const dest = stopsWithWeather.find((s) => s.type === 'destination') || stopsWithWeather[stopsWithWeather.length - 1];
  if (!dest?.weather) {
    return simulateImpact({ location: 'Manali' });
  }

  const w = dest.weather;
  return simulateImpact({
    rainfall: w.precipitation || w.rain || 0,
    temperature: w.temperature || 18,
    stormDuration: w.precipitation > 5 ? 4 : w.precipitation > 2 ? 2 : 0,
    floodRisk: w.precipitation > 20 ? 'High' : w.precipitation > 8 ? 'Moderate' : 'Low',
    windSpeed: w.windSpeed || 0,
    location: dest.city,
  });
}

/**
 * Map risk level for Leaflet markers.
 */
export function getStopRiskLevel(stopWeather) {
  if (!stopWeather?.weather) return 'normal';
  const w = stopWeather.weather;
  const rain = w.precipitation || w.rain || 0;
  const wind = w.windSpeed || 0;
  if (rain > 20 || wind > 50) return 'severe';
  if (rain > 10 || wind > 35) return 'high';
  if (rain > 3 || wind > 20) return 'moderate';
  return 'normal';
}
