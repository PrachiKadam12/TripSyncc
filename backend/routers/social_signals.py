"""
Social Signals Router — backend proxy for Reddit/social media signals.
Prevents CORS issues by calling Reddit from the server.
"""
import logging
import time
import json
import urllib.request
import urllib.parse
from typing import Optional
from fastapi import APIRouter, HTTPException, Query

logger = logging.getLogger("tripsync.router.social")

router = APIRouter(prefix="/api/v1", tags=["social"])

# Cache: {cache_key: {"data": [...], "stored_at": timestamp}}
_cache: dict[str, dict] = {}
CACHE_TTL = 300  # 5 minutes

REDDIT_SEARCH_URL = "https://www.reddit.com/search.json"


def _get_cache(location: str) -> Optional[list]:
    key = location.lower().strip()
    entry = _cache.get(key)
    if entry and (time.time() - entry["stored_at"]) < CACHE_TTL:
        return entry["data"]
    return None


def _set_cache(location: str, data: list):
    key = location.lower().strip()
    _cache[key] = {"data": data, "stored_at": time.time()}


def _fetch_reddit(query: str, limit: int = 5) -> list:
    """Fetch Reddit posts. Returns empty list on failure."""
    try:
        url = f"{REDDIT_SEARCH_URL}?q={urllib.parse.quote(query)}&sort=new&limit={limit}&t=month"
        req = urllib.request.Request(url, headers={
            "User-Agent": "TripSync-TravelIntelligence/1.0"
        })
        with urllib.request.urlopen(req, timeout=8) as resp:
            raw = json.loads(resp.read().decode("utf-8"))
        posts = raw.get("data", {}).get("children", [])
        results = []
        for post in posts:
            d = post.get("data", {})
            if not d or d.get("over_18"):
                continue
            created_date = __import__("datetime").datetime.utcfromtimestamp(d.get("created_utc", 0))
            now = __import__("datetime").datetime.utcnow()
            hours_ago = max(0, int((now - created_date).total_seconds() / 3600))
            time_label = "Just now" if hours_ago < 1 else f"{hours_ago}h ago" if hours_ago < 24 else f"{hours_ago // 24}d ago"

            text = f"{d.get('title', '')} {d.get('selftext', '')}".lower()
            severity = "Low"
            if any(w in text for w in ["flood", "landslide", "blocked", "cancel"]):
                severity = "High"
            elif any(w in text for w in ["rain", "delay", "jam", "slow"]):
                severity = "Moderate"

            results.append({
                "id": d.get("id", ""),
                "platform": "reddit",
                "subreddit": d.get("subreddit_name_prefixed", f"r/{d.get('subreddit', '')}"),
                "author": d.get("author", ""),
                "title": d.get("title", ""),
                "text": (d.get("selftext") or "")[:200],
                "url": f"https://reddit.com{d.get('permalink', '')}",
                "score": d.get("score", 0),
                "comments": d.get("num_comments", 0),
                "timeLabel": time_label,
                "severity": severity,
                "createdAt": created_date.isoformat(),
            })
        return results
    except Exception as e:
        logger.warning(f"Reddit fetch failed: {e}")
        return []


@router.get("/social-signals")
async def get_social_signals(
    location: str = Query(..., description="Location to search for"),
    weather: str = Query("", description="Current weather condition"),
    limit: int = Query(8, ge=1, le=20),
):
    """
    Get social signals for a location. Results cached for 5 minutes.
    """
    # Check cache
    cached = _get_cache(location)
    if cached is not None:
        return {"signals": cached[:limit], "source": "reddit", "cached": True, "location": location}

    # Build queries from location (dynamic, not hardcoded)
    queries = [
        f"{location} weather travel",
        f"{location} rain flood travel",
        f"{location} road conditions",
    ]

    all_signals = []
    seen_ids = set()

    for query in queries[:2]:
        posts = _fetch_reddit(query, limit=5)
        for post in posts:
            if post["id"] not in seen_ids:
                seen_ids.add(post["id"])
                all_signals.append(post)

    # Sort by most recent
    all_signals.sort(key=lambda x: x.get("createdAt", ""), reverse=True)

    # Cache results
    _set_cache(location, all_signals)

    return {
        "signals": all_signals[:limit],
        "source": "reddit",
        "cached": False,
        "location": location,
    }


@router.get("/trips/{trip_id}/social-signals")
async def get_trip_social_signals(
    trip_id: str,
    location: str = Query("", description="Primary location (optional)"),
    limit: int = Query(8, ge=1, le=20),
):
    """
    Get social signals for a trip. Uses trip location if provided.
    """
    # If no location provided, try to get from trip
    loc = location
    if not loc:
        try:
            from database import supabase_client
            if supabase_client:
                res = supabase_client.table("trips").select("destination_city").eq("id", trip_id).execute()
                if res.data:
                    loc = res.data[0].get("destination_city", "")
        except Exception as e:
            logger.warning(f"Could not fetch trip location: {e}")

    if not loc:
        raise HTTPException(status_code=400, detail="No location provided and could not determine from trip")

    # Reuse the same logic
    cached = _get_cache(loc)
    if cached is not None:
        return {"signals": cached[:limit], "source": "reddit", "cached": True, "location": loc}

    queries = [f"{loc} weather travel", f"{loc} rain flood travel"]
    all_signals = []
    seen_ids = set()

    for query in queries:
        posts = _fetch_reddit(query, limit=5)
        for post in posts:
            if post["id"] not in seen_ids:
                seen_ids.add(post["id"])
                all_signals.append(post)

    all_signals.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    _set_cache(loc, all_signals)

    return {
        "signals": all_signals[:limit],
        "source": "reddit",
        "cached": False,
        "location": loc,
    }
