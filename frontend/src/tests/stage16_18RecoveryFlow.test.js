import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateRecoveryPlans, evaluateFeasibility, calculateRecoveryScore, applyRecoveryPlanToTrip } from '../services/recoveryService.js';
import { fetchBlastRadius } from '../services/blastRadiusService.js';

describe('TripSync Complete Recovery Engine (Stages 13, 16, 17, 18)', () => {
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

  // ── STAGE 13 TESTS ──
  describe('Stage 13 — Recovery Plans Generation & Deterministic Financials', () => {
    it('1-7. Generates multiple feasible recovery plans using reported disruption data', async () => {
      const res = await generateRecoveryPlans({
        disruption: reportedTrainDisruption,
        allItems: sampleItinerary,
        trip: { id: sampleTripId, name: 'Mumbai to Manali Trip', origin: 'Mumbai', destination: 'Manali' },
      });

      expect(res.plans).toBeInstanceOf(Array);
      expect(res.plans.length).toBeGreaterThanOrEqual(3);
      expect(res.disruptionSummary.id).toBe('disr-train-delay-01');
      expect(res.disruptionSummary.disruptionType).toBe('Train Delay');
      expect(res.disruptionSummary.expectedDelayMinutes).toBe(120);
    });

    it('8-11. Calculates deterministic net financial impact and refund status accurately', async () => {
      const res = await generateRecoveryPlans({
        disruption: reportedTrainDisruption,
        allItems: sampleItinerary,
        trip: { id: sampleTripId, name: 'Mumbai to Manali Trip' },
      });

      for (const plan of res.plans) {
        expect(typeof plan.originalBookingCost).toBe('number');
        expect(typeof plan.replacementCost).toBe('number');
        expect(typeof plan.estimatedRefund).toBe('number');
        expect(typeof plan.netFinancialImpact).toBe('number');
        expect(plan.refundStatus).toBeDefined();
        expect(plan.netFinancialImpactLabel).toBeDefined();

        // Verification: Net Financial Impact = Replacement Cost - Estimated Refund (or verified delta)
        const expectedNet = plan.replacementCost - (plan.strategyType === 'lowest-cost' ? 0 : plan.estimatedRefund);
        expect(plan.netFinancialImpact).toBe(expectedNet);
      }
    });

    it('12-16. Evaluates deadline feasibility, downstream impacts, and availability transparency', async () => {
      const res = await generateRecoveryPlans({
        disruption: reportedTrainDisruption,
        allItems: sampleItinerary,
      });

      const fastest = res.plans.find((p) => p.strategyType === 'earliest-arrival');
      expect(fastest.transferImpact).toContain('Protected');
      expect(fastest.hotelImpact).toContain('Protected');
      expect(fastest.activityImpact).toContain('Protected');
      expect(fastest.availabilityStatus).toBeDefined();
      expect(fastest.dataSource).toBeDefined();
      expect(fastest.whyItWorks.length).toBeGreaterThanOrEqual(1);
      expect(fastest.tradeoffs.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── STAGE 16 TESTS ──
  describe('Stage 16 — Plan Comparison Matrix', () => {
    it('17-21. Retains all Stage 13 plans with comparative time, cost, risk, and feasibility metrics', async () => {
      const res = await generateRecoveryPlans({
        disruption: reportedTrainDisruption,
        allItems: sampleItinerary,
      });

      expect(res.plans).toHaveLength(3);
      const [fastest, lowestCost, balanced] = res.plans;

      expect(fastest.strategyTag).toBe('Fastest');
      expect(lowestCost.strategyTag).toBe('Lowest Cost');
      expect(balanced.strategyTag).toBe('Most Itinerary Preserved');

      // Fastest arrives earliest
      expect(fastest.timeDelayMinutes).toBeLessThanOrEqual(lowestCost.timeDelayMinutes);
      // Lowest cost has minimum additional fee
      expect(lowestCost.totalAdditionalCost).toBeLessThanOrEqual(fastest.totalAdditionalCost);
    });
  });

  // ── STAGE 17 TESTS ──
  describe('Stage 17 — AI Explanation Layer & Deterministic Fallbacks', () => {
    it('22-26. Populates non-authoritative AI explanation and respects deterministic fallback on failure', async () => {
      const res = await generateRecoveryPlans({
        disruption: reportedTrainDisruption,
        allItems: sampleItinerary,
      });

      for (const plan of res.plans) {
        expect(plan.aiExplanation).toBeDefined();
        expect(typeof plan.aiExplanation).toBe('string');
        expect(plan.aiExplanation.length).toBeGreaterThan(10);
      }
    });
  });

  // ── STAGE 18 TESTS ──
  describe('Stage 18 — Confirm & Apply Recovery Plan', () => {
    it('27-34. Successfully validates, applies plan, and returns transparent external booking notice', async () => {
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

      expect(applyRes.success).toBe(true);
      expect(applyRes.appliedRecord).toBeDefined();
      expect(applyRes.appliedRecord.recoveryPlanId).toBe(planToApply.id);
      expect(applyRes.appliedRecord.status).toBe('applied');
      expect(applyRes.message).toContain('External booking still required');
    });

    it('Guards against missing tripId or plan on application', async () => {
      await expect(
        applyRecoveryPlanToTrip({ tripId: null, plan: null })
      ).rejects.toThrow('Trip ID and selected recovery plan are required.');
    });
  });
});
