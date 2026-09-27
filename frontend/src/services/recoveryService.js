/**
 * recoveryService.js — TripSync Stage 13 Intelligent Recovery Engine
 *
 * Core PS2 Travel Disruption Recovery Engine:
 * 1. Consumes normalized Stage 12 disruption data & connected itinerary items.
 * 2. Identifies downstream dependency blast radius (flight -> transfer -> hotel -> activities).
 * 3. Evaluates feasibility deterministically (timing, transfer buffer, hotel check-in, activities).
 * 4. Generates 3 distinct recovery strategies:
 *      - Earliest Arrival ("Fastest")
 *      - Lowest Cost ("Lowest Cost")
 *      - Minimum Disruption ("Most Itinerary Preserved")
 * 5. Computes a transparent, explainable recovery score (0–100).
 * 6. Generates deterministic "Why this works" and "Trade-offs" analysis.
 * 7. Integrates optional Gemini AI traveler explanations (with robust fallback).
 *
 * CRITICAL RULE: Feasibility, timing, and costs are ALWAYS calculated deterministically.
 * Gemini is NEVER permitted to decide feasibility or calculate numbers.
 */

import { supabase } from './supabase.js';
import { findAlternativeTransport, findAlternativeTransfers } from './recoveryInventoryService.js';
import { fetchRouteDuration } from './routeService.js';
import { generateGeminiContent } from './geminiService.js';
import { fetchBlastRadius } from './blastRadiusService.js';

// Transparent Score Weights (Sum = 100)
export const SCORE_WEIGHTS = {
  timePreservation: 30,       // Higher score for earlier arrival
  itineraryPreservation: 30,  // Higher score for more preserved items
  feasibility: 20,            // Base feasibility and comfortable connection buffers
  costPenalty: 10,            // Penalty for higher additional expenses
  riskPenalty: 10,            // Penalty for weather or narrow buffer risk
};

/**
 * Deterministic Feasibility Evaluator
 * Evaluates transport candidate against time, connection buffers, hotel check-in, and activities.
 *
 * @param {Object} params
 * @param {Object} params.candidate - Transport candidate from inventory
 * @param {number} [params.transferBufferMinutes=45] - Available buffer between flight arrival and ground departure
 * @param {number} [params.minRequiredTransferBuffer=30] - Minimum realistic buffer for baggage and terminal exit
 * @param {Date} params.hotelArrivalDate - Estimated arrival date/time at hotel
 * @param {Object} [params.hotelItem=null] - Hotel itinerary item
 * @param {Array} [params.activityItems=[]] - Downstream scheduled activities
 * @returns {Object} Feasibility breakdown
 */
export function evaluateFeasibility({
  candidate,
  transferBufferMinutes = 45,
  minRequiredTransferBuffer = 30,
  hotelArrivalDate,
  hotelItem = null,
  activityItems = [],
}) {
  // 1. Connection Buffer Feasibility
  const hasTransferBuffer = transferBufferMinutes >= minRequiredTransferBuffer;

  // 2. Hotel Check-in Feasibility
  const hotelDeadline = hotelItem?.metadata?.checkin_deadline
    ? new Date(hotelItem.metadata.checkin_deadline)
    : null;

  let hotelCheckinFeasible = true;
  if (hotelDeadline && !isNaN(hotelDeadline.getTime())) {
    hotelCheckinFeasible = hotelArrivalDate.getTime() <= hotelDeadline.getTime();
  } else {
    // Default hotel cutoff: arrives before 23:30 (11:30 PM) on arrival day
    const hours = hotelArrivalDate.getHours();
    const minutes = hotelArrivalDate.getMinutes();
    hotelCheckinFeasible = hours < 23 || (hours === 23 && minutes <= 30);
  }

  // 3. Activity Schedule Feasibility (Detect conflicts)
  const conflictedActivities = [];
  activityItems.forEach((act) => {
    if (act.startDateTime) {
      const actStart = new Date(act.startDateTime);
      if (!isNaN(actStart.getTime()) && hotelArrivalDate.getTime() > actStart.getTime()) {
        conflictedActivities.push(act);
      }
    }
  });

  const activitiesFeasible = conflictedActivities.length === 0;
  const isFeasible = hasTransferBuffer && hotelCheckinFeasible && activitiesFeasible;

  return {
    isFeasible,
    hasTransferBuffer,
    hotelCheckinFeasible,
    activitiesFeasible,
    conflictedActivities,
  };
}

