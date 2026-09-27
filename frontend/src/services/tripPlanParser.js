/**
 * tripPlanParser.js — Client-side service for Trip Plan PDF validation and extraction.
 * Communicates with the FastAPI backend (/api/trips/parse-plan), with a resilient
 * client-side Gemini fallback if the backend is not running.
 */

const MAX_PDF_SIZE_BYTES = 4 * 1024 * 1024; // 4 MB

/**
 * Validate PDF file size and type.
 * Returns { valid: boolean, error?: string }
 */
export function validatePdfFile(file) {
  if (!file) {
    return { valid: false, error: 'No file selected.' };
  }

  const isPdf =
    file.type === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf');

  if (!isPdf) {
    return { valid: false, error: 'Please upload a PDF file.' };
  }

  if (file.size > MAX_PDF_SIZE_BYTES) {
    return { valid: false, error: 'File size must be 4 MB or less.' };
  }

  return { valid: true };
}

/**
 * Convert File to Base64 data string (excluding prefix data:application/pdf;base64,)
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        const base64 = result.split(',')[1] || result;
        resolve(base64);
      } else {
        reject(new Error('Failed to convert file to base64 string.'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('FileReader error'));
    reader.readAsDataURL(file);
  });
}

/**
 * Safely parse JSON from LLM string output (removes markdown fences)
 */
function parseJsonSafely(text) {
  if (!text) return null;
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  }
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1) {
    cleaned = cleaned.substring(start, end + 1);
  }
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.warn('JSON parsing error from model output:', err);
    return null;
  }
}

/**
 * Sanitize extracted fields to strictly adhere to expected schema
 */
function sanitizeExtractedData(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const travelTypeRaw = String(raw.travel_type || '').trim().toLowerCase();
  const validTravelType = ['solo', 'group', 'family'].includes(travelTypeRaw) ? travelTypeRaw : '';

  let cleanBudget = null;
  if (raw.total_budget != null && raw.total_budget !== '') {
    if (typeof raw.total_budget === 'number' && !isNaN(raw.total_budget)) {
      cleanBudget = raw.total_budget;
    } else if (typeof raw.total_budget === 'string') {
      const numStr = raw.total_budget.replace(/[^\d.]/g, '');
      const parsed = parseFloat(numStr);
      if (!isNaN(parsed)) cleanBudget = parsed;
    }
  }

  const rawStops = Array.isArray(raw.stops) ? raw.stops : [];
  const stops = rawStops.map((s, idx) => {
    const dayNum = Number(s.day_number) || (idx + 1);
    const city = String(s.city || s.location || s.route || '').trim();
    const route = String(s.route || '').trim();
    const title = String(s.title || (dayNum ? `Day ${dayNum} – ${city || 'Stop'}` : `Stop ${idx + 1}`)).trim();
    const description = String(s.description || s.notes || '').trim();
    const transport = String(s.transport || '').trim();
    const activities = String(s.activities || s.sightseeing || '').trim();
    const arrival = String(s.arrival || '').trim();
    const departure = String(s.departure || '').trim();

    return {
      id: `stop-${idx + 1}-${Date.now()}`,
      day_number: dayNum,
      city: city || route || `Stop ${idx + 1}`,
      route,
      title,
      description,
      transport,
      activities,
      arrival,
      departure,
      notes: description || activities || route || '',
    };
  });

  return {
    trip_name: String(raw.trip_name || '').trim(),
    organizer_name: String(raw.organizer_name || '').trim(),
    starting_city: String(raw.starting_city || '').trim(),
    destination: String(raw.destination || '').trim(),
    start_date: String(raw.start_date || '').trim(),
    end_date: String(raw.end_date || '').trim(),
    travel_type: validTravelType,
    total_budget: cleanBudget,
    stops,
  };
}

/**
 * Client-side Gemini fallback for parsing PDF if backend server is offline
 */
