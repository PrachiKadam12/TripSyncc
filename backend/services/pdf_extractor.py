import fitz  # PyMuPDF
import base64
import json
import re
import logging
import httpx
from typing import Dict, Any, Tuple, List
from config import settings

logger = logging.getLogger("tripsync.pdf_extractor")

GEMINI_MODELS = [
    "gemini-3.8-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
]

EXTRACTION_SYSTEM_PROMPT = """You are an intelligent travel data extraction assistant for TripSync.
Your task is to extract structured trip details from the provided trip plan, ticket, or itinerary document.

Return ONLY a valid JSON object matching this exact schema:
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

STRICT EXTRACTION RULES:
1. Do NOT invent, assume, or hallucinate missing information.
2. If any field cannot be confidently extracted from the document, leave it as an empty string ("") or null for total_budget, or [] for stops.
3. "trip_name": The title or name of the trip (e.g. "Manali Trip", "Himalayan Getaway"). If none is explicitly stated, create a concise title based on destination (e.g. "Trip to Manali") or leave "".
4. "organizer_name": The tour company, travel agency, organizer, or planner organizing the trip (e.g. "Evoke Holidays"). Leave "" if not found.
5. "starting_city": The origin city or departure location where the journey starts. Leave "" if not found.
6. "destination": The primary arrival city or destination of the trip. Leave "" if not found.
7. "start_date": The trip start / first departure date formatted strictly as YYYY-MM-DD (e.g. "2026-09-12"). Leave "" if not found.
8. "end_date": The trip end / return date formatted strictly as YYYY-MM-DD (e.g. "2026-09-18"). Leave "" if not found.
9. "travel_type": Must be ONLY "solo", "group", or "family" if clearly indicated by passenger count, traveler names, or trip notes. If unclear or not specified, leave "".
10. "total_budget": Numeric total budget, estimated cost, or package price in INR (e.g. 45000 or 18500.50). Numbers only, without currency symbols. Leave null if not found.
11. "stops": Day-wise itinerary list. Extract all days or legs in chronological order:
    - "day_number": Integer day number (1, 2, 3...)
    - "city": Main city or location for this stop (e.g. "Delhi", "Amritsar", "Manali", "Kasol", "Shimla")
    - "route": Travel route if mentioned (e.g. "Mumbai to Delhi", "Delhi to Amritsar")
    - "title": Title or summary of the day (e.g. "Day 1 – Mumbai to Delhi | Train Journey")
    - "description": Description or itinerary notes for the day
    - "transport": Transport mode if mentioned (e.g. "Train", "Flight", "Cab", "Bus", "Volvo")
    - "activities": Sightseeing, tours, or key attractions (e.g. "Wagah Border Ceremony", "Solang Valley adventure")
    - "arrival": Date formatted as YYYY-MM-DD if determinable, else ""
    - "departure": Date formatted as YYYY-MM-DD if determinable, else ""
12. Output MUST be strictly valid JSON without markdown code fences or conversational text.
"""

def extract_pdf_content(pdf_bytes: bytes) -> Tuple[str, bool, List[bytes]]:
    """
    Extract text from PDF.
    If extracted text is under 50 characters, marks as scanned/image-based
    and renders up to 3 pages as PNG images for OCR.
    """
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as e:
        raise ValueError(f"Corrupted or invalid PDF file: {str(e)}")

    if len(doc) == 0:
        raise ValueError("PDF document is empty (0 pages).")

    full_text = ""
    for page in doc:
        full_text += (page.get_text() or "") + "\n"

    full_text = full_text.strip()
    is_scanned = len(full_text) < 50
    page_images: List[bytes] = []

    if is_scanned:
        logger.info("PDF has insufficient selectable text. Triggering image rendering for OCR.")
        # Render first up to 3 pages for OCR
        for i in range(min(len(doc), 3)):
            page = doc[i]
            pix = page.get_pixmap(dpi=150)
            page_images.append(pix.tobytes("png"))

    return full_text, is_scanned, page_images

def clean_json_response(raw_text: str) -> Dict[str, Any]:
    """Clean markdown code fences and parse JSON."""
    cleaned = raw_text.strip()
    # Remove markdown code block fences if present
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    
    # Locate first { and last }
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1:
        cleaned = cleaned[start:end+1]

    data = json.loads(cleaned)
    return data