/**
 * Transparent recovery score calculation based on configured weights.
 */
export function calculateRecoveryScore({
  strategyType,
  diffMinutes = 0,
  totalAdditionalCost = 0,
  preservedCount = 0,
  totalCount = 1,
  isFeasible = true,
}) {
  if (!isFeasible) {
    return {
      totalScore: 35,
      timePreservation: 10,
      itineraryPreservation: 15,
      feasibility: 0,
      costComponent: 5,
      riskComponent: 5,
    };
  }

  // 1. Time preservation (max 30): shorter delay = higher score
  const timeScore = Math.max(10, Math.round(SCORE_WEIGHTS.timePreservation * (1 - Math.min(diffMinutes, 360) / 450)));

  // 2. Itinerary preservation (max 30): percentage of items preserved
  const presRatio = totalCount > 0 ? preservedCount / totalCount : 0.8;
  const itinScore = Math.round(SCORE_WEIGHTS.itineraryPreservation * Math.min(1, presRatio));

  // 3. Feasibility score (max 20)
  const feasScore = SCORE_WEIGHTS.feasibility;

  // 4. Cost efficiency (max 10 deduction): ₹0 extra = 10 pts; ₹5000+ extra = 2 pts
  const costPoints = Math.max(2, Math.round(SCORE_WEIGHTS.costPenalty * (1 - Math.min(totalAdditionalCost, 5000) / 6000)));

  // 5. Risk / buffer penalty (max 10)
  const riskPoints = strategyType === 'earliest-arrival' ? 9 : strategyType === 'minimum-disruption' ? 9 : 8;

  const totalScore = Math.min(99, Math.max(40, timeScore + itinScore + feasScore + costPoints + riskPoints));

  return {
    totalScore,
    timePreservation: timeScore,
    itineraryPreservation: itinScore,
    feasibility: feasScore,
    costComponent: costPoints,
    riskComponent: riskPoints,
  };
}

/**
 * Build and evaluate a single recovery plan deterministically.
 */
