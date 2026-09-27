/**
 * stage25_26_27_docs_completion_mytrips.test.mjs — Test Suite for Stage 25, 26 & 27
 */

import assert from 'node:assert';
import {
  fetchTripVaultDocuments,
  maskSensitiveData,
} from '../services/tripDocumentService.js';
import {
  getTripCompletionSummary,
  completeTrip,
} from '../services/tripCompletionService.js';

async function runTests() {
  console.log('--- Running TripSync Stage 25, 26 & 27 Test Suite ---');
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

  // ── TEST 1: Stage 25 Mask Sensitive Document Data ──
  test('Stage 25: maskSensitiveData correctly masks passports and PNRs', () => {
    const passportMasked = maskSensitiveData('Z5891243', 4);
    assert.strictEqual(passportMasked, '•••• 1243');

    const pnrMasked = maskSensitiveData('AI9812', 3);
    assert.strictEqual(pnrMasked, '•••• 812');

    const shortStr = maskSensitiveData('12', 4);
    assert.strictEqual(shortStr, '12');
  });

  // ── TEST 2: Stage 25 Document Vault Synthesis & Categories ──
  await testAsync('Stage 25: fetchTripVaultDocuments returns complete document categories', async () => {
    const bookings = [
      {
        id: 'b-flight-1',
        booking_type: 'flight',
        provider_name: 'Air India',
        confirmation_code: 'AI-123',
        status: 'confirmed',
      },
      {
        id: 'b-hotel-1',
        booking_type: 'hotel',
        provider_name: 'Mountain View Residency',
        confirmation_code: 'BK-78902',
        status: 'confirmed',
      },
    ];

    const docs = await fetchTripVaultDocuments('trip-1', null, bookings);

    assert.ok(docs.length >= 4, 'Must return tickets, hotel vouchers, ID, and insurance');
    const ticketDoc = docs.find((d) => d.category === 'ticket');
    assert.ok(ticketDoc);
    assert.strictEqual(ticketDoc.status, 'active');
    assert.ok(ticketDoc.referenceNumber.includes('••••'));

    const passportDoc = docs.find((d) => d.category === 'passport');
    assert.ok(passportDoc);
    assert.strictEqual(passportDoc.isMasked, true);

    const insuranceDoc = docs.find((d) => d.category === 'insurance');
    assert.ok(insuranceDoc);
  });

  // ── TEST 3: Stage 25 Stage 19 Recovery Replacement Document Synthesis ──
  await testAsync('Stage 25: Stage 19 recovery plan generates replacement boarding pass in vault', async () => {
    const tripId = 'trip-recovery-test';
    const bookings = [
      {
        id: 'b-flight-disrupted',
        booking_type: 'flight',
        provider_name: 'Air India',
        confirmation_code: 'AI-123',
        status: 'cancelled',
      },
    ];

    // Mock recovery in localStorage
    globalThis.localStorage = {
      getItem: (key) => {
        if (key === `tripsync_applied_recovery_${tripId}`) {
          return JSON.stringify({
            recoveryPlanId: 'plan-fastest',
            strategyTag: 'Fastest',
            title: 'Same-Day Re-route via AI-204',
            replacementTransport: {
              airline: 'Air India',
              flightNumber: 'AI-204',
              number: 'AI-204',
              departureTime: '12:00 PM',
              arrivalTime: '02:15 PM',
            },
          });
        }
        return null;
      },
      setItem: () => {},
    };

    const docs = await fetchTripVaultDocuments(tripId, null, bookings);
    const recoveryDoc = docs.find((d) => d.isRecoveryDocument);

    assert.ok(recoveryDoc, 'Must generate replacement boarding pass');
    assert.strictEqual(recoveryDoc.status, 'active');
    assert.ok(recoveryDoc.title.includes('AI-204'));

    const originalDoc = docs.find((d) => d.bookingId === 'b-flight-disrupted');
    assert.ok(originalDoc);
    assert.strictEqual(originalDoc.status, 'replaced');
  });

  // ── TEST 4: Stage 26 Pre-completion Summary Generation ──
  test('Stage 26: getTripCompletionSummary generates comprehensive summary', () => {
    const trip = {
      id: 'trip-comp-1',
      title: 'Manali Expedition',
      origin_city: 'Mumbai',
      destination_city: 'Manali',
      start_at: '2026-09-12T08:30:00Z',
      end_at: '2026-09-18T18:00:00Z',
      status: 'active',
    };

    const allItems = [
      { id: '1', status: 'confirmed', isRecoveryPreserved: true },
      { id: '2', status: 'confirmed', isRecoveryPreserved: true },
      { id: '3', status: 'confirmed', isRecoveryReplacement: true },
    ];

    const appliedRecovery = {
      title: 'Fastest Re-route',
      strategyTag: 'Fastest',
      netFinancialImpact: 2400,
    };

    const summary = getTripCompletionSummary({ trip, allItems, appliedRecovery });

    assert.strictEqual(summary.tripId, 'trip-comp-1');
    assert.strictEqual(summary.hasRecovery, true);
    assert.strictEqual(summary.totalItemsCount, 3);
    assert.strictEqual(summary.preservedCount, 3);
    assert.strictEqual(summary.recoveryStrategy, 'Fastest');
  });

  // ── TEST 5: Stage 26 & 27 Trip Completion Execution & Preservation ──
  await testAsync('Stage 26 & 27: completeTrip persists completed status and preserves trip history', async () => {
    let savedStorageKey = null;
    let savedStorageVal = null;

    globalThis.localStorage = {
      setItem: (key, val) => {
        savedStorageKey = key;
        savedStorageVal = val;
      },
      getItem: (key) => {
        if (key === savedStorageKey) return savedStorageVal;
        return null;
      },
    };

    const result = await completeTrip({ tripId: 'trip-complete-test' });

    assert.strictEqual(result.success, true);
    assert.strictEqual(savedStorageKey, 'tripsync_completed_trip-complete-test');
    assert.ok(savedStorageVal.includes('completed'));
  });

  console.log('========================================');
  console.log(`TEST SUMMARY: ${passed}/${total} TESTS PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('========================================');

  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
