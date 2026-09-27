/**
 * itineraryService.js — Connected Itinerary Service for TripSync
 * Connects Trips, Stops, Bookings, Travelers, Documents into a unified chronological timeline.
 * Supports Stage 11 (Edit Journey) & Stage 12 (Risk / Disruption).
 * Loads 100% real data from Supabase.
 */

import { supabase } from './supabase.js';

const OFFLINE_DISRUPTIONS_KEY = 'tripsync_pending_disruptions';

/**
 * Safely parse JSON from trip description if present
 */
export function parseTripMetadata(description) {
  if (!description) return {};
  if (typeof description === 'object') return description;
  try {
    return JSON.parse(description);
  } catch (_) {
    return {};
  }
}

/**
 * Retrieve offline disruptions cached in localStorage
 */
export function getOfflineDisruptions(tripId = null) {
  try {
    const raw = localStorage.getItem(OFFLINE_DISRUPTIONS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return tripId ? list.filter((d) => d.trip_id === tripId) : list;
  } catch (_) {
    return [];
  }
}

/**
 * Save an offline disruption locally
 */
export function saveOfflineDisruption(disruption) {
  try {
    const existing = getOfflineDisruptions();
    const updated = [disruption, ...existing.filter((d) => d.id !== disruption.id)];
    localStorage.setItem(OFFLINE_DISRUPTIONS_KEY, JSON.stringify(updated));
  } catch (_) {}
}

/**
 * Remove an offline disruption by ID after successful sync
 */
export function removeOfflineDisruption(disruptionId) {
  try {
    const existing = getOfflineDisruptions();
    const filtered = existing.filter((d) => d.id !== disruptionId);
    localStorage.setItem(OFFLINE_DISRUPTIONS_KEY, JSON.stringify(filtered));
  } catch (_) {}
}

/**
 * Sync all pending offline disruptions to Supabase
 */
export async function syncPendingDisruptions() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return [];
  const pending = getOfflineDisruptions();
  if (pending.length === 0) return [];

  const syncedIds = [];
  for (const item of pending) {
    try {
      const { id, isOfflinePending, ...payload } = item;
      const { error } = await supabase.from('disruptions').insert(payload);
      if (!error) {
        removeOfflineDisruption(id);
        syncedIds.push(id);
      }
    } catch (e) {
      console.warn('Syncing offline disruption error:', e);
    }
  }
  return syncedIds;
}

// Auto-sync offline disruptions when coming back online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    syncPendingDisruptions();
  });
}

/**
 * Fetch complete connected trip data from Supabase:
 * - trips
 * - itinerary_items
 * - bookings
 * - trip_members
 * - documents
 * - disruptions
 */
export async function fetchTripItineraryData(tripId) {
  if (!tripId) {
    throw new Error('Trip ID is required to fetch itinerary.');
  }

  // 1. Fetch trip
  const { data: trip, error: tripErr } = await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .single();

  if (tripErr) throw tripErr;

  // 2. Fetch bookings
  const { data: bookings, error: bookingsErr } = await supabase
    .from('bookings')
    .select('*')
    .eq('trip_id', tripId)
    .order('departure_at', { ascending: true, nullsFirst: false });

  if (bookingsErr) {
    console.warn('Bookings fetch note:', bookingsErr.message);
  }

  // 3. Fetch itinerary_items
  const { data: itineraryItems, error: itemsErr } = await supabase
    .from('itinerary_items')
    .select('*')
    .eq('trip_id', tripId)
    .order('sequence_no', { ascending: true });

  if (itemsErr) {
    console.warn('Itinerary items fetch note:', itemsErr.message);
  }

  // 4. Fetch trip_members
  const { data: tripMembers, error: membersErr } = await supabase
    .from('trip_members')
    .select('id, trip_id, user_id, name, first_name, last_name, email, role, is_primary_traveler, joined_at')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true });

  if (membersErr) {
    console.warn('Trip members fetch note:', membersErr.message);
  }

  // 5. Fetch documents
  const { data: documents, error: docsErr } = await supabase
    .from('documents')
    .select('id, trip_id, document_type, file_name, storage_bucket, storage_path, is_available_offline, created_at')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false });

  if (docsErr) {
    console.warn('Documents fetch note:', docsErr.message);
  }

  // 6. Fetch disruptions
  const { data: disruptions, error: disrErr } = await supabase
    .from('disruptions')
    .select('*')
    .eq('trip_id', tripId)
    .order('detected_at', { ascending: false });

  if (disrErr) {
    console.warn('Disruptions fetch note:', disrErr.message);
  }

  // Merge any offline pending disruptions
  const offlineDisruptions = getOfflineDisruptions(tripId);
  const allDisruptions = [...offlineDisruptions, ...(disruptions || [])];

  return {
    trip,
    bookings: bookings || [],
    itineraryItems: itineraryItems || [],
    tripMembers: tripMembers || [],
    documents: documents || [],
    disruptions: allDisruptions,
  };
}

