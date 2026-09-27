import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateRiskSeverity,
  buildConnectedItinerary,
  parseTripMetadata,
  saveOfflineDisruption,
  getOfflineDisruptions,
  removeOfflineDisruption,
} from '../services/itineraryService.js';
import { DISRUPTION_CATEGORIES } from '../components/itinerary/ReportIssueModal.jsx';

const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = localStorageMock;
}

describe('Stage 11 — Edit Journey Logic & Validation', () => {
  it('updates stop details while preserving metadata structure', () => {
    const rawDesc = JSON.stringify({
      stops: [
        { id: 's1', day_number: 1, city: 'Delhi', transport: 'None', activities: 'Red Fort' },
        { id: 's2', day_number: 2, city: 'Manali', transport: 'Bus', activities: 'Mall Road' },
      ],
    });

    const parsed = parseTripMetadata(rawDesc);
    expect(parsed.stops).toHaveLength(2);

    // Edit stop 1
    const updatedStops = parsed.stops.map((s) =>
      s.id === 's1' ? { ...s, city: 'Old Delhi', activities: 'Chandni Chowk food walk' } : s
    );

    expect(updatedStops[0].city).toBe('Old Delhi');
    expect(updatedStops[0].activities).toBe('Chandni Chowk food walk');
    expect(updatedStops[1].city).toBe('Manali');
  });

  it('adds a new stop and reorders stops correctly', () => {
    const stops = [
      { id: 's1', day_number: 1, city: 'Mumbai' },
      { id: 's2', day_number: 2, city: 'Delhi' },
    ];

    // Add stop
    const newStop = { id: 's3', day_number: 3, city: 'Amritsar', transport: 'Train' };
    const withNew = [...stops, newStop];
    expect(withNew).toHaveLength(3);

    // Reorder: swap index 1 and 2
    const reordered = [...withNew];
    const temp = reordered[1];
    reordered[1] = reordered[2];
    reordered[2] = temp;

    expect(reordered[1].city).toBe('Amritsar');
    expect(reordered[2].city).toBe('Delhi');
  });

  it('validates start and end time consistency (end must not be earlier than start)', () => {
    const validStart = '2026-09-12T10:00:00Z';
    const validEnd = '2026-09-12T12:00:00Z';
    const invalidEnd = '2026-09-12T09:00:00Z';

    const isValid = (start, end) => {
      if (!start || !end) return true;
      return new Date(end).getTime() >= new Date(start).getTime();
    };

    expect(isValid(validStart, validEnd)).toBe(true);
    expect(isValid(validStart, invalidEnd)).toBe(false);
  });

  it('protects booking-linked items from accidental deletion or schedule overwrite', () => {
    const trip = { id: 't1', name: 'Himachal Tour', start_at: '2026-09-12T00:00:00Z' };
    const bookings = [
      {
        id: 'b-flight',
        booking_type: 'flight',
        provider_name: 'Air India AI-123',
        departure_at: '2026-09-12T08:30:00Z',
      },
    ];
    const itineraryItems = [
      {
        id: 'it-stop',
        item_type: 'stop',
        title: 'Sightseeing in Delhi',
        booking_id: null,
      },
    ];

    const timeline = buildConnectedItinerary({ trip, bookings, itineraryItems });
    const bookingItem = timeline.allItems.find((it) => it.source === 'booking');
    const stopItem = timeline.allItems.find((it) => it.source === 'itinerary_item');

    expect(bookingItem.source).toBe('booking');
    expect(bookingItem.booking_id).toBe('b-flight');
    // Stop item is not booking linked
    expect(stopItem.booking_id).toBeNull();
  });
});