async def extract_trip_with_gemini(
    text: str,
    is_scanned: bool,
    page_images: List[bytes]
) -> Dict[str, Any]:
    """
    Calls Gemini API with extracted text or rendered page images (OCR).
    """
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not configured in backend environment.")

    # Prepare parts
    parts = []
    if is_scanned and page_images:
        parts.append({
            "text": EXTRACTION_SYSTEM_PROMPT + "\n\nThis document is a scanned image/PDF. Perform OCR and extract the required fields from the images below:"
        })
        for img_bytes in page_images:
            b64_img = base64.b64encode(img_bytes).decode("utf-8")
            parts.append({
                "inlineData": {
                    "mimeType": "image/png",
                    "data": b64_img
                }
            })
    else:
        parts.append({
            "text": f"{EXTRACTION_SYSTEM_PROMPT}\n\nDocument Text Content:\n\"\"\"\n{text[:12000]}\n\"\"\""
        })

    payload = {
        "contents": [{"parts": parts}],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 2048,
            "topP": 0.95
        }
    }

    last_error = None
    async with httpx.AsyncClient(timeout=30.0) as client:
        for model in GEMINI_MODELS:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
            try:
                logger.info(f"Calling Gemini model {model} for trip extraction...")
                res = await client.post(url, json=payload, headers={"Content-Type": "application/json"})
                if res.status_code == 200:
                    resp_data = res.json()
                    candidates = resp_data.get("candidates", [])
                    if candidates:
                        raw_result = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                        parsed = clean_json_response(raw_result)
                        return sanitize_trip_data(parsed)
                else:
                    err_msg = f"Gemini API {model} returned {res.status_code}: {res.text[:200]}"
                    logger.warning(err_msg)
                    last_error = Exception(err_msg)
            except Exception as e:
                logger.warning(f"Error calling model {model}: {e}")
                last_error = e

    raise Exception(f"All Gemini models failed. Last error: {str(last_error)}")

def sanitize_trip_data(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Sanitize and validate extracted trip fields to match expected schema."""
    travel_type_raw = str(raw.get("travel_type") or "").strip().lower()
    valid_travel_type = travel_type_raw if travel_type_raw in ["solo", "group", "family"] else ""

    budget_raw = raw.get("total_budget")
    clean_budget = None
    if budget_raw is not None and budget_raw != "":
        try:
            # Handle potential string formatted like "₹80,000" or "80000"
            if isinstance(budget_raw, str):
                numeric_str = re.sub(r"[^\d.]", "", budget_raw)
                clean_budget = float(numeric_str) if numeric_str else None
            else:
                clean_budget = float(budget_raw)
        except (ValueError, TypeError):
            clean_budget = None

    raw_stops = raw.get("stops") if isinstance(raw.get("stops"), list) else []
    clean_stops = []
    for idx, s in enumerate(raw_stops):
        if not isinstance(s, dict):
            continue
        day_num = s.get("day_number")
        try:
            day_num = int(day_num) if day_num is not None else idx + 1
        except (ValueError, TypeError):
            day_num = idx + 1

        clean_stops.append({
            "day_number": day_num,
            "city": str(s.get("city") or s.get("location") or s.get("route") or "").strip(),
            "route": str(s.get("route") or "").strip(),
            "title": str(s.get("title") or f"Day {day_num}").strip(),
            "description": str(s.get("description") or s.get("notes") or "").strip(),
            "transport": str(s.get("transport") or "").strip(),
            "activities": str(s.get("activities") or s.get("sightseeing") or "").strip(),
            "arrival": str(s.get("arrival") or "").strip(),
            "departure": str(s.get("departure") or "").strip(),
            "notes": str(s.get("notes") or s.get("description") or s.get("activities") or "").strip(),
        })

    return {
        "trip_name": str(raw.get("trip_name") or "").strip(),
        "organizer_name": str(raw.get("organizer_name") or "").strip(),
        "starting_city": str(raw.get("starting_city") or "").strip(),
        "destination": str(raw.get("destination") or "").strip(),
        "start_date": str(raw.get("start_date") or "").strip(),
        "end_date": str(raw.get("end_date") or "").strip(),
        "travel_type": valid_travel_type,
        "total_budget": clean_budget,
        "stops": clean_stops,
    }
