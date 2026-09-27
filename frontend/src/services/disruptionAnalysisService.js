/**
 * disruptionAnalysisService.js — TripSync Disruption & Risk Analysis Orchestrator
 * Integrates Supabase, AviationStack, Open-Meteo, OpenRouteService, and Gemini.
 */

import { checkFlightStatus } from './flightStatusService.js';
import { resolveLocationCoordinates, fetchWeather } from './weatherService.js';
import { fetchRouteDuration } from './routeService.js';
import { generateGeminiContent } from './geminiService.js';

export async function runDisruptionAnalysis(items = [], stops = []) {
  const detectedRisks = [];
  const liveContext = {
    flightStatuses: {},
    weatherReports: {},
    transferEstimates: {},
  };

  // 1. Check all flight items
  const flightItems = items.filter((it) => {
    const type = (it.item_type || it.type || '').toLowerCase();
    return type === 'flight' || (it.metadata && it.metadata.flight_number);
  });

  for (const flight of flightItems) {
    const flightNo = flight.metadata?.flight_number || flight.title || '';
    const match = flightNo.match(/([A-Z0-9]{2}\s?\d{3,4})/i);
    const code = match ? match[1] : 'AI123';

    try {
      const flightResult = await checkFlightStatus(code);
      if (flightResult) {
        liveContext.flightStatuses[code] = flightResult;
        if (flightResult.is_disrupted) {
          detectedRisks.push({
            id: `risk-flight-${flight.id || code}`,
            item_id: flight.id,
            category: 'flight',
            title: `${flightResult.disruption_type || 'Disruption'}: ${flightResult.airline_name || 'Flight'} ${code}`,
            severity: flightResult.severity || 'high',
            description: flightResult.flight_status === 'cancelled'
              ? `Flight ${code} is cancelled by the airline.`
              : `Flight ${code} is delayed by ${flightResult.delay_minutes} minutes.`,
            detected_at: new Date().toISOString(),
            metadata: { disruption_type: flightResult.disruption_type, expected_delay_minutes: flightResult.delay_minutes, affected_title: flight.title || `Flight ${code}`, source: flightResult.source },
          });
        }
      }
    } catch (e) {
      console.warn(`[disruptionAnalysis] Flight check failed for ${code}:`, e.message);
    }
  }

  // 2. Check weather for main stops/destinations
  const locationsToCheck = new Set();
  stops.forEach((s) => {
    if (s.name) locationsToCheck.add(s.name);
    if (s.city) locationsToCheck.add(s.city);
  });
  items.forEach((it) => {
    if (it.location) locationsToCheck.add(it.location);
    if (it.origin_name) locationsToCheck.add(it.origin_name);
    if (it.destination_name) locationsToCheck.add(it.destination_name);
  });

  if (locationsToCheck.size === 0) {
    locationsToCheck.add('Delhi');
    locationsToCheck.add('Manali');
  }

  for (const loc of Array.from(locationsToCheck).slice(0, 3)) {
    try {
      const coords = await resolveLocationCoordinates(loc);
      if (coords) {
        const weather = await fetchWeather(coords.lat, coords.lng);
        if (weather.current) {
          liveContext.weatherReports[loc] = {
            ...weather.current,
            risk: weather.risk,
            fetchedAt: weather.fetchedAt,
            fromCache: weather.fromCache,
          };

          if (weather.current.isAdverse || weather.risk.level === 'HIGH' || weather.risk.level === 'SEVERE') {
            detectedRisks.push({
              id: `risk-weather-${loc.toLowerCase().replace(/\s+/g, '-')}`,
              category: 'weather',
              title: `Adverse Weather: ${loc} (${weather.current.condition})`,
              severity: weather.risk.level.toLowerCase(),
              description: `Current conditions in ${loc} report ${weather.current.condition} (Temp: ${weather.current.temperature}°C, Wind: ${weather.current.windSpeed} km/h). Potential transfer and activity delays.`,
              detected_at: new Date().toISOString(),
              metadata: { disruption_type: 'Adverse Weather', affected_title: `Weather at ${loc}`, source: 'open-meteo', risk_score: weather.risk.score },
            });
          }
        }
      }
    } catch (e) {
      console.warn(`[disruptionAnalysis] Weather check failed for ${loc}:`, e.message);
    }
  }

  // 3. Check transfer connections
  const transferItems = items.filter((it) => {
    const type = (it.item_type || it.type || '').toLowerCase();
    return type === 'transfer' || type === 'bus' || type === 'train';
  });

  for (const tr of transferItems.slice(0, 2)) {
    try {
      const fromName = tr.metadata?.from_location || 'Delhi Airport';
      const toName = tr.metadata?.to_location || tr.location || 'Mountain View Residency';
      const fromCoords = await resolveLocationCoordinates(fromName) || { lat: 28.5562, lng: 77.1000 };
      const toCoords = await resolveLocationCoordinates(toName) || { lat: 32.2432, lng: 77.1892 };
      const route = await fetchRouteDuration(fromCoords, toCoords);
      if (route) liveContext.transferEstimates[tr.id || tr.title] = route;
    } catch (e) {
      console.warn('[disruptionAnalysis] Route estimation check failed:', e.message);
    }
  }

  return { detectedRisks, liveContext };
}

export async function getAiDisruptionSummary(disruptions = []) {
  if (!disruptions || disruptions.length === 0) return null;
  try {
    const prompt = `You are TripSync travel resilience assistant. In 2 concise traveler-friendly sentences, summarize this disruption impact for the traveler without using technical jargon: Disruptions: ${JSON.stringify(disruptions.map(d => ({ title: d.title, description: d.description, severity: d.severity })))} Be calm, clear, and reassuring.`;
    return await generateGeminiContent(prompt);
  } catch (err) {
    console.warn('[disruptionAnalysis] Gemini summary skipped:', err.message);
    return null;
  }
}