/**
 * Generate a secure, short-lived signed URL for accessing a document from Supabase Storage
 */
export async function getDocumentSignedUrl(storagePath, bucket = 'trip-documents', expiresInSeconds = 3600) {
  if (!storagePath) return null;
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(storagePath, expiresInSeconds);

    if (error) {
      console.warn('Could not generate signed URL:', error.message);
      return null;
    }
    return data?.signedUrl || null;
  } catch (err) {
    console.warn('Signed URL generation exception:', err);
    return null;
  }
}

/**
 * Format a time safely (e.g. "08:30 AM"). Returns null if no time is available.
 * Never invents fake times.
 */
export function formatTimeSafe(dateStrOrObj) {
  if (!dateStrOrObj) return null;
  const d = new Date(dateStrOrObj);
  if (Number.isNaN(d.getTime())) return null;

  if (typeof dateStrOrObj === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStrOrObj)) {
    return null;
  }

  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

/**
 * Format a date safely (e.g. "12 Sep 2026").
 */
export function formatDateSafe(dateStrOrObj) {
  if (!dateStrOrObj) return null;
  const d = new Date(dateStrOrObj);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Format short date (e.g. "12 Sep").
 */
export function formatShortDate(dateStrOrObj) {
  if (!dateStrOrObj) return null;
  const d = new Date(dateStrOrObj);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/**
 * Calculate connection relationship between two consecutive items
 */
export function computeConnection(current, next) {
  if (!current || !next) return null;

  const currentType = current.itemType || current.booking_type;
  const nextType = next.itemType || next.booking_type;

  const currentEnd = current.endDateTime ? new Date(current.endDateTime) : (current.startDateTime ? new Date(current.startDateTime) : null);
  const nextStart = next.startDateTime ? new Date(next.startDateTime) : null;

  let bufferText = null;
  if (currentEnd && nextStart && !Number.isNaN(currentEnd.getTime()) && !Number.isNaN(nextStart.getTime())) {
    const diffMinutes = Math.round((nextStart - currentEnd) / 60000);
    if (diffMinutes >= 0 && diffMinutes < 1440) {
      const hrs = Math.floor(diffMinutes / 60);
      const mins = diffMinutes % 60;
      bufferText = hrs > 0 ? `${hrs}h ${mins > 0 ? `${mins}m` : ''} gap`.trim() : `${mins}m gap`;
    }
  }

  if (currentType === 'flight' && (nextType === 'flight' || nextType === 'transfer' || nextType === 'cab' || nextType === 'train' || nextType === 'bus')) {
    return {
      type: 'layover',
      label: bufferText ? `Connected transfer (${bufferText})` : 'Connected transfer',
      sublabel: `${current.destination || current.location || ''} → ${next.origin || next.location || ''}`.trim(),
    };
  }

  if ((currentType === 'flight' || currentType === 'train' || currentType === 'bus' || currentType === 'transfer' || currentType === 'cab') && nextType === 'hotel') {
    return {
      type: 'arrival_checkin',
      label: bufferText ? `Arrival → Hotel Check-in (${bufferText})` : 'Arrival → Hotel Check-in',
      sublabel: `Proceed to ${next.title || next.provider_name || 'accommodation'}`,
    };
  }

  if (currentType === 'hotel' && nextType === 'activity') {
    return {
      type: 'stay_activity',
      label: bufferText ? `From hotel → Activity (${bufferText})` : 'From hotel → Activity',
      sublabel: `Scheduled: ${next.title || next.provider_name}`,
    };
  }

  if (currentType === 'activity' && nextType === 'activity') {
    return {
      type: 'next_activity',
      label: bufferText ? `Next activity (${bufferText})` : 'Next activity',
      sublabel: `${next.title || next.provider_name}`,
    };
  }

  if ((currentType === 'hotel' || currentType === 'activity') && (nextType === 'flight' || nextType === 'train' || nextType === 'bus' || nextType === 'transfer')) {
    return {
      type: 'checkout_transport',
      label: bufferText ? `Depart for next transport (${bufferText})` : 'Depart for next transport',
      sublabel: `Boarding ${next.title || next.provider_name || 'transport'}`,
    };
  }

  if (currentType === 'stop' && nextType === 'stop') {
    return {
      type: 'next_stop',
      label: 'Next destination on journey',
      sublabel: `${current.title} → ${next.title}`,
    };
  }

  return {
    type: 'connected_step',
    label: bufferText ? `Connected step (${bufferText})` : 'Next step in journey',
    sublabel: '',
  };
}

/**
 * Calculate factual risk severity based on disruption type and delay
 */
export function calculateRiskSeverity(disruptionType = '', delayMinutes = 0) {
  const typeLower = String(disruptionType).toLowerCase();
  const delayNum = parseInt(delayMinutes, 10) || 0;

  if (typeLower.includes('cancellation') || typeLower.includes('missed connection')) {
    return 'critical';
  }
  if (delayNum >= 180) {
    return 'critical';
  }
  if (delayNum >= 90 || typeLower.includes('road') || typeLower.includes('weather')) {
    return 'high';
  }
  if (delayNum >= 30 || typeLower.includes('hotel')) {
    return 'medium';
  }
  if (delayNum > 0 && delayNum < 30) {
    return 'low';
  }
  return 'medium';
}

/**
 * Builds a unified, chronological connected timeline
 */
export function buildConnectedItinerary({
  trip,
  bookings = [],
  itineraryItems = [],
  tripMembers = [],
  documents = [],
  disruptions = [],
}) {
  if (!trip) return { days: [], allItems: [], tripSummary: null };

  const metadata = parseTripMetadata(trip.description);
  const metadataStops = metadata.stops || [];

  const safeMembers = (tripMembers || []).map((m) => ({
    id: m.id,
    name: m.name || m.first_name || (m.email ? m.email.split('@')[0] : 'Traveler'),
    role: m.role || 'traveler',
    isPrimary: Boolean(m.is_primary_traveler || m.role === 'owner'),
    status: m.member_status || 'accepted',
  }));

  const docsByBookingId = new Map();
  const generalDocs = [];

  documents.forEach((d) => {
    // Documents table has trip_id but no booking_id — associate via trip only
    generalDocs.push(d);
  });

  const normalizedItems = [];

  // 1. Process Bookings
  bookings.forEach((b) => {
    const rawType = (b.booking_type || 'other').toLowerCase();
    const itemType = rawType === 'cab' || rawType === 'rental_car' ? 'transfer' : rawType;

    const startDt = b.departure_at ? new Date(b.departure_at) : null;
    const endDt = b.arrival_at ? new Date(b.arrival_at) : null;

    const validStart = startDt && !Number.isNaN(startDt.getTime()) ? startDt : null;
    const validEnd = endDt && !Number.isNaN(endDt.getTime()) ? endDt : null;

    const hasTime = Boolean(
      validStart &&
      b.departure_at &&
      b.departure_at.includes('T') &&
      !b.departure_at.endsWith('T00:00:00.000Z') &&
      !b.departure_at.endsWith('T00:00:00')
    );

    const itemDate = validStart
      ? validStart.toISOString().slice(0, 10)
      : (trip.start_at ? trip.start_at.slice(0, 10) : null);

    const attachedDocs = docsByBookingId.get(b.id) || [];
    const matchedDocs = [...attachedDocs];
    generalDocs.forEach((gd) => {
      const matchKey = (gd.doc_key || gd.title || '').toLowerCase();
      const provName = (b.provider_name || '').toLowerCase();
      if (matchKey.includes(b.id) || (provName && matchKey.includes(provName))) {
        if (!matchedDocs.some((d) => d.id === gd.id)) {
          matchedDocs.push(gd);
        }
      }
    });

    normalizedItems.push({
      id: `booking-${b.id}`,
      rawId: b.id,
      booking_id: b.id,
      source: 'booking',
      itemType,
      title: b.provider_name || (itemType === 'hotel' ? 'Hotel Booking' : `${itemType.toUpperCase()} Booking`),
      provider: b.provider_name,
      origin: b.origin_name || b.origin_code || null,
      destination: b.destination_name || b.destination_code || null,
      location: itemType === 'hotel' ? (b.destination_name || b.origin_name || trip.destination_city) : (b.destination_name || b.origin_name || null),
      startDateTime: validStart,
      endDateTime: validEnd,
      dateStr: itemDate,
      hasTime,
      startTimeStr: hasTime ? formatTimeSafe(validStart) : null,
      endTimeStr: validEnd ? formatTimeSafe(validEnd) : null,
      confirmationCode: b.confirmation_code || null,
      price: parseFloat(b.base_amount) || 0,
      currencyCode: b.currency_code || trip.currency_code || 'INR',
      status: b.status || 'confirmed',
      refundable: Boolean(b.refundable),
      cancellationDeadline: b.cancellation_deadline || null,
      notes: b.provider_metadata?.notes || null,
      metadata: b.provider_metadata || {},
      travelers: safeMembers,
      documents: matchedDocs,
      sequenceOrder: 10,
    });
  });

  // 2. Process Itinerary Items (Day Stops & Activities)
  const bookingIdsInItinerary = new Set(bookings.map((b) => b.id));

  itineraryItems.forEach((it, idx) => {
    if (it.booking_id && bookingIdsInItinerary.has(it.booking_id)) {
      return;
    }

    const rawType = (it.item_type || 'stop').toLowerCase();
    const itemType = rawType === 'cab' || rawType === 'rental_car' ? 'transfer' : rawType;

    const startDt = it.start_at ? new Date(it.start_at) : null;
    const endDt = it.end_at ? new Date(it.end_at) : null;

    const validStart = startDt && !Number.isNaN(startDt.getTime()) ? startDt : null;
    const validEnd = endDt && !Number.isNaN(endDt.getTime()) ? endDt : null;

    const dayNo = it.metadata?.day_number || idx + 1;

    let inferredDate = validStart ? validStart.toISOString().slice(0, 10) : null;
    if (!inferredDate && trip.start_at) {
      const tripStartDate = new Date(trip.start_at);
      if (!Number.isNaN(tripStartDate.getTime())) {
        const offsetDate = new Date(tripStartDate.getTime() + (dayNo - 1) * 86400000);
        inferredDate = offsetDate.toISOString().slice(0, 10);
      }
    }

    const hasTime = Boolean(
      validStart &&
      it.start_at &&
      it.start_at.includes('T') &&
      !it.start_at.endsWith('T00:00:00.000Z') &&
      !it.start_at.endsWith('T00:00:00')
    );

    normalizedItems.push({
      id: `itinerary-${it.id}`,
      rawId: it.id,
      booking_id: it.booking_id || null,
      source: 'itinerary_item',
      itemType,
      title: it.title || `Day ${dayNo} — ${it.origin_name || it.destination_name || 'Stop'}`,
      provider: it.title,
      origin: it.origin_name || null,
      destination: it.destination_name || null,
      location: it.address || it.destination_name || it.origin_name || it.metadata?.city || null,
      startDateTime: validStart,
      endDateTime: validEnd,
      dateStr: inferredDate,
      hasTime,
      startTimeStr: hasTime ? formatTimeSafe(validStart) : (it.metadata?.arrival ? String(it.metadata.arrival).slice(11, 16) : null),
      endTimeStr: validEnd ? formatTimeSafe(validEnd) : (it.metadata?.departure ? String(it.metadata.departure).slice(11, 16) : null),
      confirmationCode: null,
      price: 0,
      currencyCode: trip.currency_code || 'INR',
      status: it.status || 'safe',
      refundable: false,
      cancellationDeadline: null,
      notes: it.description || it.metadata?.activities || it.metadata?.notes || null,
      metadata: it.metadata || {},
      travelers: safeMembers,
      documents: [],
      sequenceOrder: it.sequence_no || idx + 1,
      dayNumber: dayNo,
    });
  });

  // 3. Fallback: If no itinerary_items existed in table, use metadata.stops from trip.description
  if (itineraryItems.length === 0 && metadataStops.length > 0) {
    metadataStops.forEach((s, idx) => {
      const dayNo = s.day_number || idx + 1;
      let inferredDate = null;
      if (trip.start_at) {
        const tripStartDate = new Date(trip.start_at);
        if (!Number.isNaN(tripStartDate.getTime())) {
          const offsetDate = new Date(tripStartDate.getTime() + (dayNo - 1) * 86400000);
          inferredDate = offsetDate.toISOString().slice(0, 10);
        }
      }

      const itemType = s.transport?.toLowerCase().includes('flight')
        ? 'flight'
        : s.transport?.toLowerCase().includes('train')
          ? 'train'
          : s.transport?.toLowerCase().includes('bus')
            ? 'bus'
            : 'stop';

      normalizedItems.push({
        id: `stop-${s.id || idx}`,
        rawId: s.id || `stop-${idx}`,
        booking_id: null,
        source: 'stop',
        itemType,
        title: s.title || s.city || `Day ${dayNo} — Destination`,
        provider: s.transport || null,
        origin: s.route?.split('→')[0]?.trim() || s.city || null,
        destination: s.route?.split('→')[1]?.trim() || s.city || null,
        location: s.city || null,
        startDateTime: null,
        endDateTime: null,
        dateStr: inferredDate,
        hasTime: false,
        startTimeStr: s.arrival ? String(s.arrival).slice(11, 16) : null,
        endTimeStr: s.departure ? String(s.departure).slice(11, 16) : null,
        confirmationCode: null,
        price: 0,
        currencyCode: trip.currency_code || 'INR',
        status: 'safe',
        refundable: false,
        cancellationDeadline: null,
        notes: s.activities || s.description || s.notes || null,
        metadata: s,
        travelers: safeMembers,
        documents: [],
        sequenceOrder: idx + 1,
        dayNumber: dayNo,
      });
    });
  }

  // 3.5. INTEGRATE APPLIED RECOVERY PLAN (STAGE 19)
  let appliedRecovery = null;
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(`tripsync_applied_recovery_${trip.id}`);
      if (stored) {
        appliedRecovery = JSON.parse(stored);
      }
    }
  } catch (_) {}

  if (appliedRecovery && appliedRecovery.resultingTimeline) {
    const { resultingTimeline, replacementTransport } = appliedRecovery;

    // Check if replacement transport item is already present
    const hasReplacement = normalizedItems.some((it) => it.isRecoveryReplacement);
    if (!hasReplacement && replacementTransport) {
      const repItem = {
        id: `recovery-replacement-${appliedRecovery.recoveryPlanId || 'plan'}`,
        rawId: `recovery-replacement-${appliedRecovery.recoveryPlanId || 'plan'}`,
        booking_id: null,
        source: 'recovery_plan',
        itemType: (replacementTransport.transport_type || 'flight').toLowerCase(),
        title: `${replacementTransport.airline || replacementTransport.provider || 'Replacement'} ${replacementTransport.flightNumber || replacementTransport.number || ''}`.trim(),
        provider: replacementTransport.airline || replacementTransport.provider || 'TripSync Recovery',
        origin: replacementTransport.origin || trip.origin_city || null,
        destination: replacementTransport.destination || trip.destination_city || null,
        location: replacementTransport.destination || trip.destination_city || null,
        dateStr: trip.start_at ? trip.start_at.slice(0, 10) : null,
        hasTime: Boolean(replacementTransport.departureTime),
        startTimeStr: replacementTransport.departureTime || null,
        endTimeStr: replacementTransport.arrivalTime || null,
        confirmationCode: replacementTransport.number || 'REC-SYNC',
        price: appliedRecovery.totalAdditionalCost || 0,
        currencyCode: trip.currency_code || 'INR',
        status: 'confirmed',
        isRecoveryReplacement: true,
        recoveryBadge: 'Active Replacement',
        recoveryStrategy: appliedRecovery.strategyTag,
        notes: `[Intelligent Recovery Applied]: ${appliedRecovery.title} (${appliedRecovery.strategyTag}). Seamlessly replaces disrupted booking.`,
        travelers: safeMembers,
        documents: [],
        sequenceOrder: 1,
        dayNumber: 1,
      };
      normalizedItems.push(repItem);
    }

    // Process statuses from resultingTimeline
    resultingTimeline.forEach((tItem) => {
      const matching = normalizedItems.find((ni) => 
        (tItem.originalId && (ni.rawId === tItem.originalId || ni.id === tItem.originalId || ni.booking_id === tItem.originalId)) ||
        (tItem.itemType && ni.itemType === tItem.itemType && (tItem.status === 'changed' || tItem.status === 'cancelled'))
      );

      if (matching) {
        if (tItem.status === 'cancelled') {
          matching.status = 'cancelled';
          matching.isRecoveryReplaced = true;
          matching.recoveryStatus = 'cancelled';
          matching.recoveryNote = 'Replaced by active recovery plan';
        } else if (tItem.status === 'changed') {
          matching.status = 'rescheduled';
          matching.isRecoveryRescheduled = true;
          matching.recoveryTimeLabel = tItem.timeLabel;
          matching.recoveryNote = tItem.note || 'Rescheduled buffer protected by TripSync';
        } else if (tItem.status === 'preserved' || tItem.status === 'safe') {
          matching.isRecoveryPreserved = true;
        }
      }
    });
  }

  // 4. CHRONOLOGICAL SORTING
  normalizedItems.sort((a, b) => {
    if (a.dateStr && b.dateStr && a.dateStr !== b.dateStr) {
      return a.dateStr.localeCompare(b.dateStr);
    }
    if (a.dateStr && !b.dateStr) return -1;
    if (!a.dateStr && b.dateStr) return 1;

    const aTimeVal = a.hasTime && a.startDateTime ? a.startDateTime.getTime() : null;
    const bTimeVal = b.hasTime && b.startDateTime ? b.startDateTime.getTime() : null;

    if (aTimeVal !== null && bTimeVal !== null) {
      if (aTimeVal !== bTimeVal) return aTimeVal - bTimeVal;
    }
    if (aTimeVal !== null && bTimeVal === null) return -1;
    if (aTimeVal === null && bTimeVal !== null) return 1;

    const aEndVal = a.endDateTime ? a.endDateTime.getTime() : null;
    const bEndVal = b.endDateTime ? b.endDateTime.getTime() : null;
    if (aEndVal !== null && bEndVal !== null && aEndVal !== bEndVal) {
      return aEndVal - bEndVal;
    }

    const typeRank = {
      flight: 1,
      train: 2,
      bus: 3,
      transfer: 4,
      stop: 5,
      hotel: 6,
      activity: 7,
      other: 8,
    };
    const rankDiff = (typeRank[a.itemType] || 5) - (typeRank[b.itemType] || 5);
    if (rankDiff !== 0) return rankDiff;

    return (a.sequenceOrder || 0) - (b.sequenceOrder || 0);
  });

  // 5. Connect Disruptions to Items (STAGE 12 INTEGRATION)
  const activeDisruptions = [];

  normalizedItems.forEach((item) => {
    // Find disruption targeting this item
    const matchingDisruption = disruptions.find((d) => {
      const meta = d.metadata || {};
      return (
        meta.affected_item_id === item.id ||
        meta.affected_item_id === item.rawId ||
        meta.affected_booking_id === item.rawId ||
        meta.affected_booking_id === item.booking_id ||
        meta.affected_itinerary_item_id === item.rawId ||
        (meta.affected_title && meta.affected_title === item.title)
      );
    });

    if (matchingDisruption) {
      item.disruption = matchingDisruption;
      item.isDisrupted = true;
      item.disruptionSeverity = matchingDisruption.severity || 'medium';
      item.disruptionType = matchingDisruption.metadata?.disruption_type || matchingDisruption.title || 'Disruption';
      item.disruptionStatus = matchingDisruption.metadata?.status || 'reported';
      item.disruptionDelayMinutes = matchingDisruption.metadata?.expected_delay_minutes || null;

      if (!matchingDisruption.resolved_at && item.disruptionStatus !== 'resolved' && item.disruptionStatus !== 'dismissed') {
        if (!activeDisruptions.some((ad) => ad.id === matchingDisruption.id)) {
          activeDisruptions.push(matchingDisruption);
        }
      }
    }
  });

  // Also collect any active disruption in `disruptions` that was not directly tied to a normalizedItem
  (disruptions || []).forEach((d) => {
    const meta = d.metadata || {};
    const isResolved = d.resolved_at || meta.status === 'resolved' || meta.status === 'dismissed' || d.status === 'resolved';
    if (!isResolved && !activeDisruptions.some((ad) => ad.id === d.id)) {
      activeDisruptions.push(d);
    }
  });

  // 6. Calculate Connection to Next Item
  for (let i = 0; i < normalizedItems.length; i++) {
    const current = normalizedItems[i];
    const next = i < normalizedItems.length - 1 ? normalizedItems[i + 1] : null;
    current.connectionToNext = computeConnection(current, next);
  }

  // 7. Group into Days
  const daysMap = new Map();

  normalizedItems.forEach((item) => {
    const key = item.dateStr || 'Flexible';
    if (!daysMap.has(key)) {
      daysMap.set(key, {
        dateStr: item.dateStr,
        formattedDate: item.dateStr ? formatDateSafe(item.dateStr) : 'Flexible Dates',
        shortDate: item.dateStr ? formatShortDate(item.dateStr) : 'TBD',
        dayNumber: item.dayNumber || (daysMap.size + 1),
        items: [],
      });
    }
    daysMap.get(key).items.push(item);
  });

  const days = Array.from(daysMap.values()).map((day, idx) => ({
    ...day,
    dayNumber: idx + 1,
  }));

  // Trip Summary Metadata
  const tripSummary = {
    id: trip.id,
    name: trip.name || trip.title,
    originCity: trip.origin_city || trip.origin || 'Origin',
    destinationCity: trip.destination_city || trip.destination || 'Destination',
    startAt: trip.start_at,
    endAt: trip.end_at,
    formattedDates: trip.start_at && trip.end_at
      ? `${formatDateSafe(trip.start_at)} – ${formatDateSafe(trip.end_at)}`
      : (trip.dates_label || 'Flexible dates'),
    status: trip.status || 'planned',
    travelersCount: safeMembers.length || trip.travelers_count || 1,
    travelers: safeMembers,
    documentsCount: documents.length,
    generalDocuments: generalDocs,
    totalBookings: bookings.length,
    totalItems: normalizedItems.length,
    currencyCode: trip.currency_code || 'INR',
    totalSpent: bookings.reduce((sum, b) => sum + (parseFloat(b.base_amount) || 0), 0),
    activeDisruptions,
    disruptionHistory: disruptions || [],
    hasDisruption: activeDisruptions.length > 0,
    appliedRecovery,
  };

  return {
    days,
    allItems: normalizedItems,
    tripSummary,
    generalDocuments: generalDocs,
    activeDisruptions,
    disruptionHistory: disruptions || [],
  };
}

