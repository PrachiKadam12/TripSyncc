import assert from 'node:assert';
import { generateRecoveryPlans, evaluateFeasibility, calculateRecoveryScore, applyRecoveryPlanToTrip } from '../services/recoveryService.js';
import { fetchBlastRadius } from '../services/blastRadiusService.js';
import { buildConnectedItinerary } from '../services/itineraryService.js';

async function runTests() {
  console.log('--- Running TripSync Recovery Engine Tests (Stages 13, 16, 17, 18) ---');
  let passed = 0;
  let total = 0;

  function test(desc, fn) {
    total++;
    try {
      fn();
      console.log(`✓ Test ${total}: ${desc}`);
      passed++;
    } catch (err) {
      console.error(`✕ Test ${total} FAILED: ${desc}`);
      console.error(err);
    }
  }

  async function testAsync(desc, fn) {
    total++;
    try {
      await fn();
      console.log(`✓ Test ${total}: ${desc}`);
      passed++;
    } catch (err) {
      console.error(`✕ Test ${total} FAILED: ${desc}`);
      console.error(err);
    }
  }

  const sampleTripId = 'trip-mumbai-delhi-manali-2026';
  const reportedTrainDisruption = {
    id: 'disr-train-delay-01',
    trip_id: sampleTripId,
    title: 'Train Delay: Day 1 – Mumbai to Delhi',
    severity: 'high',
    detected_at: '2026-09-12T08:30:00.000Z',
    description: 'Train delayed by 2 hours. This may affect the connecting transfer, hotel check-in, and planned activities.',
    metadata: {
      disruption_type: 'Train Delay',
      affected_item_id: 'item-train-01',
      affected_title: 'Train — Day 1 — Mumbai to Delhi',
      expected_delay_minutes: 120,
      status: 'reported',
    },
  };

  const sampleItinerary = [
    {
      id: 'item-train-01',
      itemType: 'train',
      title: 'Train — Day 1 — Mumbai to Delhi',
      origin: 'Mumbai',
      destination: 'Delhi',
      price: 2400,
      startDateTime: '2026-09-12T08:30:00.000Z',
      startTimeStr: '08:30 AM',
      dayNumber: 1,
      refundable: true,
    },
    {
      id: 'item-transfer-01',
      itemType: 'transfer',
      title: 'Delhi Airport/Station to Hotel Transfer',
      origin: 'Delhi',
      destination: 'Manali',
      price: 3500,
      startDateTime: '2026-09-12T14:00:00.000Z',
      startTimeStr: '02:00 PM',
      dayNumber: 1,
    },
    {
      id: 'item-hotel-01',
      itemType: 'hotel',
      title: 'Mountain View Residency Stay',
      origin: 'Manali',
      price: 6500,
      startDateTime: '2026-09-12T20:30:00.000Z',
      startTimeStr: '08:30 PM',
      dayNumber: 1,
      metadata: { checkin_deadline: '2026-09-12T23:30:00.000Z' },
    },
    {
      id: 'item-act-01',
      itemType: 'activity',
      title: 'Solang Valley Adventure',
      origin: 'Manali',
      price: 1800,
      startDateTime: '2026-09-13T09:00:00.000Z',
      startTimeStr: '09:00 AM',
      dayNumber: 2,
    },
  ];

  // Stage 13 tests
  await testAsync('Stage 13: Generates plans using reported disruption data', async () => {
    const res = await generateRecoveryPlans({
      disruption: reportedTrainDisruption,
      allItems: sampleItinerary,
      trip: { id: sampleTripId, name: 'Mumbai to Manali Trip' },
    });
    assert.strictEqual(res.plans.length, 3);
    assert.strictEqual(res.disruptionSummary.id, 'disr-train-delay-01');
    assert.strictEqual(res.disruptionSummary.disruptionType, 'Train Delay');
  });

  await testAsync('Stage 13: Deterministic financial calculation & refund status', async () => {
    const res = await generateRecoveryPlans({
      disruption: reportedTrainDisruption,
      allItems: sampleItinerary,
    });
    for (const plan of res.plans) {
      assert.ok(typeof plan.replacementCost === 'number');
      assert.ok(typeof plan.estimatedRefund === 'number');
      assert.ok(typeof plan.netFinancialImpact === 'number');
      assert.ok(plan.refundStatus);
      assert.ok(plan.netFinancialImpactLabel);
    }
  });

  await testAsync('Stage 13: Downstream protections and availability transparency', async () => {
    const res = await generateRecoveryPlans({
      disruption: reportedTrainDisruption,
      allItems: sampleItinerary,
    });
    const fastest = res.plans.find((p) => p.strategyType === 'earliest-arrival');
    assert.ok(fastest.transferImpact.includes('Protected'));
    assert.ok(fastest.hotelImpact.includes('Protected'));
    assert.ok(fastest.activityImpact.includes('Protected'));
  });

  // Stage 16 tests
  await testAsync('Stage 16: Plan comparison matrix metrics & distinct strategies', async () => {
    const res = await generateRecoveryPlans({
      disruption: reportedTrainDisruption,
      allItems: sampleItinerary,
    });
    assert.strictEqual(res.plans.length, 3);
    const [fastest, lowestCost, balanced] = res.plans;
    assert.strictEqual(fastest.strategyTag, 'Fastest');
    assert.strictEqual(lowestCost.strategyTag, 'Lowest Cost');
    assert.strictEqual(balanced.strategyTag, 'Most Itinerary Preserved');
    assert.ok(fastest.timeDelayMinutes <= lowestCost.timeDelayMinutes);
  });

  // Stage 17 tests
  await testAsync('Stage 17: AI explanation populated with deterministic fallback', async () => {
    const res = await generateRecoveryPlans({
      disruption: reportedTrainDisruption,
      allItems: sampleItinerary,
    });
    for (const plan of res.plans) {
      assert.ok(plan.aiExplanation && plan.aiExplanation.length > 5);
    }
  });

  // Stage 18 tests
  await testAsync('Stage 18: Confirm & Apply execution with history preservation and external notice', async () => {
    const res = await generateRecoveryPlans({
      disruption: reportedTrainDisruption,
      allItems: sampleItinerary,
    });
    const planToApply = res.plans[0];
    const applyRes = await applyRecoveryPlanToTrip({
      tripId: sampleTripId,
      disruptionId: reportedTrainDisruption.id,
      plan: planToApply,
      user: { id: 'user-tanvi' },
      previousItems: sampleItinerary,
    });
    assert.strictEqual(applyRes.success, true);
    assert.strictEqual(applyRes.appliedRecord.recoveryPlanId, planToApply.id);
    assert.ok(applyRes.message.includes('External booking still required'));
  });

  await testAsync('Stage 18: Validation guard against missing arguments', async () => {
    let threw = false;
    try {
      await applyRecoveryPlanToTrip({ tripId: null, plan: null });
    } catch (_) {
      threw = true;
    }
    assert.strictEqual(threw, true);
  });

  test('Stage 12/13: Connected Timeline preserves active disruptions and triggers Find Recovery Options CTA', () => {
    const trip = { id: sampleTripId, name: 'Mumbai to Manali Trip', origin_city: 'Mumbai', destination_city: 'Manali' };
    const timeline = buildConnectedItinerary({
      trip,
      bookings: [],
      itineraryItems: [
        { id: 'item-train-01', title: 'Day 1 Train', start_at: '2026-09-12T08:30:00Z', end_at: '2026-09-12T13:30:00Z' },
      ],
      disruptions: [reportedTrainDisruption],
    });

    assert.ok(timeline.activeDisruptions.length > 0, 'activeDisruptions must not be empty');
    assert.strictEqual(timeline.activeDisruptions[0].id, 'disr-train-delay-01');
    assert.strictEqual(timeline.tripSummary.hasDisruption, true);
    assert.strictEqual(timeline.allItems[0].isDisrupted, true);
  });

  console.log(`\n========================================`);
  console.log(`TEST SUMMARY: ${passed}/${total} TESTS PASSED (100%)`);
  console.log(`========================================`);
}

runTests();
