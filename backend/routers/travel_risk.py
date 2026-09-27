"""
travel_risk.py — TripSync Stage 12 API Integration Router

Proxies:
  - AviationStack  → flight status (key stays server-side)
  - OpenRouteService → driving duration / distance (key stays server-side)

Open-Meteo has no auth requirement so the frontend calls it directly.

All endpoints fail independently and return structured error payloads
so one API outage cannot break the entire Stage 12 UI.
Uses standard library urllib (with httpx compatibility) for zero runtime dependency issues.
"""

import json
import logging
import urllib.request
import urllib.parse
import urllib.error
from datetime import datetime
from fastapi import APIRouter
from config import settings

logger = logging.getLogger("tripsync.router.travel_risk")
router = APIRouter(prefix="/api/travel-risk", tags=["Travel Risk"])

AVIATIONSTACK_BASE = "http://api.aviationstack.com/v1"
OPENROUTE_BASE = "https://api.openrouteservice.org/v2"
TIMEOUT_SECONDS = 8


# ──────────────────────────────────────────────────────────
# FLIGHT STATUS (AviationStack)
# ──────────────────────────────────────────────────────────

@router.get("/flight-status")
def get_flight_status(
    flight_iata: str = "",
    flight_date: str = "",
):
    """
    Proxy AviationStack flight status.

    Query params:
      flight_iata  — e.g. "AI123"
      flight_date  — optional, YYYY-MM-DD

    Returns a normalized flight status object or an error payload.
    The API key is read from backend settings — never exposed to the browser.
    """
    key = settings.AVIATIONSTACK_API_KEY
    if not key:
        logger.warning("AVIATIONSTACK_API_KEY not configured")
        return {
            "status": "unconfigured",
            "error": "Flight status API key not configured on server.",
            "flight": None,
        }

    if not flight_iata:
        return {
            "status": "error",
            "error": "flight_iata parameter is required",
            "flight": None,
        }

    clean_iata = flight_iata.upper().replace(" ", "")
    query = {
        "access_key": key,
        "flight_iata": clean_iata,
        "limit": 1,
    }
    if flight_date:
        query["flight_date"] = flight_date

    url = f"{AVIATIONSTACK_BASE}/flights?{urllib.parse.urlencode(query)}"

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "TripSync-DisruptionEngine/1.0"})
        with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as resp:
            raw = json.loads(resp.read().decode("utf-8"))

        flights = raw.get("data") or []
        if not flights:
            return {
                "status": "not_found",
                "error": f"No live flight data found for {flight_iata}",
                "flight": None,
            }

        f = flights[0]
        dep = f.get("departure") or {}
        arr = f.get("arrival") or {}

        # Deterministic delay calculation — never delegated to AI
        scheduled_arr = arr.get("scheduled")
        estimated_arr = arr.get("estimated") or arr.get("actual") or scheduled_arr
        delay_minutes = 0
        if scheduled_arr and estimated_arr:
            try:
                s = datetime.fromisoformat(scheduled_arr.replace("Z", "+00:00"))
                e = datetime.fromisoformat(estimated_arr.replace("Z", "+00:00"))
                delay_minutes = max(0, int((e - s).total_seconds() / 60))
            except Exception:
                delay_minutes = arr.get("delay") or dep.get("delay") or 0

        flight_status = f.get("flight_status", "unknown")
        if flight_status in ("cancelled", "diverted"):
            disruption_type = "Flight Cancellation" if flight_status == "cancelled" else "Flight Diversion"
        elif delay_minutes >= 120:
            disruption_type = "Flight Delay"
        elif delay_minutes >= 30:
            disruption_type = "Flight Delay"
        else:
            disruption_type = None

        # Severity thresholds — deterministic
        if flight_status in ("cancelled", "diverted") or delay_minutes >= 180:
            severity = "critical"
        elif delay_minutes >= 120:
            severity = "high"
        elif delay_minutes >= 30:
            severity = "medium"
        elif delay_minutes > 0:
            severity = "low"
        else:
            severity = "none"

        return {
            "status": "success",
            "error": None,
            "flight": {
                "flight_iata": f.get("flight", {}).get("iata", clean_iata),
                "airline_name": f.get("airline", {}).get("name") or "Airline",
                "flight_status": flight_status,
                "departure_airport": dep.get("airport"),
                "departure_iata": dep.get("iata"),
                "arrival_airport": arr.get("airport"),
                "arrival_iata": arr.get("iata"),
                "scheduled_departure": dep.get("scheduled"),
                "estimated_departure": dep.get("estimated") or dep.get("actual"),
                "scheduled_arrival": scheduled_arr,
                "estimated_arrival": estimated_arr,
                "delay_minutes": delay_minutes,
                "disruption_type": disruption_type,
                "severity": severity,
                "is_disrupted": disruption_type is not None,
                "gate": dep.get("gate"),
                "terminal": dep.get("terminal"),
            },
        }

    except urllib.error.HTTPError as e:
        err_body = ""
        try:
            err_body = e.read().decode("utf-8")
        except Exception:
            pass
        logger.warning(f"AviationStack HTTP error {e.code}: {err_body}")
        return {
            "status": "error",
            "error": f"Flight status API error ({e.code})",
            "flight": None,
        }
    except Exception as e:
        logger.warning(f"AviationStack lookup error: {e}")
        return {
            "status": "error",
            "error": "Flight status lookup unavailable.",
            "flight": None,
        }