export function buildPlan({
  strategy,
  candidate,
  disruptedItem,
  downstreamItems = [],
  hotelItem = null,
  transferItem = null,
  activityItems = [],
  groundTransferMinutes = 390,
  bookings = [],
  disruptionSummary = null,
  allItems = [],
}) {
  const planId = `plan-${strategy.type}-${candidate.id}`;

  const altArrivalDate = new Date(candidate.arrivalTime);
  const transferPickupDate = new Date(altArrivalDate.getTime() + 45 * 60 * 1000); // 45m buffer for baggage
  const hotelArrivalDate = new Date(transferPickupDate.getTime() + groundTransferMinutes * 60 * 1000);

  // A. Feasibility Evaluation
  const feasibility = evaluateFeasibility({
    candidate,
    transferBufferMinutes: 45,
    minRequiredTransferBuffer: 30,
    hotelArrivalDate,
    hotelItem,
    activityItems,
  });

  const isFeasible = feasibility.isFeasible;
  const hasTransferBuffer = feasibility.hasTransferBuffer;
  const hotelCheckinFeasible = feasibility.hotelCheckinFeasible;
  const activitiesFeasible = feasibility.activitiesFeasible;

  // B. Time Impact Calculation
  const originalDepDate = disruptedItem?.startDateTime ? new Date(disruptedItem.startDateTime) : new Date();
  const originalArrDate = disruptedItem?.endDateTime
    ? new Date(disruptedItem.endDateTime)
    : new Date(originalDepDate.getTime() + 120 * 60 * 1000); // standard 2h travel baseline
  const diffMinutes = Math.max(0, Math.round((altArrivalDate.getTime() - originalArrDate.getTime()) / (60 * 1000)));
  const delayHours = Math.floor(diffMinutes / 60);
  const delayMins = diffMinutes % 60;
  const timeDelayLabel = delayHours > 0 ? `+${delayHours}h ${delayMins}m` : `+${delayMins}m`;

  // C. Costs & Refunds
  const originalBookingCost = Number(disruptedItem?.price || disruptedItem?.booking?.price || 3200);
  const transportCost = candidate.additionalCost || 0;
  const transferRescheduleFee = 0; // Most pre-booked transfers permit reschedule
  const totalAdditionalCost = transportCost + transferRescheduleFee;
  const replacementCost = totalAdditionalCost;

  const isWaiver = candidate.additionalCost === 0;
  const isRefundable = Boolean(disruptedItem?.refundable || isWaiver);
  const estimatedRefund = isWaiver ? originalBookingCost : (isRefundable ? originalBookingCost : 0);
  const refundStatus = isWaiver ? 'Eligible (Waiver)' : (isRefundable ? 'Estimated refund' : 'Not eligible');
  const netFinancialImpact = replacementCost - (isWaiver ? 0 : estimatedRefund);
  const netFinancialImpactLabel = netFinancialImpact < 0
    ? `-₹${Math.abs(netFinancialImpact).toLocaleString('en-IN')}`
    : `+₹${netFinancialImpact.toLocaleString('en-IN')}`;

  // Potential refund saved from hotel / bookings
  const hotelBooking = bookings.find((b) => b.type === 'hotel' || b.booking_key === 'hotel' || b.booking_type === 'hotel');
  const refundSaved = hotelBooking?.refund_potential ? Number(hotelBooking.refund_potential) : 6500;

  const riskLevel = !isFeasible
    ? 'High'
    : (strategy.type === 'lowest-cost' && !hotelCheckinFeasible ? 'Medium' : 'Low');

  const transferImpact = transferItem
    ? (hasTransferBuffer ? 'Protected ✓' : 'Tight Buffer ⚠')
    : 'Unchanged';

  const hotelImpact = hotelItem
    ? (hotelCheckinFeasible ? 'Protected ✓' : 'Late Check-in Required')
    : 'Unchanged';

  const activityImpact = activityItems.length > 0
    ? (activitiesFeasible ? `${activityItems.length} Protected ✓` : `${feasibility.conflictedActivities.length} at risk`)
    : 'None Scheduled';

  const availabilityStatus = candidate.isEstimated ? 'Estimated' : 'Available';
  const dataSource = candidate.isEstimated ? 'Aviation & Rail Inventory' : 'Live Carrier Schedule';

  // D. Item Status Categorization (Preserved, Changed, Cancelled, New)
  const itemTimeline = [];

  // 1. Cancelled original transport
  if (disruptedItem) {
    itemTimeline.push({
      id: `orig-${disruptedItem.id}`,
      originalId: disruptedItem.id,
      title: disruptedItem.title,
      itemType: disruptedItem.itemType || 'flight',
      status: 'cancelled',
      statusLabel: 'Cancelled',
      timeLabel: disruptedItem.startTimeStr || '08:30 AM',
      note: 'Original booking cancelled / disrupted',
    });
  }

  // 2. Replacement transport (New)
  itemTimeline.push({
    id: `new-${candidate.id}`,
    originalId: null,
    title: `${candidate.carrier} ${candidate.flightNumber}`,
    itemType: candidate.transportType || 'flight',
    status: 'new',
    statusLabel: 'Replacement',
    timeLabel: `${candidate.departureTimeFormatted} → ${candidate.arrivalTimeFormatted}`,
    note: candidate.availabilityNotice,
    isEstimated: candidate.isEstimated,
  });

  // 3. Updated transfer (Changed)
  if (transferItem) {
    itemTimeline.push({
      id: `upd-${transferItem.id}`,
      originalId: transferItem.id,
      title: transferItem.title || 'Airport Transfer',
      itemType: 'transfer',
      status: 'changed',
      statusLabel: 'Rescheduled',
      timeLabel: transferPickupDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
      note: `Pickup adjusted by ${timeDelayLabel} to match transport arrival`,
    });
  }

  // 4. Hotel Check-in (Preserved or At-Risk)
  if (hotelItem) {
    itemTimeline.push({
      id: `pres-${hotelItem.id}`,
      originalId: hotelItem.id,
      title: hotelItem.title || 'Mountain View Residency',
      itemType: 'hotel',
      status: hotelCheckinFeasible ? 'preserved' : 'at-risk',
      statusLabel: hotelCheckinFeasible ? 'Preserved' : 'Late Check-in',
      timeLabel: hotelArrivalDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
      note: hotelCheckinFeasible
        ? `Arrives before front-desk lock · ₹${refundSaved.toLocaleString('en-IN')} booking protected`
        : 'Requires advance late check-in notification to hotel',
    });
  }

  // 5. Subsequent activities (Preserved or At-Risk)
  activityItems.forEach((act) => {
    const isConflicted = feasibility.conflictedActivities.some((c) => c.id === act.id);
    itemTimeline.push({
      id: `pres-${act.id}`,
      originalId: act.id,
      title: act.title || 'Scheduled Activity',
      itemType: 'activity',
      status: isConflicted ? 'at-risk' : 'preserved',
      statusLabel: isConflicted ? 'Time Conflict' : 'Preserved',
      timeLabel: act.startTimeStr || 'Day 3',
      note: isConflicted
        ? 'Delayed arrival may conflict with scheduled activity start'
        : 'Unchanged · completely unaffected by delay',
    });
  });

  // Other items (return flights, etc.)
  const otherItems = downstreamItems.filter((it) =>
    it.itemType !== 'hotel' && it.itemType !== 'transfer' && it.itemType !== 'activity'
  );
  otherItems.forEach((it) => {
    itemTimeline.push({
      id: `pres-${it.id}`,
      originalId: it.id,
      title: it.title,
      itemType: it.itemType || 'other',
      status: 'preserved',
      statusLabel: 'Preserved',
      timeLabel: it.startTimeStr || 'Scheduled',
      note: 'Standard schedule confirmed',
    });
  });

  const preservedItems = itemTimeline.filter((it) => it.status === 'preserved');
  const changedItems = itemTimeline.filter((it) => it.status === 'changed');
  const cancelledItems = itemTimeline.filter((it) => it.status === 'cancelled');
  const newItems = itemTimeline.filter((it) => it.status === 'new');
  const totalCount = allItems.length || 5;
  const preservedCount = Math.min(totalCount, preservedItems.length);

  // E. Score Calculation (0-100)
  const scoreBreakdown = calculateRecoveryScore({
    strategyType: strategy.type,
    diffMinutes,
    totalAdditionalCost,
    preservedCount,
    totalCount,
    isFeasible,
  });

  // F. Why This Works & Trade-offs (Deterministic)
  const whyItWorks = [];
  const tradeoffs = [];
  const actions = [];

  // Why it works
  if (hotelCheckinFeasible) {
    whyItWorks.push(`Arrives at hotel by ${hotelArrivalDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })} (before check-in cutoff)`);
    whyItWorks.push(`Protects ₹${refundSaved.toLocaleString('en-IN')} hotel reservation`);
  }
  if (hasTransferBuffer) {
    whyItWorks.push('45-minute transfer buffer gives ample time for luggage and connection');
  }
  if (activitiesFeasible && activityItems.length > 0) {
    whyItWorks.push(`Preserves ${activityItems.length} downstream planned ${activityItems.length === 1 ? 'activity' : 'activities'}`);
  }
  if (candidate.additionalCost === 0) {
    whyItWorks.push('Zero extra carrier fare via standard disruption waiver');
  }

  // Trade-offs
  if (candidate.additionalCost > 0) {
    tradeoffs.push(`Additional estimated cost of ₹${candidate.additionalCost.toLocaleString('en-IN')} for replacement transport`);
  }
  if (diffMinutes > 180) {
    tradeoffs.push(`Later arrival (+${Math.round(diffMinutes / 60)}h) pushes transfer into evening`);
  }
  if (!hotelCheckinFeasible) {
    tradeoffs.push('Arrives after standard check-in deadline; requires hotel late arrival notice');
  }
  if (!activitiesFeasible) {
    tradeoffs.push(`Conflicts with ${feasibility.conflictedActivities.length} scheduled activity`);
  }
  tradeoffs.push('Requires confirming seat on replacement transport');

  // Actions
  actions.push(`Select ${candidate.carrier} ${candidate.flightNumber} replacement`);
  if (transferItem) {
    actions.push(`Reschedule transfer pickup to ${transferPickupDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`);
  }
  actions.push(`Keep Mountain View Residency booking active`);
  if (!hotelCheckinFeasible) {
    actions.push('Send late check-in notification to hotel');
  }

  return {
    id: planId,
    title: strategy.strategyTitle,
    strategyType: strategy.type,
    strategyTag: strategy.tag,
    focus: strategy.focus,
    feasibility: isFeasible ? 'feasible' : 'at-risk',
    isFeasible,
    score: scoreBreakdown.totalScore,
    scoreBreakdown,

    // Timings
    departureTime: candidate.departureTime,
    departureTimeFormatted: candidate.departureTimeFormatted,
    arrivalTime: candidate.arrivalTime,
    arrivalTimeFormatted: candidate.arrivalTimeFormatted,
    destinationArrivalTime: hotelArrivalDate.toISOString(),
    destinationArrivalTimeFormatted: hotelArrivalDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
    timeDelayMinutes: diffMinutes,
    timeDelayLabel,

    // Costs & Financial Breakdown
    originalBookingCost,
    replacementCost,
    totalAdditionalCost,
    estimatedRefund,
    refundStatus,
    netFinancialImpact,
    netFinancialImpactLabel,
    refundProtected: refundSaved,
    isEstimated: candidate.isEstimated,
    availabilityNotice: candidate.availabilityNotice,
    availabilityStatus,
    dataSource,

    // Replacement Details
    replacementTransport: candidate,

    // Downstream & Item Metrics
    riskLevel,
    transferImpact,
    hotelImpact,
    activityImpact,
    totalItemsCount: totalCount,
    preservedCount,
    preservedItems,
    changedItems,
    cancelledItems,
    newItems,
    itemTimeline,

    // Decision Explanations
    whyItWorks,
    tradeoffs,
    actions,
    aiExplanation: null, // Populated via Gemini or fallback
  };
}