/* =========================================================================
   STAGE 11 — EDIT JOURNEY SERVICE FUNCTIONS
   ========================================================================= */

/**
 * Persist updated stops & journey order into Supabase
 */
export async function updateTripJourney({ tripId, stops = [], itemsToDelete = [] }) {
  if (!tripId) throw new Error('Trip ID is required to update journey.');

  // 1. Fetch current trip to read description metadata
  const { data: trip, error: fetchErr } = await supabase
    .from('trips')
    .select('id, description, destination_city')
    .eq('id', tripId)
    .single();

  if (fetchErr) throw fetchErr;

  const currentMeta = parseTripMetadata(trip?.description);
  const updatedMeta = {
    ...currentMeta,
    stops: stops.map((s, idx) => ({
      ...s,
      day_number: s.day_number || idx + 1,
    })),
  };

  const updatedRoutes = stops.map((s) => s.city || s.route).filter(Boolean);
  if (updatedRoutes.length === 0 && trip.destination_city) {
    updatedRoutes.push(trip.destination_city);
  }

  // 2. Update trips description (store route in metadata only, no 'route' column in schema)
  const { error: tripUpdateErr } = await supabase
    .from('trips')
    .update({
      description: JSON.stringify(updatedMeta),
      updated_at: new Date().toISOString(),
    })
    .eq('id', tripId);

  if (tripUpdateErr) throw tripUpdateErr;

  // 3. Handle deletions from itinerary_items table
  if (itemsToDelete.length > 0) {
    const validUuidDeletes = itemsToDelete.filter(
      (id) => typeof id === 'string' && /^[0-9a-fA-F-]{36}$/.test(id)
    );
    if (validUuidDeletes.length > 0) {
      const { error: delErr } = await supabase
        .from('itinerary_items')
        .delete()
        .eq('trip_id', tripId)
        .in('id', validUuidDeletes);

      if (delErr) console.warn('Itinerary items deletion warning:', delErr.message);
    }
  }

  // 4. Update / Re-insert itinerary_items in Supabase
  // Strategy: delete all non-booking-linked items, then re-insert to avoid unique(trip_id,sequence_no) conflicts
  const validStops = stops.filter((s) => (s.city || s.title || '').trim());

  if (validStops.length > 0) {
    try {
      // Delete all non-booking itinerary items for this trip to avoid sequence_no conflicts
      await supabase
        .from('itinerary_items')
        .delete()
        .eq('trip_id', tripId)
        .is('booking_id', null);

      // Re-insert all stops as fresh rows
      const newRows = validStops.map((s, idx) => {
        const seq = idx + 1;
        const itemType = s.transport?.toLowerCase().includes('flight')
          ? 'flight'
          : s.transport?.toLowerCase().includes('train')
            ? 'train'
            : s.transport?.toLowerCase().includes('bus')
              ? 'bus'
              : 'stop';

        const row = {
          trip_id: tripId,
          sequence_no: seq,
          title: s.title || s.city || `Day ${s.day_number || seq}`,
          item_type: itemType,
          description: s.description || s.notes || s.activities || '',
          address: s.city || trip.destination_city || '',
          status: 'safe',
          metadata: {
            day_number: s.day_number || seq,
            city: s.city || '',
            route: s.route || '',
            transport: s.transport || '',
            activities: s.activities || '',
            arrival: s.arrival || '',
            departure: s.departure || '',
            notes: s.notes || '',
          },
        };

        if (s.start_at) row.start_at = new Date(s.start_at).toISOString();
        if (s.end_at) row.end_at = new Date(s.end_at).toISOString();

        return row;
      });

      const { error: insertErr } = await supabase.from('itinerary_items').insert(newRows);
      if (insertErr) console.warn('Itinerary items re-insert warning:', insertErr.message);
    } catch (itinErr) {
      console.warn('Itinerary items persistence note:', itinErr.message);
    }
  }

  return { success: true };
}

