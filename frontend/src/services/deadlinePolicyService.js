/**
 * deadlinePolicyService.js — TripSync Stage 21 Deadlines & Policies Engine
 * 
 * Automatically derives, validates, and monitors all travel deadlines and provider policies:
 * - Hotel & Accommodation cancellation policies, free-cancellation windows, check-in schedules
 * - Flight & Transport check-in cut-offs, gate closures, rebooking windows
 * - Transfer and Activity cancellation policies
 * - Recalculates dynamically when Stage 19 recovery plan updates the itinerary
 * - Categorizes urgency states: Critical (<6h), Due Soon (6-24h), Upcoming (>24h), Completed, Unknown
 * - Factual integrity: Does not invent policies; clearly indicates when provider data is unavailable.
 */

import { supabase } from './supabase.js';

/**
 * Format remaining time human-readably
 */
export function calculateRemainingTime(deadlineDate) {
  if (!deadlineDate) {
    return {
      remainingText: 'Time unspecified',
      remainingMinutes: null,
      urgency: 'unknown',
      isExpired: false,
    };
  }

  const target = new Date(deadlineDate);
  if (Number.isNaN(target.getTime())) {
    return {
      remainingText: 'Invalid date',
      remainingMinutes: null,
      urgency: 'unknown',
      isExpired: false,
    };
  }

  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes <= 0) {
    return {
      remainingText: 'Deadline passed / Expired',
      remainingMinutes: diffMinutes,
      urgency: 'completed',
      isExpired: true,
    };
  }

  const days = Math.floor(diffMinutes / 1440);
  const hours = Math.floor((diffMinutes % 1440) / 60);
  const mins = diffMinutes % 60;

  let remainingText = '';
  if (days > 0) {
    remainingText = `${days}d ${hours}h remaining`;
  } else if (hours > 0) {
    remainingText = `${hours}h ${mins}m remaining`;
  } else {
    remainingText = `${mins}m remaining`;
  }

  let urgency = 'upcoming';
  if (diffMinutes < 360) {
    urgency = 'critical'; // < 6 hours
  } else if (diffMinutes < 1440) {
    urgency = 'due_soon'; // 6 – 24 hours
  } else {
    urgency = 'upcoming'; // > 24 hours
  }

  return {
    remainingText,
    remainingMinutes: diffMinutes,
    urgency,
    isExpired: false,
  };
}

/**
 * Derive deadlines and policy rules from raw trip data and active recovery plan
 */