async function fallbackClientSideGemini(file) {
  const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!geminiKey) {
    throw new Error('Gemini API key is not configured.');
  }

  const base64Data = await fileToBase64(file);

  const prompt = `You are an intelligent travel assistant for TripSync.
Extract structured trip details from this trip plan PDF.

Return ONLY a valid JSON object matching this schema:
{
  "trip_name": "",
  "organizer_name": "",
  "starting_city": "",
  "destination": "",
  "start_date": "",
  "end_date": "",
  "travel_type": "",
  "total_budget": null,
  "stops": [
    {
      "day_number": 1,
      "city": "",
      "route": "",
      "title": "",
      "description": "",
      "transport": "",
      "activities": "",
      "arrival": "",
      "departure": ""
    }
  ]
}

Strict Rules:
1. Do NOT invent, guess, or hallucinate missing information.
2. If any field cannot be confidently extracted, leave it as "" (empty string) or null for total_budget, or [] for stops.
3. "organizer_name": The tour company, travel agency, organizer, or planner organizing the trip (e.g. "Evoke Holidays"). Optional, leave "" if not found.
4. For start_date and end_date, format strictly as YYYY-MM-DD if found, else "".
5. For travel_type, choose strictly "solo", "group", or "family" if clearly indicated, else "".
6. For total_budget, extract numeric budget in INR without currency symbols, else null.
7. "stops": Extract the complete day-wise itinerary in chronological order. For each day or travel segment:
   - day_number: integer (1, 2, 3...)
   - city: primary city or destination of the stop (e.g. "Delhi", "Amritsar", "Manali", "Kasol", "Shimla")
   - route: journey or route (e.g. "Mumbai to Delhi", "Delhi to Amritsar")
   - title: day title (e.g. "Day 1 – Mumbai to Delhi | Train Journey")
   - description: brief itinerary summary for this day
   - transport: transport mode if mentioned (e.g. "Train", "Flight", "Cab", "Bus")
   - activities: key sightseeing or attractions (e.g. "Wagah Border Ceremony", "Solang Valley")
   - arrival: YYYY-MM-DD if determinable, else ""
   - departure: YYYY-MM-DD if determinable, else ""
8. Return ONLY the JSON object without markdown fences or comments.`;

  const models = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'];
  let lastErr = null;

  for (const model of models) {
    // Try up to 2 attempts per model in case of temporary 503 Service Unavailable
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inlineData: {
                      mimeType: 'application/pdf',
                      data: base64Data,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 2048,
            },
          }),
        });

        if (!res.ok) {
          if (res.status === 503 && attempt === 0) {
            console.warn(`Gemini 503 on ${model}, waiting 1.5s before retry...`);
            await new Promise((r) => setTimeout(r, 1500));
            continue;
          }
          throw new Error(`Gemini responded with HTTP ${res.status}`);
        }

        const resData = await res.json();
        const textResult = resData?.candidates?.[0]?.content?.parts?.[0]?.text;
        const parsed = parseJsonSafely(textResult);
        if (parsed) {
          return sanitizeExtractedData(parsed);
        }
      } catch (err) {
        console.warn(`Client fallback model ${model} attempt ${attempt + 1} failed:`, err.message);
        lastErr = err;
        if (attempt === 0 && String(err.message).includes('503')) {
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
    }
  }

  throw lastErr || new Error('All Gemini models failed. Please enter details manually.');
}

/**
 * Main parser entry point:
 * Validates PDF, calls backend API, and falls back gracefully.
 */
export async function parseTripPlanPdf(file) {
  // 1. Validation check
  const validation = validatePdfFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // 2. Try Backend first
  const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
  const endpoint = apiBase ? `${apiBase}/api/trips/parse-plan` : '/api/trips/parse-plan';

  try {
    const formData = new FormData();
    formData.append('file', file);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000); // 25s timeout

    const res = await fetch(endpoint, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      if (data && data.data) {
        return sanitizeExtractedData(data.data);
      }
    } else {
      const errJson = await res.json().catch(() => null);
      if (res.status === 400 && errJson?.detail) {
        throw new Error(errJson.detail);
      }
      console.warn('Backend returned non-200:', res.status, errJson);
    }
  } catch (backendErr) {
    if (
      backendErr.message === 'File size must be 4 MB or less.' ||
      backendErr.message === 'Please upload a PDF file.'
    ) {
      throw backendErr;
    }
    console.warn('Backend PDF parse unavailable or failed, attempting client-side fallback:', backendErr.message);
  }

  // 3. Resilient Fallback to client-side Gemini if backend was unreachable
  try {
    const fallbackResult = await fallbackClientSideGemini(file);
    if (fallbackResult) {
      return fallbackResult;
    }
  } catch (fallbackErr) {
    console.warn('Client fallback extraction error:', fallbackErr.message);
  }

  // 4. Clean user-friendly error if all automated extraction fails
  throw new Error('Unable to extract trip details from this PDF. You can enter the details manually.');
}