/* =========================================================================
   STAGE 12 — RISK / DISRUPTION SERVICE FUNCTIONS
   ========================================================================= */

/**
 * Report a new travel disruption
 */
export async function reportDisruption({
  tripId,
  affectedItemId,
  affectedBookingId = null,
  affectedTitle = '',
  disruptionType = 'Other',
  description = '',
  expectedDelayMinutes = 0,
  occurredAt = null,
  severity = null,
  documentFile = null,
  userId = null,
}) {
  if (!tripId) throw new Error('Trip ID is required to report disruption.');
  if (!affectedTitle) throw new Error('Affected journey item is required.');

  const delayNum = parseInt(expectedDelayMinutes, 10) || 0;
  const calculatedSeverity = severity || calculateRiskSeverity(disruptionType, delayNum);
  const detectedAt = new Date().toISOString();
  const issueOccurredAt = occurredAt ? new Date(occurredAt).toISOString() : detectedAt;

  // Handle document attachment if provided
  let documentStoragePath = null;
  let documentName = null;

  if (documentFile) {
    try {
      const cleanFileName = documentFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      documentStoragePath = `${tripId}/disruptions/${Date.now()}_${cleanFileName}`;
      documentName = documentFile.name;

      const { error: upErr } = await supabase.storage
        .from('trip-documents')
        .upload(documentStoragePath, documentFile, {
          contentType: documentFile.type || 'application/pdf',
          upsert: true,
        });

      if (upErr) console.warn('Disruption document upload warning:', upErr.message);
    } catch (docErr) {
      console.warn('Disruption document upload note:', docErr);
    }
  }

  const disruptionRecord = {
    trip_id: tripId,
    title: `${disruptionType} — ${affectedTitle}`,
    description: description || `Reported ${disruptionType} for ${affectedTitle}`,
    severity: calculatedSeverity,
    detected_at: detectedAt,
    resolved_at: null,
    metadata: {
      affected_item_id: affectedItemId,
      affected_booking_id: affectedBookingId,
      affected_title: affectedTitle,
      disruption_type: disruptionType,
      status: 'reported',
      expected_delay_minutes: delayNum,
      occurred_at: issueOccurredAt,
      document_storage_path: documentStoragePath,
      document_name: documentName,
      reported_by: userId,
    },
  };

  // If user is offline, save to pending offline disruptions
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const offlineId = `off-disr-${Date.now()}`;
    const offlineItem = {
      ...disruptionRecord,
      id: offlineId,
      isOfflinePending: true,
    };
    saveOfflineDisruption(offlineItem);
    return { success: true, offline: true, disruption: offlineItem };
  }

  // Insert into Supabase disruptions table
  try {
    const { data: inserted, error: insErr } = await supabase
      .from('disruptions')
      .insert(disruptionRecord)
      .select()
      .single();

    if (insErr) {
      console.warn('Failed to insert disruption into Supabase, saving offline fallback:', insErr.message);
      const offlineId = `off-disr-${Date.now()}`;
      const offlineItem = {
        ...disruptionRecord,
        id: offlineId,
        isOfflinePending: true,
      };
      saveOfflineDisruption(offlineItem);
      return { success: true, offline: true, disruption: offlineItem };
    }

    // If affectedItemId is a valid UUID, also insert into disruption_impacts table
    if (affectedItemId && /^[0-9a-fA-F-]{36}$/.test(affectedItemId)) {
      try {
        await supabase.from('disruption_impacts').insert({
          disruption_id: inserted.id,
          itinerary_item_id: affectedItemId,
          status: 'reported',
          delay_minutes: delayNum,
          reason: description || disruptionType,
        });
      } catch (impactErr) {
        console.warn('Disruption impact insert note:', impactErr.message);
      }
    }

    return { success: true, disruption: inserted };
  } catch (err) {
    console.warn('Network or database exception reporting disruption, saving offline fallback:', err);
    const offlineId = `off-disr-${Date.now()}`;
    const offlineItem = {
      ...disruptionRecord,
      id: offlineId,
      isOfflinePending: true,
    };
    saveOfflineDisruption(offlineItem);
    return { success: true, offline: true, disruption: offlineItem };
  }
}

/**
 * Fetch disruption history for a trip
 */
export async function fetchTripDisruptions(tripId) {
  if (!tripId) return [];

  try {
    const { data, error } = await supabase
      .from('disruptions')
      .select('*')
      .eq('trip_id', tripId)
      .order('detected_at', { ascending: false });

    if (error) throw error;

    const offline = getOfflineDisruptions(tripId);
    return [...offline, ...(data || [])];
  } catch (err) {
    console.warn('Error fetching disruptions:', err.message);
    return getOfflineDisruptions(tripId);
  }
}