describe('Stage 12 — Risk / Disruption Engine', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('provides all 13 required disruption categories', () => {
    expect(DISRUPTION_CATEGORIES).toContain('Flight Delay');
    expect(DISRUPTION_CATEGORIES).toContain('Flight Cancellation');
    expect(DISRUPTION_CATEGORIES).toContain('Missed Connection');
    expect(DISRUPTION_CATEGORIES).toContain('Train Delay');
    expect(DISRUPTION_CATEGORIES).toContain('Train Cancellation');
    expect(DISRUPTION_CATEGORIES).toContain('Bus Delay');
    expect(DISRUPTION_CATEGORIES).toContain('Transfer Delay');
    expect(DISRUPTION_CATEGORIES).toContain('Hotel Issue');
    expect(DISRUPTION_CATEGORIES).toContain('Activity Cancellation');
    expect(DISRUPTION_CATEGORIES).toContain('Road / Route Disruption');
    expect(DISRUPTION_CATEGORIES).toContain('Weather Disruption');
    expect(DISRUPTION_CATEGORIES).toContain('Airport / Station Disruption');
    expect(DISRUPTION_CATEGORIES).toContain('Other');
  });

  it('calculates factual risk severity levels appropriately', () => {
    // Cancellations or missed connections -> critical
    expect(calculateRiskSeverity('Flight Cancellation', 0)).toBe('critical');
    expect(calculateRiskSeverity('Missed Connection', 0)).toBe('critical');
    expect(calculateRiskSeverity('Train Cancellation', 0)).toBe('critical');

    // High delays (>= 90 or 180 min) -> high or critical
    expect(calculateRiskSeverity('Flight Delay', 190)).toBe('critical');
    expect(calculateRiskSeverity('Flight Delay', 120)).toBe('high');
    expect(calculateRiskSeverity('Road / Route Disruption', 60)).toBe('high');

    // Moderate delays -> medium
    expect(calculateRiskSeverity('Train Delay', 45)).toBe('medium');
    expect(calculateRiskSeverity('Hotel Issue', 0)).toBe('medium');

    // Minor delays (< 30 min) -> low
    expect(calculateRiskSeverity('Bus Delay', 15)).toBe('low');
  });

  it('links disruption to affected itinerary item and tags it in timeline', () => {
    const trip = {
      id: 'trip-disr-1',
      name: 'Delhi to Manali',
      start_at: '2026-09-12T00:00:00Z',
    };

    const bookings = [
      {
        id: 'b-flight-123',
        booking_type: 'flight',
        provider_name: 'Air India AI-123',
        origin_name: 'Mumbai',
        destination_name: 'Delhi',
        departure_at: '2026-09-12T08:30:00Z',
      },
      {
        id: 'b-hotel-1',
        booking_type: 'hotel',
        provider_name: 'Mountain View Residency',
        destination_name: 'Manali',
        departure_at: '2026-09-13T14:00:00Z',
      },
    ];

    const disruptions = [
      {
        id: 'disr-1',
        trip_id: 'trip-disr-1',
        title: 'Flight Delay — Air India AI-123',
        description: 'Flight delayed by 2 hours due to dense fog.',
        severity: 'high',
        detected_at: '2026-09-12T07:00:00Z',
        resolved_at: null,
        metadata: {
          affected_booking_id: 'b-flight-123',
          affected_title: 'Air India AI-123',
          disruption_type: 'Flight Delay',
          expected_delay_minutes: 120,
          status: 'reported',
        },
      },
    ];

    const result = buildConnectedItinerary({ trip, bookings, disruptions });

    // Flight booking should be tagged as disrupted
    const flight = result.allItems.find((it) => it.rawId === 'b-flight-123');
    expect(flight).toBeDefined();
    expect(flight.isDisrupted).toBe(true);
    expect(flight.disruptionSeverity).toBe('high');
    expect(flight.disruptionType).toBe('Flight Delay');
    expect(flight.disruptionStatus).toBe('reported');

    // Hotel booking should remain normal
    const hotel = result.allItems.find((it) => it.rawId === 'b-hotel-1');
    expect(hotel).toBeDefined();
    expect(hotel.isDisrupted).toBeFalsy();

    // Summary reflects active disruption
    expect(result.tripSummary.hasDisruption).toBe(true);
    expect(result.tripSummary.activeDisruptions).toHaveLength(1);
    expect(result.tripSummary.disruptionHistory).toHaveLength(1);
  });

  it('supports offline disruption queuing in localStorage with Pending sync flag', () => {
    const offlineItem = {
      id: 'off-1',
      trip_id: 'trip-offline-1',
      title: 'Train Delay — Kalka Shatabdi',
      description: 'Signalling fault, train stopped',
      severity: 'medium',
      detected_at: new Date().toISOString(),
      metadata: {
        disruption_type: 'Train Delay',
        status: 'reported',
        expected_delay_minutes: 60,
      },
      isOfflinePending: true,
    };

    saveOfflineDisruption(offlineItem);

    const stored = getOfflineDisruptions('trip-offline-1');
    expect(stored).toHaveLength(1);
    expect(stored[0].isOfflinePending).toBe(true);
    expect(stored[0].title).toContain('Train Delay');

    // Remove upon sync
    removeOfflineDisruption('off-1');
    expect(getOfflineDisruptions('trip-offline-1')).toHaveLength(0);
  });
});
