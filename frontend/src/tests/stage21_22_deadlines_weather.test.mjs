/**
 * stage21_22_deadlines_weather.test.mjs — Test Suite for Stage 21 & 22
 */

import assert from 'node:assert';
import { deriveDeadlinesAndPolicies, calculateRemainingTime } from '../services/deadlinePolicyService.js';
import { getItineraryWeatherAlerts } from '../services/weatherAlertService.js';

async function runTests() {
  console.log('--- Running TripSync Stage 21 & 22 Test Suite ---');
  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`✓ Test ${total}: ${name}`);
      passed++;
    } catch (err) {
      console.error(`✕ Test ${total} FAILED: ${name}`);
      console.error(err);
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      console.log(`✓ Test ${total}: ${name}`);
      passed++;
    } catch (err) {
      console.error(`✕ Test ${total} FAILED: ${name}`);
      console.error(err);
    }
  }

  // ── TEST 1: Stage 21 calculateRemainingTime calculations ──
  test('Stage 21: calculateRemainingTime returns correct urgency and text', () => {
    // 3 hours from now -> critical
    const future3h = new Date(Date.now() + 3 * 3600000);
    const res3h = calculateRemainingTime(future3h);
    assert.strictEqual(res3h.urgency, 'critical');
    assert.strictEqual(res3h.isExpired, false);
    assert.ok(res3h.remainingText.includes('h'));

    // 12 hours from now -> due_soon
    const future12h = new Date(Date.now() + 12 * 3600000);
    const res12h = calculateRemainingTime(future12h);
    assert.strictEqual(res12h.urgency, 'due_soon');
    assert.strictEqual(res12h.isExpired, false);

    // 48 hours from now -> upcoming
    const future48h = new Date(Date.now() + 48 * 3600000);
    const res48h = calculateRemainingTime(future48h);
    assert.strictEqual(res48h.urgency, 'upcoming');
    assert.strictEqual(res48h.isExpired, false);

    // Expired
    const past = new Date(Date.now() - 3600000);
    const resPast = calculateRemainingTime(past);
    assert.strictEqual(resPast.urgency, 'completed');
    assert.strictEqual(resPast.isExpired, true);
  });

  // ── TEST 2: Stage 21 deriveDeadlinesAndPolicies from hotel and flight bookings ──
  test('Stage 21: deriveDeadlinesAndPolicies derives hotel & flight deadlines', () => {
    const trip = {
      id: 'trip-1',
      title: 'Mumbai to Manali Adventure',
      start_at: '2026-09-12T08:30:00Z',
    };

    const bookings = [
      {
        id: 'b-hotel-1',
        booking_type: 'hotel',
        provider_name: 'Mountain View Residency',
        base_amount: 6500,
        departure_at: '2026-09-12T14:00:00Z',
        cancellation_deadline: new Date(Date.now() + 10 * 3600000).toISOString(),
        refundable: true,
        provider_metadata: {
          cancellation_policy_type: 'Free cancellation until 10h before',
          provider_source: 'Booking.com',
        },
      },
      {
        id: 'b-flight-1',
        booking_type: 'flight',
        provider_name: 'Air India',
        confirmation_code: 'AI-123',
        departure_at: new Date(Date.now() + 4 * 3600000).toISOString(),
        arrival_at: new Date(Date.now() + 6 * 3600000).toISOString(),
        status: 'confirmed',
      },
    ];

    const deadlines = deriveDeadlinesAndPolicies({ trip, bookings, itineraryItems: [] });

    assert.ok(deadlines.length >= 3);
    const hotelDeadline = deadlines.find((d) => d.category === 'hotel');
    assert.ok(hotelDeadline);
    assert.strictEqual(hotelDeadline.itemTitle, 'Mountain View Residency');
    assert.strictEqual(hotelDeadline.policySource, 'Booking.com');
    assert.strictEqual(hotelDeadline.potentialRefund, 6500);

    const flightDeadline = deadlines.find((d) => d.category === 'flight_checkin');
    assert.ok(flightDeadline);
    assert.strictEqual(flightDeadline.itemTitle, 'Air India AI-123');
    assert.ok(flightDeadline.recommendedAction.includes('boarding pass'));
  });

  // ── TEST 3: Stage 21 Recalculate deadlines on Applied Recovery Plan ──
  test('Stage 21: Deadlines dynamically recalculate when recovery plan is applied', () => {
    const trip = { id: 'trip-1', start_at: '2026-09-12T08:30:00Z' };
    const bookings = [
      {
        id: 'b-flight-1',
        booking_type: 'flight',
        provider_name: 'Air India',
        confirmation_code: 'AI-123',
        status: 'cancelled',
        departure_at: '2026-09-12T08:30:00Z',
      },
    ];

    const appliedRecovery = {
      recoveryPlanId: 'plan-fastest',
      strategyTag: 'Fastest',
      title: 'Same-Day Re-route via AI-204',
      replacementTransport: {
        airline: 'Air India',
        flightNumber: 'AI-204',
        departureTime: '12:00 PM',
        arrivalTime: '02:15 PM',
        origin: 'BOM',
        destination: 'DEL',
      },
      netFinancialImpact: 2400,
    };

    const deadlines = deriveDeadlinesAndPolicies({ trip, bookings, itineraryItems: [], appliedRecovery });

    const recoveryFlightDeadline = deadlines.find((d) => d.isRecoveryItem);
    assert.ok(recoveryFlightDeadline, 'Must include replacement flight check-in deadline');
    assert.strictEqual(recoveryFlightDeadline.isRecalculated, true);
    assert.ok(recoveryFlightDeadline.title.includes('AI-204'));
  });

  // ── TEST 4: Stage 22 Live Weather Alerts fetch and segment mapping ──
  await testAsync('Stage 22: getItineraryWeatherAlerts queries Open-Meteo and connects segments', async () => {
    const items = [
      {
        id: 'item-1',
        title: 'Mumbai to Delhi Flight',
        origin: 'Mumbai',
        destination: 'Delhi',
        itemType: 'flight',
      },
      {
        id: 'item-2',
        title: 'Delhi to Manali Transfer',
        origin: 'Delhi',
        destination: 'Manali',
        itemType: 'transfer',
      },
    ];

    const weatherData = await getItineraryWeatherAlerts(items, [{ city: 'Delhi' }, { city: 'Manali' }]);

    assert.ok(weatherData.segmentReports.length > 0, 'Must return weather reports for segments');
    const firstReport = weatherData.segmentReports[0];
    assert.ok(firstReport.location);
    assert.ok(typeof firstReport.temperature === 'number');
    assert.ok(typeof firstReport.windSpeed === 'number');
    assert.ok(firstReport.condition);
  });

  // ── TEST 5: Stage 21 & 22 Integrity & No Fake Data Claim ──
  test('Stage 21 & 22: Factual integrity preserves unknown policies and non-speculative weather alerts', () => {
    const unspecBooking = [
      {
        id: 'b-mystery-1',
        booking_type: 'hotel',
        provider_name: 'Local Homestay',
        provider_metadata: {},
      },
    ];

    const deadlines = deriveDeadlinesAndPolicies({ trip: null, bookings: unspecBooking, itineraryItems: [] });
    const homestayDeadline = deadlines.find((d) => d.bookingId === 'b-mystery-1');
    assert.ok(homestayDeadline);
    assert.strictEqual(homestayDeadline.policySource, 'Policy details unavailable from provider');
  });

  console.log('========================================');
  console.log(`TEST SUMMARY: ${passed}/${total} TESTS PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('========================================');

  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
