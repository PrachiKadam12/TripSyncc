/**
 * geminiService.js — TripSync AI Service
 * All Groq/Gemini calls go through the TripSync backend — API key stays server-side.
 * Fallback chain: Groq (primary) → Groq (fallback) → deterministic fallback
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

/**
 * Call the TripSync backend AI endpoint.
 * Backend handles Groq primary/fallback models.
 */
async function callBackend(prompt) {
  const res = await fetch(`${API_BASE_URL}/api/v1/ai/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ prompt, max_tokens: 800 }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`AI backend ${res.status}: ${txt}`);
  }
  const data = await res.json();
  const text = data?.text;
  if (!text) throw new Error('Empty response from AI backend');
  return text.trim();
}

/**
 * Generic single-turn text generation.
 */
export async function geminiSuggest(prompt) {
  try {
    return await callBackend(prompt);
  } catch (err) {
    console.warn('[AI] Backend call failed:', err.message);
    throw err;
  }
}

/**
 * Chat-style multi-turn conversation with trip context injected.
 */
export async function geminiChat(messages, tripContext = '') {
  const systemPrompt = `You are TripSync AI, an intelligent travel assistant. ${
    tripContext ? `Current trip context: ${tripContext}` : 'The user has no active trip yet.'
  } Be concise, helpful, and friendly. Focus on travel-related questions: bookings, itineraries, disruptions, refunds, documents, and local tips. Always respond in 2–4 sentences unless a list is needed.`;

  const fullPrompt = [
    systemPrompt,
    ...messages.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`),
  ].join('\n\n');

  return geminiSuggest(fullPrompt);
}

/**
 * Generate disruption recovery suggestions.
 */
export async function geminiRecoverySuggestions(disruption, tripDetails) {
  const prompt = `A traveler had a travel disruption: ${disruption}. Trip details: ${JSON.stringify(tripDetails)}.
  Suggest 3 concise recovery options: 1) fastest 2) cheapest 3) most comfortable.
  For each, give: transport type, estimated cost in INR, time impact, and one key benefit. Keep it practical and India-specific.`;
  return geminiSuggest(prompt);
}

/**
 * Build a trip context string for the AI assistant.
 */
export function buildTripContext(trip, bookings = []) {
  if (!trip) return '';
  const bookingsSummary = bookings
    .slice(0, 5)
    .map((b) => `${b.booking_type}: ${b.provider_name} (${b.status})`)
    .join(', ');
  return `Trip: ${trip.name}, from ${trip.origin_city || 'unknown'} to ${trip.destination_city}, dates: ${trip.start_at?.slice(0, 10)} to ${trip.end_at?.slice(0, 10)}, status: ${trip.status}. Bookings: ${bookingsSummary || 'none yet'}.`;
}

/**
 * Alias used by disruption analysis & recovery services.
 * Returns null (never throws) — callers use deterministic fallback on null.
 */
export async function generateGeminiContent(prompt) {
  try {
    return await geminiSuggest(prompt);
  } catch (err) {
    console.warn('[AI] generateGeminiContent failed — using deterministic fallback:', err.message);
    return null;
  }
}