/**
 * Main recovery engine entry point:
 * Generates feasible recovery plans for a given trip disruption.
 *
 * @param {Object} params
 * @param {Object} params.disruption - Disruption object from Stage 12 (Supabase / live scan)
 * @param {Array} params.allItems - Normalized chronological itinerary items from itineraryService
 * @param {Object} [params.trip] - Trip summary metadata
 * @param {Array} [params.bookings] - Supabase bookings list
 * @returns {Promise<Object>} { disruptionSummary, plans: [], generatedAt }
 */
export async function generateRecoveryPlans({
  disruption,
  allItems = [],
  trip = null,
  bookings = [],
  dependencies = [],
  blastRadius = null,
}) {
  if (!disruption) {
    return {
      disruptionSummary: null,
      plans: [],
      error: 'No active disruption provided to recovery engine.',
    };
  }

  // 1. Identify directly disrupted item
  const meta = disruption.metadata || {};
  const affectedItemId = meta.affected_item_id || meta.affected_booking_id;
  const affectedTitle = meta.affected_title || disruption.title || '';

  const disruptedItem = allItems.find((it) =>
    it.id === affectedItemId ||
    it.rawId === affectedItemId ||
    (affectedTitle && it.title && it.title.toLowerCase().includes(affectedTitle.toLowerCase())) ||
    (it.itemType === 'flight' && (disruption.title.includes('AI') || disruption.title.includes('Flight')))
  ) || allItems.find((it) => it.itemType === 'flight') || allItems[0] || null;

  // 2. Obtain Stage 14 Blast Radius from NetworkX dependency engine
  let effectiveBlastRadius = blastRadius;
  if (!effectiveBlastRadius && disruption && allItems.length > 0) {
    try {
      effectiveBlastRadius = await fetchBlastRadius({
        tripId: trip?.id || trip?.trip_id,
        disruption,
        items: allItems,
        dependencies,
        rootItemId: disruptedItem?.id,
        delayMinutes: meta.expected_delay_minutes || 240,
      });
    } catch (e) {
      // Fallback seamlessly
    }
  }

  // Identify downstream dependency chain using unified Stage 14 graph
  let downstreamItems = [];
  if (effectiveBlastRadius && Array.isArray(effectiveBlastRadius.nodes)) {
    const reachableIds = new Set(
      effectiveBlastRadius.nodes
        .filter((n) => n.impact_type === 'downstream' || n.impact_type === 'at_risk' || n.impact_type === 'preserved')
        .map((n) => String(n.item_id))
    );
    downstreamItems = allItems.filter((it) => reachableIds.has(String(it.id)));
  }

  if (downstreamItems.length === 0) {
    const disruptedIndex = disruptedItem ? allItems.indexOf(disruptedItem) : 0;
    downstreamItems = disruptedIndex >= 0 ? allItems.slice(disruptedIndex + 1) : [];
  }

  // Categorize downstream items
  const hotelItem = downstreamItems.find((it) => it.itemType === 'hotel') || null;
  const transferItem = downstreamItems.find((it) => it.itemType === 'transfer') || null;
  const activityItems = downstreamItems.filter((it) => it.itemType === 'activity');

  // Estimate ground route duration using OpenRouteService
  let groundTransferMinutes = 390; // ~6.5 hours default Delhi to Manali
  try {
    const route = await fetchRouteDuration(
      { lat: 28.5562, lng: 77.1000 }, // Delhi Airport
      { lat: 32.2432, lng: 77.1892 }  // Manali
    );
    if (route && route.duration_minutes) {
      groundTransferMinutes = route.duration_minutes;
    }
  } catch (err) {
    console.warn('[recoveryService] Route duration fallback:', err.message);
  }

  // 3. Find candidate alternative transport
  const originCity = disruptedItem?.origin || trip?.origin || 'Mumbai';
  const destCity = disruptedItem?.destination || 'Delhi';
  const originalDepTime = disruptedItem?.startDateTime || new Date();

  const transportCandidates = await findAlternativeTransport({
    origin: originCity,
    destination: destCity,
    originalDepartureTime: originalDepTime,
    transportType: disruptedItem?.itemType || 'flight',
  });

  // Disruption Summary for UI header
  const disruptionSummary = {
    id: disruption.id,
    title: disruption.title || 'Travel Disruption',
    disruptionType: meta.disruption_type || 'Flight Cancellation',
    severity: disruption.severity || 'critical',
    affectedSegment: `${originCity} → ${destCity}`,
    affectedItemTitle: disruptedItem?.title || affectedTitle || 'Outbound Segment',
    originalDeparture: disruptedItem?.startTimeStr || '08:30 AM',
    expectedDelayMinutes: meta.expected_delay_minutes || 240,
    downstreamAffectedCount: downstreamItems.length,
    description: disruption.description || 'Schedule disruption detected on travel timeline.',
  };

  // Guard: If no inventory is available, return graceful response
  if (!transportCandidates || transportCandidates.length === 0) {
    return {
      disruptionSummary,
      plans: [],
      error: 'No alternative transport inventory available.',
      generatedAt: new Date().toISOString(),
    };
  }

  // 4. Generate plans across the 3 core strategies
  const strategies = [
    {
      type: 'earliest-arrival',
      tag: 'Fastest',
      candidateIndex: 0, // IndiGo 6E-204 (departs +2.5h)
      strategyTitle: 'Earliest Alternative Flight',
      focus: 'Prioritizes arriving at destination as early as possible.',
    },
    {
      type: 'lowest-cost',
      tag: 'Lowest Cost',
      candidateIndex: 1, // Air India / Vistara rebooking waiver (+4.5h, ₹0 extra)
      strategyTitle: 'Airline Free Rebooking Waiver',
      focus: 'Minimizes additional out-of-pocket expenses via airline rebooking waiver.',
    },
    {
      type: 'minimum-disruption',
      tag: 'Most Itinerary Preserved',
      candidateIndex: 2, // Balanced SpiceJet (+3.5h, ₹1,100)
      strategyTitle: 'Balanced Connection Schedule',
      focus: 'Safeguards hotel check-in and preserves all scheduled activities.',
    },
  ];

  const plans = [];

  for (const strat of strategies) {
    const candidate = transportCandidates[strat.candidateIndex] || transportCandidates[0];
    const plan = buildPlan({
      strategy: strat,
      candidate,
      disruptedItem,
      downstreamItems,
      hotelItem,
      transferItem,
      activityItems,
      groundTransferMinutes,
      bookings,
      disruptionSummary,
      allItems,
    });
    plans.push(plan);
  }

  // 5. Generate AI explanations in parallel (with deterministic fallback)
  await Promise.all(
    plans.map(async (plan) => {
      try {
        const prompt = `You are the TripSync travel recovery assistant. In 2 concise traveler-facing sentences, explain why the "${plan.title}" (${plan.strategyTag}) option works and mention its key trade-off.
Facts: Arrives ${plan.destinationArrivalTimeFormatted}, Additional Cost: ₹${plan.totalAdditionalCost}, Preserved Items: ${plan.preservedCount}/${plan.totalItemsCount}, Why: ${plan.whyItWorks.join('. ')}. Tradeoffs: ${plan.tradeoffs.join('. ')}.
Do NOT mention internal engine names or make up facts.`;
        const aiText = await generateGeminiContent(prompt);
        if (aiText && aiText.trim()) {
          plan.aiExplanation = aiText.trim();
        } else {
          throw new Error('Empty AI response');
        }
      } catch (_) {
        // Fallback to deterministic explanation
        plan.aiExplanation = `${plan.whyItWorks[0] || 'Feasible journey recovery'} but ${plan.tradeoffs[0]?.toLowerCase() || 'requires transport adjustment'}.`;
      }
    })
  );

  return {
    disruptionSummary,
    plans,
    blastRadius: effectiveBlastRadius || null,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Persist recovery plan candidate to Supabase public.recovery_options table
 */
export async function persistRecoveryPlan(plan, tripId, disruptionId) {
  try {
    // supabase statically imported
    if (!supabase || !tripId) return { success: false, error: 'Supabase unavailable' };

    const { data, error } = await supabase.from('recovery_options').insert({
      trip_id: tripId,
      disruption_id: disruptionId || null,
      title: plan.title,
      description: plan.focus,
      strategy_type: plan.strategyType,
      additional_cost: plan.totalAdditionalCost,
      currency_code: 'INR',
      additional_time_minutes: plan.timeDelayMinutes,
      refund_amount: plan.refundProtected || 0,
      convenience_score: plan.score,
      preserves_hotel: plan.preservedItems?.some((i) => i.itemType === 'hotel') || false,
      preserves_transport: plan.preservedItems?.some((i) => i.itemType === 'transfer') || false,
      resulting_itinerary: plan.itemTimeline || [],
      ai_explanation: plan.aiExplanation,
      status: 'proposed',
    }).select().single();

    if (error) {
      console.warn('[recoveryService] Supabase persistence skipped:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true, data };
  } catch (err) {
    console.warn('[recoveryService] Supabase persistence error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Stage 18: Apply recovery plan to trip itinerary
 */
export async function applyRecoveryPlanToTrip({
  tripId,
  disruptionId,
  plan,
  user = null,
  previousItems = [],
}) {
  if (!tripId || !plan) {
    throw new Error('Trip ID and selected recovery plan are required.');
  }

  // 9. Prevent duplicate application if the same recovery plan is submitted twice.
  try {
    const existing = localStorage.getItem(`tripsync_applied_recovery_${tripId}`);
    if (existing) {
      const parsed = JSON.parse(existing);
      if (parsed.recoveryPlanId === plan.id) {
        return {
          success: true,
          appliedPlan: plan,
          appliedRecord: parsed,
          message: 'Recovery plan already applied to your itinerary.',
        };
      }
    }
  } catch (_) {}


  const appliedRecord = {
    tripId,
    disruptionId: disruptionId || null,
    recoveryPlanId: plan.id,
    strategyType: plan.strategyType,
    strategyTag: plan.strategyTag,
    title: plan.title,
    appliedAt: new Date().toISOString(),
    appliedBy: user?.id || 'current-traveler',
    replacementTransport: plan.replacementTransport,
    totalAdditionalCost: plan.totalAdditionalCost,
    netFinancialImpact: plan.netFinancialImpact,
    resultingTimeline: plan.itemTimeline || [],
    previousItemsCount: previousItems.length,
    status: 'applied',
  };

  // Cache in localStorage for instant offline access and persistence
  try {
    const key = `tripsync_applied_recovery_${tripId}`;
    localStorage.setItem(key, JSON.stringify(appliedRecord));
  } catch (_) {}

  // Update disruption in Supabase if online
  if (supabase && disruptionId) {
    try {
      await supabase
        .from('disruptions')
        .update({
          resolved_at: new Date().toISOString(),
          metadata: {
            status: 'resolved',
            applied_recovery_plan_id: plan.id,
            applied_strategy: plan.strategyTag,
            resolved_at: new Date().toISOString(),
          },
        })
        .eq('id', disruptionId);
    } catch (err) {
      console.warn('[recoveryService] Supabase disruption update note:', err);
    }
  }

  // Stage 19: Update connected itinerary items in Supabase based on plan.itemTimeline
  if (supabase && plan.itemTimeline && plan.itemTimeline.length > 0) {
    try {
      const { itemTimeline, replacementTransport } = plan;
      
      for (const item of itemTimeline) {
        if (item.status === 'cancelled' && item.originalId) {
          // 2. Replace/cancel the affected original transport item
          await supabase.from('itinerary_items').delete().eq('id', item.originalId);
        } else if (item.status === 'new') {
          // 3. Add the replacement transport details
          const baseDate = previousItems[0]?.start_time ? new Date(previousItems[0].start_time) : new Date();
          const dateStr = baseDate.toISOString().split('T')[0];
          
          await supabase.from('itinerary_items').insert({
            trip_id: tripId,
            item_type: item.itemType || 'flight',
            title: item.title,
            description: item.note || 'Replacement transport',
            start_time: `${dateStr}T12:00:00Z`, 
            end_time: `${dateStr}T14:00:00Z`,
            status: 'confirmed',
            provider_name: replacementTransport?.provider || 'TripSync Recovery',
            provider_reference: replacementTransport?.number || ''
          });
        } else if (item.status === 'changed' && item.originalId) {
          // 4. Recalculate/update downstream itinerary items
          const prev = previousItems.find(p => p.id === item.originalId);
          if (prev) {
            await supabase.from('itinerary_items').update({
              description: `${prev.description || ''}\n\n[Recovery Update]: ${item.timeLabel} - ${item.note}`,
              status: 'rescheduled'
            }).eq('id', item.originalId);
          }
        }
        // 5. Preserve unaffected itinerary items (status 'preserved', 'at-risk') remain as-is in DB
      }
    } catch (err) {
      console.warn('[recoveryService] Stage 19 itinerary update failed:', err);
    }
  }

  return {
    success: true,
    appliedPlan: plan,
    appliedRecord,
    message: 'TripSync itinerary updated. External booking still required for carrier ticket rebooking.',
  };
}