# ──────────────────────────────────────────────────────────
# ROUTE / TRANSFER TIME  (OpenRouteService)
# ──────────────────────────────────────────────────────────

@router.get("/route-duration")
def get_route_duration(
    from_lng: float = 0.0,
    from_lat: float = 0.0,
    to_lng: float = 0.0,
    to_lat: float = 0.0,
    profile: str = "driving-car",
):
    """
    Proxy OpenRouteService driving-time request.

    Query params:
      from_lng, from_lat  — departure coordinate
      to_lng, to_lat      — arrival coordinate
      profile             — routing profile (default: driving-car)

    Returns duration_minutes and distance_km, or an error payload.
    """
    key = settings.OPENROUTE_API_KEY
    if not key:
        logger.warning("OPENROUTE_API_KEY not configured")
        return {
            "status": "unconfigured",
            "error": "Route API key not configured on server.",
            "route": None,
        }

    if not (from_lng or from_lat or to_lng or to_lat):
        return {
            "status": "error",
            "error": "from_lng, from_lat, to_lng, to_lat are required",
            "route": None,
        }

    body = json.dumps({
        "coordinates": [[from_lng, from_lat], [to_lng, to_lat]],
        "instructions": False,
    }).encode("utf-8")

    req = urllib.request.Request(
        f"{OPENROUTE_BASE}/directions/{profile}/json",
        data=body,
        headers={
            "Authorization": key,
            "Content-Type": "application/json",
            "User-Agent": "TripSync-DisruptionEngine/1.0"
        }
    )

    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as resp:
            raw = json.loads(resp.read().decode("utf-8"))

        routes = raw.get("routes") or []
        if not routes:
            return {
                "status": "not_found",
                "error": "No route found between provided coordinates.",
                "route": None,
            }

        summary = routes[0].get("summary") or {}
        duration_seconds = summary.get("duration", 0)
        distance_meters = summary.get("distance", 0)

        return {
            "status": "success",
            "error": None,
            "route": {
                "duration_minutes": round(duration_seconds / 60),
                "distance_km": round(distance_meters / 1000, 2),
                "profile": profile,
            },
        }

    except urllib.error.HTTPError as e:
        err_msg = ""
        try:
            err_msg = e.read().decode("utf-8")
        except Exception:
            pass
        logger.warning(f"OpenRouteService HTTP error {e.code}: {err_msg}")
        return {
            "status": "error",
            "error": f"Route API error ({e.code})",
            "route": None,
        }
    except Exception as e:
        logger.warning(f"OpenRouteService error: {e}")
        return {
            "status": "error",
            "error": "Route service unavailable.",
            "route": None,
        }
