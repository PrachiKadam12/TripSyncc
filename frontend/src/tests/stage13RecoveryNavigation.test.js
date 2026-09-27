import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateRecoveryPlans } from '../services/recoveryService.js';
import { fetchBlastRadius } from '../services/blastRadiusService.js';
import { buildConnectedItinerary } from '../services/itineraryService.js';

describe('Stage 13 — Recovery Flow Navigation & Disruption Context Integration', () => {
  const sampleTripId = 'trip-mumbai-delhi-manali-2026';

  const reportedTrainDisruption = {
    id: 'disr-train-delay-01',
    trip_id: sampleTripId,
    title: 'Train Delay: Day 1 – Mumbai to Delhi',
    severity: 'high',
    detected_at: '2026-09-12T08:30:00.000Z',
    description: 'Delayed by 2 hours due to track maintenance.',
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
      startDateTime: '2026-09-12T08:30:00.000Z',
      startTimeStr: '08:30 AM',
      dayNumber: 1,
    },
    {
      id: 'item-transfer-01',
      itemType: 'transfer',
      title: 'Delhi Airport/Station to Hotel Transfer',
      origin: 'Delhi',
      destination: 'Manali',
      startDateTime: '2026-09-12T14:00:00.000Z',
      startTimeStr: '02:00 PM',
      dayNumber: 1,
    },
    {
      id: 'item-hotel-01',
      itemType: 'hotel',
      title: 'Mountain View Residency Stay',
      origin: 'Manali',
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
      startDateTime: '2026-09-13T09:00:00.000Z',
      startTimeStr: '09:00 AM',
      dayNumber: 2,
    },
  ];

  it('1. Correctly consumes reported disruption context (Train Delay, 120 mins, High severity)', async () => {
    const res = await generateRecoveryPlans({
      disruption: reportedTrainDisruption,
      allItems: sampleItinerary,
      trip: { id: sampleTripId, name: 'Mumbai to Manali Trip', origin: 'Mumbai', destination: 'Manali' },
      dependencies: [
        { predecessor_item_id: 'item-train-01', successor_item_id: 'item-transfer-01', dependency_type: 'direct_connection' },
        { predecessor_item_id: 'item-transfer-01', successor_item_id: 'item-hotel-01', dependency_type: 'direct_connection' },
        { predecessor_item_id: 'item-hotel-01', successor_item_id: 'item-act-01', dependency_type: 'destination_activity' },
      ],
    });

    expect(res).toBeDefined();
    expect(res.disruptionSummary).toBeDefined();
    expect(res.disruptionSummary.id).toBe('disr-train-delay-01');
    expect(res.disruptionSummary.disruptionType).toBe('Train Delay');
    expect(res.disruptionSummary.severity).toBe('high');
    expect(res.disruptionSummary.expectedDelayMinutes).toBe(120);
    expect(res.disruptionSummary.affectedItemTitle).toBe('Train — Day 1 — Mumbai to Delhi');
  });

  it('2. Generates feasible Stage 13 recovery strategies for the reported disruption', async () => {
    const res = await generateRecoveryPlans({
      disruption: reportedTrainDisruption,
      allItems: sampleItinerary,
      trip: { id: sampleTripId, name: 'Mumbai to Manali Trip' },
    });

    expect(res.plans).toBeInstanceOf(Array);
    expect(res.plans.length).toBeGreaterThanOrEqual(1);

    const fastest = res.plans.find((p) => p.strategyType === 'earliest-arrival');
    expect(fastest).toBeDefined();
    expect(fastest.title).toBeDefined();
    expect(fastest.feasibilityScore).toBeGreaterThanOrEqual(0);
    expect(typeof fastest.totalAdditionalCost).toBe('number');
  });

  it('3. Preserves existing Stage 14 Blast Radius graph computation for the reported disruption', async () => {
    const graphRes = await fetchBlastRadius({
      tripId: sampleTripId,
      disruption: reportedTrainDisruption,
      items: sampleItinerary,
      dependencies: [
        { predecessor_item_id: 'item-train-01', successor_item_id: 'item-transfer-01', dependency_type: 'direct_connection' },
      ],
      rootItemId: 'item-train-01',
      delayMinutes: 120,
    });

    expect(graphRes).toBeDefined();
    expect(graphRes.nodes).toBeInstanceOf(Array);
    expect(graphRes.nodes.some((n) => n.item_id === 'item-train-01')).toBe(true);
  });

  it('4. Handles missing disruption gracefully with no recovery plans and clear error message', async () => {
    const emptyRes = await generateRecoveryPlans({
      disruption: null,
      allItems: sampleItinerary,
    });

    expect(emptyRes.disruptionSummary).toBeNull();
    expect(emptyRes.plans).toEqual([]);
    expect(emptyRes.error).toContain('No active disruption provided');
  });

  it('5. Ensures buildConnectedItinerary populates activeDisruptions so Find Recovery Options renders', () => {
    const trip = { id: sampleTripId, name: 'Mumbai to Manali Trip', origin_city: 'Mumbai', destination_city: 'Manali' };
    const timeline = buildConnectedItinerary({
      trip,
      bookings: [],
      itineraryItems: [
        { id: 'item-train-01', title: 'Day 1 Train', start_at: '2026-09-12T08:30:00Z', end_at: '2026-09-12T13:30:00Z' }
      ],
      disruptions: [reportedTrainDisruption],
    });

    expect(timeline.activeDisruptions).toBeDefined();
    expect(timeline.activeDisruptions.length).toBeGreaterThan(0);
    expect(timeline.activeDisruptions[0].id).toBe('disr-train-delay-01');
    expect(timeline.tripSummary.hasDisruption).toBe(true);
  });
});