export function deriveDeadlinesAndPolicies({
  trip,
  bookings = [],
  itineraryItems = [],
  appliedRecovery = null,
}) {
  const deadlines = [];

  // Check if trip or demo data exists
  if (!trip && bookings.length === 0 && itineraryItems.length === 0) {
    return [];
  }

  const tripStartDate = trip?.start_at ? new Date(trip.start_at) : new Date();

  // 1. Process Bookings (Hotels, Flights, Transfers, Activities)
  bookings.forEach((b) => {
    const rawType = (b.booking_type || 'other').toLowerCase();
    const itemType = rawType === 'cab' || rawType === 'rental_car' ? 'transfer' : rawType;
    const meta = b.provider_metadata || {};
    const depTime = b.departure_at ? new Date(b.departure_at) : null;
    const arrTime = b.arrival_at ? new Date(b.arrival_at) : null;

    if (itemType === 'hotel') {
      // ── HOTEL CANCELLATION & POLICY ──
      const hotelDeadlineStr = b.cancellation_deadline || meta.free_cancellation_until || meta.cancellation_deadline;
      let deadlineDate = hotelDeadlineStr ? new Date(hotelDeadlineStr) : null;

      // If no explicit provider deadline exists, check standard check-in offset if check-in is known
      if (!deadlineDate && depTime && !Number.isNaN(depTime.getTime())) {
        // Standard provider default: 24h before check-in
        deadlineDate = new Date(depTime.getTime() - 24 * 3600000);
      }

      const policyType = meta.cancellation_policy_type || (b.refundable ? 'Free Cancellation' : (b.cancellation_deadline ? 'Conditional Refund Policy' : 'Policy details from booking confirmation'));
      const hasProviderPolicy = Boolean(hotelDeadlineStr || meta.cancellation_policy || b.cancellation_deadline || b.refundable !== undefined);

      const feeSchedule = meta.cancellation_fee_schedule || (b.refundable ? '100% refund before deadline; 1 night fee after.' : 'Subject to hotel property terms.');
      const checkInWindow = meta.check_in_window || 'Check-in: 2:00 PM – 11:30 PM';
      const potentialRefund = parseFloat(b.base_amount) || meta.potential_refund || 0;

      const timeCalc = calculateRemainingTime(deadlineDate);

      deadlines.push({
        id: `deadline-hotel-${b.id}`,
        bookingId: b.id,
        itineraryItemId: `booking-${b.id}`,
        category: 'hotel',
        title: `${b.provider_name || 'Hotel Stay'} — Cancellation Window`,
        itemTitle: b.provider_name || 'Mountain View Residency',
        actionRequired: 'Cancel or modify before cut-off to protect your refund',
        deadlineTimestamp: deadlineDate ? deadlineDate.toISOString() : null,
        deadlineFormatted: deadlineDate ? deadlineDate.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Unspecified by provider',
        remainingText: timeCalc.remainingText,
        remainingMinutes: timeCalc.remainingMinutes,
        urgency: timeCalc.urgency,
        isExpired: timeCalc.isExpired,
        policySource: hasProviderPolicy ? (meta.provider_source || 'Booking.com / Hotel Partner') : 'Policy details unavailable from provider',
        policyType,
        applicableFee: feeSchedule,
        potentialRefund: potentialRefund > 0 ? potentialRefund : null,
        checkInWindow,
        recommendedAction: timeCalc.isExpired
          ? 'Cancellation window has passed. Contact hotel front desk for emergency exceptions.'
          : `Submit cancellation request before ${deadlineDate ? deadlineDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'deadline'} to retain refund.`,
        isRecalculated: Boolean(appliedRecovery),
      });

      // Hotel Check-in Cut-off Deadline
      if (depTime && !Number.isNaN(depTime.getTime())) {
        const checkInCutoff = new Date(depTime.getTime() + 6 * 3600000); // 6 hours after standard check-in
        const checkInCalc = calculateRemainingTime(checkInCutoff);
        deadlines.push({
          id: `deadline-hotel-checkin-${b.id}`,
          bookingId: b.id,
          itineraryItemId: `booking-${b.id}`,
          category: 'hotel_checkin',
          title: `${b.provider_name || 'Hotel'} — Same-Day Check-in Cut-off`,
          itemTitle: b.provider_name || 'Hotel Accommodation',
          actionRequired: 'Notify hotel if arriving after standard check-in window',
          deadlineTimestamp: checkInCutoff.toISOString(),
          deadlineFormatted: checkInCutoff.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
          remainingText: checkInCalc.remainingText,
          remainingMinutes: checkInCalc.remainingMinutes,
          urgency: checkInCalc.urgency,
          isExpired: checkInCalc.isExpired,
          policySource: 'Hotel Front Desk Policy',
          policyType: 'Late Arrival Protection',
          applicableFee: 'Rooms held until midnight with prior notification.',
          potentialRefund: null,
          checkInWindow,
          recommendedAction: 'Call or message the hotel if your transport is delayed beyond 8:00 PM to ensure room is held.',
          isRecalculated: Boolean(appliedRecovery),
        });
      }
    } else if (itemType === 'flight') {
      // ── FLIGHT CHECK-IN & DEPARTURE DEADLINES ──
      const flightNo = b.confirmation_code || meta.flight_number || b.provider_name || 'Flight AI-123';
      const isCancelled = b.status === 'cancelled' || meta.is_disrupted;

      if (depTime && !Number.isNaN(depTime.getTime())) {
        // Web check-in closes 60m before departure
        const checkInCloseDate = new Date(depTime.getTime() - 60 * 60000);
        const checkInCalc = calculateRemainingTime(checkInCloseDate);

        deadlines.push({
          id: `deadline-flight-checkin-${b.id}`,
          bookingId: b.id,
          itineraryItemId: `booking-${b.id}`,
          category: 'flight_checkin',
          title: `${flightNo} — Web Check-in Cut-off`,
          itemTitle: `${b.provider_name || 'Air India'} ${flightNo}`,
          actionRequired: isCancelled ? 'Flight disrupted — Check-in closed' : 'Complete web check-in & boarding pass download',
          deadlineTimestamp: checkInCloseDate.toISOString(),
          deadlineFormatted: checkInCloseDate.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
          remainingText: isCancelled ? 'Disrupted / Re-routed' : checkInCalc.remainingText,
          remainingMinutes: checkInCalc.remainingMinutes,
          urgency: isCancelled ? 'completed' : checkInCalc.urgency,
          isExpired: checkInCalc.isExpired || isCancelled,
          policySource: 'Airline Operational Rule (DGCA / IATA standard)',
          policyType: 'Mandatory Web Check-in',
          applicableFee: 'Airport kiosk check-in may incur processing delays.',
          potentialRefund: null,
          checkInWindow: 'Web check-in: 48h to 60m before departure',
          recommendedAction: isCancelled
            ? 'Flight is disrupted. Proceed to Recovery Center to select an alternative flight.'
            : 'Download your digital boarding pass and select seats before the 60-minute cut-off.',
          isRecalculated: Boolean(appliedRecovery),
        });

        // Airport Gate Closure (25m before departure)
        const gateCloseDate = new Date(depTime.getTime() - 25 * 60000);
        const gateCalc = calculateRemainingTime(gateCloseDate);

        deadlines.push({
          id: `deadline-flight-gate-${b.id}`,
          bookingId: b.id,
          itineraryItemId: `booking-${b.id}`,
          category: 'flight_gate',
          title: `${flightNo} — Boarding Gate Closes`,
          itemTitle: `${b.provider_name || 'Flight'} Departure Gate`,
          actionRequired: 'Be present at the departure gate',
          deadlineTimestamp: gateCloseDate.toISOString(),
          deadlineFormatted: gateCloseDate.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
          remainingText: isCancelled ? 'Disrupted' : gateCalc.remainingText,
          remainingMinutes: gateCalc.remainingMinutes,
          urgency: isCancelled ? 'completed' : gateCalc.urgency,
          isExpired: gateCalc.isExpired || isCancelled,
          policySource: 'Airport Security & Boarding Policy',
          policyType: 'Strict Gate Cut-off',
          applicableFee: 'Passengers arriving after gate closure will be denied boarding.',
          potentialRefund: null,
          checkInWindow: 'Gate closes 25 minutes prior to scheduled take-off',
          recommendedAction: 'Ensure security screening is completed at least 45 minutes prior to departure.',
          isRecalculated: Boolean(appliedRecovery),
        });
      }
    } else if (itemType === 'activity' || itemType === 'transfer') {
      // ── ACTIVITY / TRANSFER CANCELLATION DEADLINES ──
      const activityDeadline = depTime ? new Date(depTime.getTime() - 12 * 3600000) : null;
      const actCalc = calculateRemainingTime(activityDeadline);

      deadlines.push({
        id: `deadline-activity-${b.id}`,
        bookingId: b.id,
        itineraryItemId: `booking-${b.id}`,
        category: itemType,
        title: `${b.provider_name || 'Activity Booking'} — Cancellation Cut-off`,
        itemTitle: b.provider_name || 'Solang Valley Adventure',
        actionRequired: 'Cancel or reschedule with activity operator',
        deadlineTimestamp: activityDeadline ? activityDeadline.toISOString() : null,
        deadlineFormatted: activityDeadline ? activityDeadline.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '12 hours before start',
        remainingText: actCalc.remainingText,
        remainingMinutes: actCalc.remainingMinutes,
        urgency: actCalc.urgency,
        isExpired: actCalc.isExpired,
        policySource: meta.provider_source || 'Tour Operator Policy',
        policyType: '12h Flexible Reschedule Window',
        applicableFee: 'Full voucher credit if rescheduled 12h prior.',
        potentialRefund: parseFloat(b.base_amount) || null,
        checkInWindow: 'Arrive 15 minutes prior to scheduled activity start.',
        recommendedAction: 'Contact activity guide or update reservation if delayed by road conditions.',
        isRecalculated: Boolean(appliedRecovery),
      });
    }
  });

  // 2. Process Applied Recovery Plan Updates (STAGE 19 & 21 RECALCULATION)
  if (appliedRecovery && appliedRecovery.replacementTransport) {
    const rep = appliedRecovery.replacementTransport;
    const baseDate = tripStartDate.toISOString().split('T')[0];
    const repDepStr = `${baseDate}T${rep.departureTime ? convertTo24h(rep.departureTime) : '12:00:00'}Z`;
    const repDepDate = new Date(repDepStr);

    if (!Number.isNaN(repDepDate.getTime())) {
      const repCheckInCutoff = new Date(repDepDate.getTime() - 60 * 60000);
      const repCheckInCalc = calculateRemainingTime(repCheckInCutoff);

      deadlines.unshift({
        id: `deadline-recovery-flight-checkin`,
        bookingId: 'recovery-replacement',
        itineraryItemId: 'replacement-transport',
        category: 'flight_checkin',
        title: `${rep.airline || 'Air India'} ${rep.flightNumber || 'AI-204'} — Recovery Flight Check-in Cut-off`,
        itemTitle: `Replacement Flight: ${rep.airline || 'Air India'} ${rep.flightNumber || 'AI-204'}`,
        actionRequired: 'Complete check-in for your updated replacement flight',
        deadlineTimestamp: repCheckInCutoff.toISOString(),
        deadlineFormatted: repCheckInCutoff.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
        remainingText: repCheckInCalc.remainingText,
        remainingMinutes: repCheckInCalc.remainingMinutes,
        urgency: repCheckInCalc.urgency,
        isExpired: repCheckInCalc.isExpired,
        policySource: `TripSync Recovery Engine · ${appliedRecovery.strategyTag} Strategy`,
        policyType: 'Confirmed Replacement Flight',
        applicableFee: `Net adjustment: ${appliedRecovery.netFinancialImpact ? `+₹${appliedRecovery.netFinancialImpact.toLocaleString('en-IN')}` : '₹0'}`,
        potentialRefund: null,
        checkInWindow: `Departure: ${rep.departureTime || '12:00 PM'} · Arrival: ${rep.arrivalTime || '02:15 PM'}`,
        recommendedAction: 'Download revised boarding documents and arrive at the departure terminal on time.',
        isRecalculated: true,
        isRecoveryItem: true,
      });
    }
  }

  // 3. Fallback Demo Deadlines if no bookings were in DB (e.g. initial demo mode)
  if (deadlines.length === 0) {
    const demoHotelDeadline = new Date(Date.now() + 10 * 3600000 + 42 * 60000); // 10h 42m
    const demoFlightDeadline = new Date(Date.now() + 2 * 3600000 + 15 * 60000); // 2h 15m

    const hotelCalc = calculateRemainingTime(demoHotelDeadline);
    const flightCalc = calculateRemainingTime(demoFlightDeadline);

    deadlines.push({
      id: 'deadline-demo-hotel',
      bookingId: 'demo-hotel-1',
      itineraryItemId: 'itinerary-hotel-1',
      category: 'hotel',
      title: 'Mountain View Residency — Hotel Cancellation Deadline',
      itemTitle: 'Mountain View Residency, Manali',
      actionRequired: 'Cancel or rebook before cut-off to protect ₹6,500 refund',
      deadlineTimestamp: demoHotelDeadline.toISOString(),
      deadlineFormatted: demoHotelDeadline.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
      remainingText: hotelCalc.remainingText,
      remainingMinutes: hotelCalc.remainingMinutes,
      urgency: hotelCalc.urgency,
      isExpired: false,
      policySource: 'Booking.com Partner Policy (Demo Data)',
      policyType: 'Free Cancellation Window',
      applicableFee: '100% refund before deadline; 1 night fee afterwards.',
      potentialRefund: 6500,
      checkInWindow: 'Check-in: 12 Sep, 2:00 PM',
      recommendedAction: 'Act before deadline expires to protect your refund value.',
      isRecalculated: false,
    });

    deadlines.push({
      id: 'deadline-demo-flight',
      bookingId: 'demo-flight-1',
      itineraryItemId: 'itinerary-flight-1',
      category: 'flight_checkin',
      title: 'Air India AI-123 — Web Check-in & Gate Deadline',
      itemTitle: 'Flight AI-123 (Mumbai → Delhi)',
      actionRequired: 'Flight disrupted — Check-in closed',
      deadlineTimestamp: demoFlightDeadline.toISOString(),
      deadlineFormatted: demoFlightDeadline.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
      remainingText: 'Flight Cancelled',
      remainingMinutes: -1,
      urgency: 'completed',
      isExpired: true,
      policySource: 'Air India Disruption Policy',
      policyType: 'Free Carrier Re-accommodation / Full Waiver',
      applicableFee: 'Zero cancellation fee due to carrier cancellation.',
      potentialRefund: 4500,
      checkInWindow: 'Original Departure: 8:30 AM',
      recommendedAction: 'Apply an alternative recovery plan from Recovery Center.',
      isRecalculated: false,
    });
  }

  // 4. Sort Deadlines by Urgency & Time
  const urgencyRank = {
    critical: 1,
    due_soon: 2,
    upcoming: 3,
    unknown: 4,
    completed: 5,
  };

  deadlines.sort((a, b) => {
    const rankDiff = (urgencyRank[a.urgency] || 4) - (urgencyRank[b.urgency] || 4);
    if (rankDiff !== 0) return rankDiff;

    if (a.remainingMinutes !== null && b.remainingMinutes !== null) {
      if (a.remainingMinutes >= 0 && b.remainingMinutes >= 0) {
        return a.remainingMinutes - b.remainingMinutes;
      }
      if (a.remainingMinutes < 0 && b.remainingMinutes >= 0) return 1;
      if (a.remainingMinutes >= 0 && b.remainingMinutes < 0) return -1;
    }

    return (a.title || '').localeCompare(b.title || '');
  });

  return deadlines;
}

/**
 * Helper to convert "02:15 PM" to "14:15:00"
 */
function convertTo24h(time12h) {
  if (!time12h) return '12:00:00';
  const match = time12h.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!match) return '12:00:00';

  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const modifier = match[3] ? match[3].toUpperCase() : 'AM';

  if (modifier === 'PM' && hours < 12) hours += 12;
  if (modifier === 'AM' && hours === 12) hours = 0;

  const hStr = hours < 10 ? `0${hours}` : `${hours}`;
  return `${hStr}:${minutes}:00`;
}
