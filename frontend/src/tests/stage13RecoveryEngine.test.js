import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateRecoveryPlans,
  evaluateFeasibility,
  calculateRecoveryScore,
  buildPlan,
  SCORE_WEIGHTS,
} from '../services/recoveryService.js';
import * as recoveryInventory from '../services/recoveryInventoryService.js';
import * as geminiService from '../services/geminiService.js';
import * as routeService from '../services/routeService.js';

describe('Stage 13 — Intelligent Recovery Engine Test Suite', () => {
  const mockStage12Disruption = {
    id: 'disr-12-flight-cancel',
    title: 'Flight Cancellation: Flight AI-123 (BOM ? DEL)',
    severity: 'critical',
    detected_at: '2026-10-01T06:00:00.000Z',
    metadata: {
      disruption_type: 'Flight Cancellation',
      affected_item_id: 'item-flight-1',
      affected_title: 'Flight AI-123 (BOM ? DEL)',
      expected_delay_minutes: 240,
    },
  };

  const mockConnectedItinerary = [
    {
      id: 'item-flight-1',
      itemType: 'flight',
      title: 'Flight AI-123 (BOM ? DEL)',
      origin: 'Mumbai',
      destination: 'Delhi',
      startDateTime: '2026-10-01T08:30:00.000Z',
      endDateTime: '2026-10-01T10:45:00.000Z',
      startTimeStr: '08:30 AM',
    },
    {
      id: 'item-transfer-1',
      itemType: 'transfer',
      title: 'Delhi Airport to Hotel Cab Transfer',
      startDateTime: '2026-10-01T11:30:00.000Z',
      endDateTime: '2026-10-01T14:30:00.000Z',
    },
    {
      id: 'item-hotel-1',
      itemType: 'hotel',
      title: 'Mountain View Residency',
      startDateTime: '2026-10-01T15:00:00.000Z',
      metadata: { checkin_deadline: '2026-10-02T04:00:00.000Z' }, // 24hr front desk
    },
    {
      id: 'item-activity-1',
      itemType: 'activity',
      title: 'Solang Valley Paragliding Session',
      startDateTime: '2026-10-02T10:00:00.000Z',
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    // Default mock for Gemini to prevent unneeded external network latency
    vi.spyOn(geminiService, 'generateGeminiContent').mockResolvedValue(
      'This option provides reliable recovery with minimal downstream changes.'
    );
    // Default realistic transfer duration (e.g. 3.5h airport to destination)
    vi.spyOn(routeService, 'fetchRouteDuration').mockResolvedValue({
      source: 'openrouteservice_live',
      duration_minutes: 210,
      distance_km: 180,
    });
  });

  // 1. Recovery plan generation
  it('1. generates multiple feasible recovery plans from Stage 12 disruption and connected itinerary', async () => {
    const result = await generateRecoveryPlans({
      disruption: mockStage12Disruption,
      allItems: mockConnectedItinerary,
      trip: { origin: 'Mumbai', destination: 'Delhi' },
    });

    expect(result).toBeDefined();
    expect(result.disruptionSummary).toBeDefined();
    expect(result.disruptionSummary.disruptionType).toBe('Flight Cancellation');
    expect(result.plans.length).toBeGreaterThanOrEqual(3);
  });

  // 2. Earliest-arrival strategy
  it('2. generates Earliest-Arrival strategy prioritizing earliest departure and landing', async () => {
    const result = await generateRecoveryPlans({
      disruption: mockStage12Disruption,
      allItems: mockConnectedItinerary,
    });

    const fastestPlan = result.plans.find((p) => p.strategyType === 'earliest-arrival');
    expect(fastestPlan).toBeDefined();
    expect(fastestPlan.strategyTag).toBe('Fastest');
    expect(fastestPlan.isFeasible).toBe(true);
    expect(fastestPlan.replacementTransport.carrier).toBe('IndiGo');
  });

  // 3. Lowest-cost strategy
  it('3. generates Lowest-Cost strategy prioritizing airline waiver / zero additional fare', async () => {
    const result = await generateRecoveryPlans({
      disruption: mockStage12Disruption,
      allItems: mockConnectedItinerary,
    });

    const lowestCostPlan = result.plans.find((p) => p.strategyType === 'lowest-cost');
    expect(lowestCostPlan).toBeDefined();
    expect(lowestCostPlan.strategyTag).toBe('Lowest Cost');
    expect(lowestCostPlan.totalAdditionalCost).toBe(0);
    expect(lowestCostPlan.whyItWorks).toEqual(
      expect.arrayContaining([expect.stringContaining('Zero extra airline fare')])
    );
  });

  // 4. Minimum-disruption strategy
  it('4. generates Minimum-Disruption strategy preserving maximum downstream itinerary items', async () => {
    const result = await generateRecoveryPlans({
      disruption: mockStage12Disruption,
      allItems: mockConnectedItinerary,
    });

    const minDisruptPlan = result.plans.find((p) => p.strategyType === 'minimum-disruption');
    expect(minDisruptPlan).toBeDefined();
    expect(minDisruptPlan.strategyTag).toBe('Most Itinerary Preserved');
    expect(minDisruptPlan.preservedCount).toBeGreaterThanOrEqual(2);
  });

  // 5. Time feasibility
  it('5. evaluates time feasibility considering connection buffer and arrival deadlines', () => {
    const candidate = { arrivalTime: '2026-10-01T13:00:00.000Z' };
    const hotelArrival = new Date('2026-10-01T19:30:00.000Z');

    const res = evaluateFeasibility({
      candidate,
      transferBufferMinutes: 45,
      minRequiredTransferBuffer: 30,
      hotelArrivalDate: hotelArrival,
    });

    expect(res.isFeasible).toBe(true);
    expect(res.hasTransferBuffer).toBe(true);
    expect(res.hotelCheckinFeasible).toBe(true);
  });

  // 6. Hotel check-in feasibility
  it('6. detects when hotel arrival violates check-in deadline', () => {
    const candidate = { arrivalTime: '2026-10-01T18:00:00.000Z' };
    const lateArrival = new Date('2026-10-01T23:45:00.000Z');
    const hotelItem = {
      metadata: { checkin_deadline: '2026-10-01T22:00:00.000Z' },
    };

    const res = evaluateFeasibility({
      candidate,
      transferBufferMinutes: 45,
      minRequiredTransferBuffer: 30,
      hotelArrivalDate: lateArrival,
      hotelItem,
    });

    expect(res.hotelCheckinFeasible).toBe(false);
    expect(res.isFeasible).toBe(false);
  });

  // 7. Activity conflict detection
  it('7. detects when delayed arrival conflicts with downstream activity start time', () => {
    const candidate = { arrivalTime: '2026-10-01T14:00:00.000Z' };
    const hotelArrival = new Date('2026-10-01T20:30:00.000Z');
    const activityItems = [
      { id: 'act-dinner', title: 'Welcome Dinner', startDateTime: '2026-10-01T19:00:00.000Z' },
    ];

    const res = evaluateFeasibility({
      candidate,
      hotelArrivalDate: hotelArrival,
      activityItems,
    });

    expect(res.activitiesFeasible).toBe(false);
    expect(res.conflictedActivities.length).toBe(1);
    expect(res.conflictedActivities[0].id).toBe('act-dinner');
    expect(res.isFeasible).toBe(false);
  });

  // 8. Transfer feasibility
  it('8. rejects connection buffer if transfer window is below minimum realistic threshold', () => {
    const res = evaluateFeasibility({
      candidate: { arrivalTime: '2026-10-01T13:00:00.000Z' },
      transferBufferMinutes: 15,
      minRequiredTransferBuffer: 30, // Requires 30m
      hotelArrivalDate: new Date('2026-10-01T19:00:00.000Z'),
    });

    expect(res.hasTransferBuffer).toBe(false);
    expect(res.isFeasible).toBe(false);
  });

  // 9. Cost calculation
  it('9. calculates total additional costs accurately including replacement transport and fees', () => {
    const plan = buildPlan({
      strategy: { type: 'earliest-arrival', tag: 'Fastest', strategyTitle: 'Fastest Plan', focus: 'Quickest' },
      candidate: {
        id: 'c1',
        carrier: 'IndiGo',
        flightNumber: '6E-100',
        departureTime: '2026-10-01T11:00:00.000Z',
        arrivalTime: '2026-10-01T13:15:00.000Z',
        departureTimeFormatted: '11:00 AM',
        arrivalTimeFormatted: '01:15 PM',
        additionalCost: 3200,
        transportType: 'flight',
      },
      disruptedItem: mockConnectedItinerary[0],
      downstreamItems: mockConnectedItinerary.slice(1),
      hotelItem: mockConnectedItinerary[2],
      transferItem: mockConnectedItinerary[1],
      activityItems: [mockConnectedItinerary[3]],
      groundTransferMinutes: 300,
      bookings: [{ type: 'hotel', refund_potential: 5000 }],
      allItems: mockConnectedItinerary,
    });

    expect(plan.totalAdditionalCost).toBe(3200);
    expect(plan.refundProtected).toBe(5000);
  });

  // 10. Itinerary preservation calculation
  it('10. calculates preserved, changed, cancelled, and new items accurately', () => {
    const plan = buildPlan({
      strategy: { type: 'minimum-disruption', tag: 'Most Itinerary Preserved', strategyTitle: 'Balanced', focus: 'Preserve' },
      candidate: {
        id: 'c2',
        carrier: 'SpiceJet',
        flightNumber: 'SG-200',
        departureTime: '2026-10-01T12:00:00.000Z',
        arrivalTime: '2026-10-01T14:15:00.000Z',
        departureTimeFormatted: '12:00 PM',
        arrivalTimeFormatted: '02:15 PM',
        additionalCost: 1100,
        transportType: 'flight',
      },
      disruptedItem: mockConnectedItinerary[0],
      downstreamItems: mockConnectedItinerary.slice(1),
      hotelItem: mockConnectedItinerary[2],
      transferItem: mockConnectedItinerary[1],
      activityItems: [mockConnectedItinerary[3]],
      groundTransferMinutes: 300,
      allItems: mockConnectedItinerary,
    });

    expect(plan.cancelledItems.length).toBe(1); // Original flight cancelled
    expect(plan.newItems.length).toBe(1);       // Replacement flight added
    expect(plan.changedItems.length).toBe(1);   // Transfer rescheduled
    expect(plan.preservedItems.length).toBeGreaterThanOrEqual(2); // Hotel + activity preserved
    expect(plan.preservedCount).toBeGreaterThanOrEqual(2);
  });

  // 11. Recovery score explanation
  it('11. generates transparent, explainable recovery score matching SCORE_WEIGHTS breakdown', () => {
    const score = calculateRecoveryScore({
      strategyType: 'earliest-arrival',
      diffMinutes: 120,
      totalAdditionalCost: 2000,
      preservedCount: 4,
      totalCount: 5,
      isFeasible: true,
    });

    expect(score.totalScore).toBeGreaterThanOrEqual(40);
    expect(score.totalScore).toBeLessThanOrEqual(99);
    expect(score.timePreservation).toBeLessThanOrEqual(SCORE_WEIGHTS.timePreservation);
    expect(score.itineraryPreservation).toBeLessThanOrEqual(SCORE_WEIGHTS.itineraryPreservation);
    expect(score.feasibility).toBe(SCORE_WEIGHTS.feasibility);
    expect(score.costComponent).toBeLessThanOrEqual(SCORE_WEIGHTS.costPenalty);
  });

  // 12. No feasible plan
  it('12. assigns reduced score and flags unfeasible plan when constraints are violated', () => {
    const score = calculateRecoveryScore({
      strategyType: 'earliest-arrival',
      diffMinutes: 600,
      totalAdditionalCost: 9000,
      preservedCount: 1,
      totalCount: 5,
      isFeasible: false,
    });

    expect(score.totalScore).toBe(35);
    expect(score.feasibility).toBe(0);
  });

  // 13. Missing inventory
  it('13. handles missing alternative transport inventory gracefully without crashing', async () => {
    vi.spyOn(recoveryInventory, 'findAlternativeTransport').mockResolvedValueOnce([]);

    const result = await generateRecoveryPlans({
      disruption: mockStage12Disruption,
      allItems: mockConnectedItinerary,
    });

    expect(result.plans).toEqual([]);
    expect(result.error).toContain('No alternative transport inventory');
  });

  // 14. Gemini failure fallback
  it('14. falls back to deterministic explanation when Gemini AI service fails', async () => {
    vi.spyOn(geminiService, 'generateGeminiContent').mockRejectedValue(
      new Error('Gemini API quota exceeded')
    );

    const result = await generateRecoveryPlans({
      disruption: mockStage12Disruption,
      allItems: mockConnectedItinerary,
    });

    expect(result.plans.length).toBeGreaterThan(0);
    for (const plan of result.plans) {
      expect(plan.aiExplanation).toBeDefined();
      expect(typeof plan.aiExplanation).toBe('string');
      expect(plan.aiExplanation.length).toBeGreaterThan(10);
    }
  });

  // 15. Stage 12 disruption input
  it('15. correctly consumes normalized Stage 12 disruption input object', async () => {
    const stage12DisruptionInput = {
      id: 'disr-realtime-scan',
      title: 'AviationStack: Flight AI-123 cancelled due to technical maintenance',
      severity: 'critical',
      detected_at: new Date().toISOString(),
      metadata: {
        disruption_type: 'Flight Cancellation',
        affected_item_id: 'item-flight-1',
        affected_title: 'Flight AI-123 (BOM ? DEL)',
        expected_delay_minutes: 300,
        source: 'AviationStack Realtime Proxy',
      },
    };

    const result = await generateRecoveryPlans({
      disruption: stage12DisruptionInput,
      allItems: mockConnectedItinerary,
    });

    expect(result.disruptionSummary.id).toBe('disr-realtime-scan');
    expect(result.disruptionSummary.expectedDelayMinutes).toBe(300);
    expect(result.disruptionSummary.affectedItemTitle).toContain('Flight AI-123');
    expect(result.plans.length).toBe(3);
  });
});
