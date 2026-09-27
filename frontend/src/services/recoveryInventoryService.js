/**
 * recoveryInventoryService.js — TripSync Stage 13 Alternative Inventory Provider
 * Clean abstraction for replacement transport candidates (flights, transfers, trains).
 *
 * NOTE: For MVP / Hackathon, returns controlled deterministic inventory candidates
 * clearly marked as estimated/demo. Can be swapped with live GDS/Amadeus/Skyscanner API
 * without modifying the recovery engine.
 */

// Controlled realistic alternative transport candidates
const DEMO_FLIGHT_CATALOG = [
  {
    id: 'alt-flt-indigo-204',
    carrier: 'IndiGo',
    flightNumber: '6E-204',
    route: 'BOM → DEL',
    origin: 'BOM',
    originName: 'Mumbai (BOM)',
    destination: 'DEL',
    destinationName: 'Delhi (DEL) T3',
    timeOffsetHours: 2.5, // 2h 30m after original
    durationMinutes: 135,
    additionalCost: 2400,
    currency: 'INR',
    transportType: 'flight',
    strategyAffinity: 'earliest-arrival',
    availabilityNotice: 'Estimated · Availability requires confirmation',
    isEstimated: true,
    reliabilityScore: 94,
  },
  {
    id: 'alt-flt-vistara-945',
    carrier: 'Air India / Vistara',
    flightNumber: 'AI-2945',
    route: 'BOM → DEL',
    origin: 'BOM',
    originName: 'Mumbai (BOM)',
    destination: 'DEL',
    destinationName: 'Delhi (DEL) T3',
    timeOffsetHours: 4.5, // 4h 30m after original (free rebooking waiver eligible)
    durationMinutes: 130,
    additionalCost: 0, // Airline waiver / zero extra fare
    currency: 'INR',
    transportType: 'flight',
    strategyAffinity: 'lowest-cost',
    availabilityNotice: 'Estimated · Airline rebooking waiver eligible',
    isEstimated: true,
    reliabilityScore: 89,
  },
  {
    id: 'alt-flt-spicejet-8169',
    carrier: 'SpiceJet',
    flightNumber: 'SG-8169',
    route: 'BOM → DEL',
    origin: 'BOM',
    originName: 'Mumbai (BOM)',
    destination: 'DEL',
    destinationName: 'Delhi (DEL) T1',
    timeOffsetHours: 3.5,
    durationMinutes: 140,
    additionalCost: 1100,
    currency: 'INR',
    transportType: 'flight',
    strategyAffinity: 'minimum-disruption',
    availabilityNotice: 'Estimated · Economy seat available',
    isEstimated: true,
    reliabilityScore: 86,
  },
];

/**
 * Find alternative transport candidates for a disrupted segment.
 *
 * @param {Object} query
 * @param {string} query.origin - e.g. "BOM" or "Mumbai"
 * @param {string} query.destination - e.g. "DEL" or "Delhi"
 * @param {Date|string} query.originalDepartureTime - Original scheduled departure
 * @param {string} [query.transportType='flight'] - 'flight', 'train', 'bus'
 * @returns {Promise<Array>} List of alternative transport options
 */
export async function findAlternativeTransport({
  origin = 'Mumbai',
  destination = 'Delhi',
  originalDepartureTime = null,
  transportType = 'flight',
}) {
  const baseTime = originalDepartureTime ? new Date(originalDepartureTime) : new Date();
  const validBase = !Number.isNaN(baseTime.getTime()) ? baseTime : new Date();

  // Map catalog candidates with dynamic dates/times based on the actual disrupted segment
  const candidates = DEMO_FLIGHT_CATALOG.map((item) => {
    const departureDate = new Date(validBase.getTime() + item.timeOffsetHours * 3600 * 1000);
    const arrivalDate = new Date(departureDate.getTime() + item.durationMinutes * 60 * 1000);

    return {
      ...item,
      origin: origin || item.origin,
      destination: destination || item.destination,
      departureTime: departureDate.toISOString(),
      arrivalTime: arrivalDate.toISOString(),
      departureTimeFormatted: departureDate.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }),
      arrivalTimeFormatted: arrivalDate.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }),
      dateStr: departureDate.toISOString().slice(0, 10),
      source: 'demo_inventory',
    };
  });

  return candidates;
}

/**
 * Query alternative airport ground transfer candidates.
 */
export async function findAlternativeTransfers({
  pickupLocation = 'Delhi Airport T3',
  dropoffLocation = 'Manali',
  readyTime = null,
  estimatedRouteDurationMinutes = 390, // from OpenRouteService
}) {
  const pickupDate = readyTime ? new Date(readyTime) : new Date();
  const validPickup = !Number.isNaN(pickupDate.getTime()) ? pickupDate : new Date();

  // Buffer: 30 minutes after flight arrival for baggage & exit
  const transferDepart = new Date(validPickup.getTime() + 30 * 60 * 1000);
  const transferArrive = new Date(transferDepart.getTime() + estimatedRouteDurationMinutes * 60 * 1000);

  return [
    {
      id: 'alt-tr-intercity-cab',
      provider: 'Pre-booked Intercity Sedan',
      pickupLocation,
      dropoffLocation,
      departureTime: transferDepart.toISOString(),
      arrivalTime: transferArrive.toISOString(),
      durationMinutes: estimatedRouteDurationMinutes,
      estimatedCost: 2800,
      currency: 'INR',
      isEstimated: true,
      availabilityNotice: 'Dedicated driver · flexible departure window',
    },
    {
      id: 'alt-tr-volvo-bus',
      provider: 'Himachal Express Semi-Sleeper',
      pickupLocation: 'ISBT Kashmiri Gate, Delhi',
      dropoffLocation,
      departureTime: new Date(validPickup.getTime() + 120 * 60 * 1000).toISOString(),
      arrivalTime: new Date(validPickup.getTime() + (estimatedRouteDurationMinutes + 120) * 60 * 1000).toISOString(),
      durationMinutes: estimatedRouteDurationMinutes + 60,
      estimatedCost: 1400,
      currency: 'INR',
      isEstimated: true,
      availabilityNotice: 'Scheduled departure · requires metro to ISBT',
    },
  ];
}
