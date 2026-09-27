/**
 * weatherAlertService.js — TripSync Weather & Travel Alerts Engine
 *
 * Connects live weather forecasts from Open-Meteo to itinerary segments.
 * Uses the normalized weatherService response.
 */

import { resolveLocationCoordinates, fetchWeather, calculateWeatherRisk } from './weatherService.js';

/**
 * Fetch and synthesize weather alerts for connected itinerary segments
 */
export async function getItineraryWeatherAlerts(itineraryItems = [], tripStops = []) {
  const segmentReports = [];
  const activeAlerts = [];

  // Extract unique locations from itinerary items and stops
  const locationMap = new Map();

  itineraryItems.forEach((item) => {
    if (item.origin && !locationMap.has(item.origin)) {
      locationMap.set(item.origin, { name: item.origin, items: [item] });
    } else if (item.origin) {
      locationMap.get(item.origin).items.push(item);
    }

    if (item.destination && !locationMap.has(item.destination)) {
      locationMap.set(item.destination, { name: item.destination, items: [item] });
    } else if (item.destination) {
      locationMap.get(item.destination).items.push(item);
    }

    if (item.location && !locationMap.has(item.location)) {
      locationMap.set(item.location, { name: item.location, items: [item] });
    } else if (item.location) {
      locationMap.get(item.location).items.push(item);
    }
  });

  tripStops.forEach((stop) => {
    const cityName = stop.city || stop.name;
    if (cityName && !locationMap.has(cityName)) {
      locationMap.set(cityName, { name: cityName, items: [] });
    }
  });

  // Fallback to default route if empty
  if (locationMap.size === 0) {
    locationMap.set('Mumbai', { name: 'Mumbai', items: [] });
    locationMap.set('Delhi', { name: 'Delhi', items: [] });
    locationMap.set('Manali', { name: 'Manali', items: [] });
  }

  // Fetch live weather for each location (capped at 5)
  for (const [locName, locData] of Array.from(locationMap.entries()).slice(0, 5)) {
    try {
      const coords = await resolveLocationCoordinates(locName);
      if (!coords) continue;

      const weather = await fetchWeather(coords.lat, coords.lng);
      if (!weather.current) continue;

      const w = weather.current;
      const associatedItem = locData.items[0] || null;

      const report = {
        location: locName,
        coordinates: coords,
        temperature: w.temperature,
        apparentTemperature: w.apparentTemperature,
        humidity: w.humidity,
        precipitation: w.precipitation,
        rain: w.rain,
        windSpeed: w.windSpeed,
        windGusts: w.windGusts,
        visibility: w.visibility,
        condition: w.condition,
        isAdverse: w.isAdverse,
        risk: weather.risk,
        associatedItemTitle: associatedItem?.title || `${locName} Journey Segment`,
        associatedItemId: associatedItem?.id || null,
        itemType: associatedItem?.itemType || 'stop',
        fetchedAt: weather.fetchedAt,
        fromCache: weather.fromCache,
      };

      segmentReports.push(report);

      // Generate alert if adverse conditions exist
      if (w.isAdverse || weather.risk.level === 'HIGH' || weather.risk.level === 'SEVERE') {
        let alertTitle = `Weather Advisory: ${locName}`;
        let alertMessage = `${w.condition} reported in ${locName} (${w.temperature}°C, Wind: ${w.windSpeed} km/h).`;
        let actionAdvice = 'Allow extra buffer time for departures and transfers.';
        let alertType = 'warning';

        if (w.condition.toLowerCase().includes('rain') || w.precipitation > 5) {
          alertTitle = `Heavy Rain Alert: ${locName}`;
          alertMessage = `Significant precipitation detected in ${locName}. Road transfers and outdoor tours may face localized slowdowns.`;
          actionAdvice = 'Check with ground transfer operator for mountain pass road clearance.';
          alertType = 'rain';
        } else if (w.windSpeed > 35) {
          alertTitle = `High Winds Advisory: ${locName}`;
          alertMessage = `Wind speeds up to ${w.windSpeed} km/h (Gusts: ${w.windGusts} km/h) near ${locName}.`;
          actionAdvice = 'Flight operations may experience holding patterns. Check airline departure screens.';
          alertType = 'wind';
        } else if (w.condition.toLowerCase().includes('fog')) {
          alertTitle = `Low Visibility / Fog Alert: ${locName}`;
          alertMessage = `Dense fog and reduced visibility observed around ${locName} arrival zone.`;
          actionAdvice = 'Drive with headlights on low beam; anticipate potential airport runway queuing.';
          alertType = 'fog';
        }

        activeAlerts.push({
          id: `weather-alert-${locName.toLowerCase()}`,
          location: locName,
          title: alertTitle,
          severity: weather.risk.level.toLowerCase(),
          condition: w.condition,
          temperature: w.temperature,
          windSpeed: w.windSpeed,
          precipitation: w.precipitation,
          message: alertMessage,
          actionAdvice,
          alertType,
          associatedItemTitle: report.associatedItemTitle,
          associatedItemId: report.associatedItemId,
          itemType: report.itemType,
          detectedAt: new Date().toISOString(),
          dataSource: 'Open-Meteo Live API',
        });
      }
    } catch (err) {
      console.warn(`[weatherAlertService] Weather lookup error for ${locName}:`, err.message);
    }
  }

  return {
    segmentReports,
    activeAlerts,
    hasActiveAlerts: activeAlerts.length > 0,
  };
}
