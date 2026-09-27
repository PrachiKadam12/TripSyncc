import { describe, it, expect } from 'vitest';
import {
  computeConnection,
  buildConnectedItinerary,
  formatTimeSafe,
  formatDateSafe,
  parseTripMetadata,
} from '../services/itineraryService.js';

describe('Itinerary Service — Connected Itinerary Engine', () => {
  it('parses trip description JSON metadata correctly', () => {
    const raw = JSON.stringify({
      stops: [{ id: 's1', city: 'Delhi' }],
      travel_type: 'group',
    });
    const parsed = parseTripMetadata(raw);
    expect(parsed.travel_type).toBe('group');
    expect(parsed.stops).toHaveLength(1);
    expect(parseTripMetadata(null)).toEqual({});
    expect(parseTripMetadata('invalid json')).toEqual({});
  });

  it('safely formats times without inventing fake times', () => {
    expect(formatTimeSafe(null)).toBeNull();
    expect(formatTimeSafe('2026-09-12')).toBeNull(); // Plain date without time
    expect(formatTimeSafe('invalid')).toBeNull();

    // Valid ISO with explicit time
    const formatted = formatTimeSafe('2026-09-12T08:30:00+05:30');
    expect(formatted).toBeTruthy();
    expect(formatted).toMatch(/08:30|8:30/);
  });

  it('computes connection relationships between consecutive transport and hotel', () => {
    const flight = {
      itemType: 'flight',
      title: 'Air India 101',
      origin: 'BOM',
      destination: 'DEL',
      startDateTime: '2026-09-12T08:30:00Z',
      endDateTime: '2026-09-12T10:30:00Z',
    };

    const transfer = {
      itemType: 'transfer',
      title: 'Airport Cab',
      origin: 'DEL Airport',
      destination: 'The Grand Hotel',
      startDateTime: '2026-09-12T11:15:00Z',
      endDateTime: '2026-09-12T12:00:00Z',
    };

    const connection = computeConnection(flight, transfer);
    expect(connection).toBeTruthy();
    expect(connection.type).toBe('layover');
    expect(connection.label).toContain('45m gap');
  });

  it('computes connection between transport and hotel check-in', () => {
    const transfer = {
      itemType: 'transfer',
      title: 'Airport Cab',
      location: 'Delhi',
      startDateTime: '2026-09-12T11:15:00Z',
      endDateTime: '2026-09-12T12:00:00Z',
    };

    const hotel = {
      itemType: 'hotel',
      title: 'The Grand Hotel',
      location: 'Delhi',
      startDateTime: '2026-09-12T13:00:00Z',
    };

    const connection = computeConnection(transfer, hotel);
    expect(connection).toBeTruthy();
    expect(connection.type).toBe('arrival_checkin');
    expect(connection.label).toContain('Arrival → Hotel Check-in');
    expect(connection.sublabel).toContain('The Grand Hotel');
  });

  it('sorts itinerary chronologically by date and start time', () => {
    const trip = {
      id: 'trip-1',
      name: 'Delhi to Manali',
      origin_city: 'Delhi',
      destination_city: 'Manali',
      start_at: '2026-09-12T00:00:00Z',
      end_at: '2026-09-15T00:00:00Z',
    };

    const bookings = [
      {
        id: 'b-afternoon-hotel',
        booking_type: 'hotel',
        provider_name: 'Hilltop Resort',
        departure_at: '2026-09-13T14:00:00Z',
        base_amount: 5000,
      },
      {
        id: 'b-morning-train',
        booking_type: 'train',
        provider_name: 'Kalka Shatabdi',
        departure_at: '2026-09-12T06:00:00Z',
        base_amount: 1200,
      },
      {
        id: 'b-evening-flight',
        booking_type: 'flight',
        provider_name: 'IndiGo 6E',
        departure_at: '2026-09-12T18:00:00Z',
        base_amount: 3500,
      },
    ];

    const result = buildConnectedItinerary({ trip, bookings });
    expect(result.days).toHaveLength(2); // Day 1 (Sep 12) and Day 2 (Sep 13)

    const day1Items = result.days[0].items;
    expect(day1Items).toHaveLength(2);
    // Morning train (06:00) should come before evening flight (18:00)
    expect(day1Items[0].rawId).toBe('b-morning-train');
    expect(day1Items[1].rawId).toBe('b-evening-flight');

    const day2Items = result.days[1].items;
    expect(day2Items[0].rawId).toBe('b-afternoon-hotel');
  });

  it('handles partial trips gracefully (e.g. only stops or only hotel without flights)', () => {
    const trip = {
      id: 'trip-partial',
      name: 'Shimla Getaway',
      start_at: '2026-10-01T00:00:00Z',
      end_at: '2026-10-03T00:00:00Z',
      description: JSON.stringify({
        stops: [
          { id: 's1', day_number: 1, city: 'Shimla Mall Road', activities: 'Evening stroll' },
          { id: 's2', day_number: 2, city: 'Kufri', activities: 'Snow point visit' },
        ],
      }),
    };

    // No bookings at all, only stops
    const result = buildConnectedItinerary({ trip, bookings: [], itineraryItems: [] });
    expect(result.days.length).toBeGreaterThanOrEqual(1);
    expect(result.allItems.length).toBe(2);
    expect(result.allItems[0].location).toBe('Shimla Mall Road');
    expect(result.allItems[1].location).toBe('Kufri');
  });

  it('attaches group travelers and documents to bookings safely', () => {
    const trip = {
      id: 'trip-group',
      name: 'Goa Friends Trip',
      start_at: '2026-11-10T00:00:00Z',
    };

    const bookings = [
      {
        id: 'b-flight-1',
        booking_type: 'flight',
        provider_name: 'Air India',
        departure_at: '2026-11-10T09:00:00Z',
      },
    ];

    const tripMembers = [
      { id: 'm1', name: 'Tanvi', role: 'owner', is_primary_traveler: true },
      { id: 'm2', name: 'Rahul', role: 'traveler', member_status: 'accepted' },
    ];

    const documents = [
      {
        id: 'doc-ticket-1',
        booking_id: 'b-flight-1',
        title: 'Air India e-Ticket',
        file_name: 'ai_ticket.pdf',
        storage_path: 'trip-group/m1/ai_ticket.pdf',
      },
    ];

    const result = buildConnectedItinerary({ trip, bookings, tripMembers, documents });
    const flightItem = result.allItems[0];

    expect(flightItem.documents).toHaveLength(1);
    expect(flightItem.documents[0].title).toBe('Air India e-Ticket');
    expect(flightItem.travelers).toHaveLength(2);
    expect(flightItem.travelers[0].name).toBe('Tanvi');
  });
});
