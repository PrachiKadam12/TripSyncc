import { describe, it, expect, vi } from 'vitest';
import { getCoordinates, fetchWeather } from '../services/weatherService.js';
import { checkFlightStatus } from '../services/flightStatusService.js';
import { fetchRouteDuration } from '../services/routeService.js';
import { runDisruptionAnalysis } from '../services/disruptionAnalysisService.js';

describe('Stage 12 — Weather Service (Open-Meteo)', () => {
  it('resolves known city coordinates directly without network calls', async () => {
    const coords = await getCoordinates('Delhi');
    expect(coords).not.toBeNull();
    expect(coords.lat).toBeCloseTo(28.6139, 2);
    expect(coords.lng).toBeCloseTo(77.209, 2);
  });

  it('correctly parses adverse weather conditions into risk severities', async () => {
    // Mock fetch for Open-Meteo
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        current: {
          temperature_2m: 14.5,
          apparent_temperature: 13.0,
          relative_humidity_2m: 85,
          precipitation: 8.2,
          rain: 8.2,
          weather_code: 65, // Heavy rain
          wind_speed_10m: 35.0,
        },
      }),
    });

    try {
      const weather = await fetchWeather(32.2432, 77.1892);
      expect(weather.success).toBe(true);
      expect(weather.data.isAdverse).toBe(true);
      expect(weather.data.severity).toBe('high');
      expect(weather.data.temperature).toBe(14.5);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('Stage 12 — Flight Status Service', () => {
  it('provides deterministic demo fallback when API returns offline/unconfigured', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'unconfigured',
        error: 'Flight status API key not configured on server.',
        flight: null,
      }),
    });

    try {
      const res = await checkFlightStatus('AI-123');
      expect(res).not.toBeNull();
      expect(res.flight_status).toBe('cancelled');
      expect(res.is_disrupted).toBe(true);
      expect(res.disruption_type).toBe('Flight Cancellation');
      expect(res.severity).toBe('critical');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('Stage 12 — Route Service (OpenRouteService)', () => {
  it('falls back to geographic road distance when API is unconfigured', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'unconfigured',
        error: 'Route API key not configured on server.',
        route: null,
      }),
    });

    try {
      const route = await fetchRouteDuration(
        { lat: 28.5562, lng: 77.1000 }, // Delhi Airport
        { lat: 32.2432, lng: 77.1892 }  // Manali
      );
      expect(route).not.toBeNull();
      expect(route.distance_km).toBeGreaterThan(400);
      expect(route.duration_minutes).toBeGreaterThan(300);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('Stage 12 — Disruption & Risk Orchestration', () => {
  it('scans connected itinerary items and identifies flight disruption', async () => {
    const items = [
      {
        id: 'item-flight-1',
        item_type: 'flight',
        title: 'Flight AI-123 (BOM → DEL)',
        metadata: { flight_number: 'AI-123' },
      },
      {
        id: 'item-hotel-1',
        item_type: 'hotel',
        title: 'Mountain View Residency',
        location: 'Manali',
      },
    ];

    const result = await runDisruptionAnalysis(items, [{ name: 'Delhi' }, { name: 'Manali' }]);
    expect(result).toBeDefined();
    expect(result.liveContext).toBeDefined();
    expect(result.detectedRisks.length).toBeGreaterThan(0);

    const flightRisk = result.detectedRisks.find((r) => r.category === 'flight');
    expect(flightRisk).toBeDefined();
    expect(flightRisk.severity).toBe('critical');
  });
});
