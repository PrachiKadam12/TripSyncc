"""
News Router — provider-independent travel news API.
"""
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from services.news.news_service import news_service

logger = logging.getLogger("tripsync.router.news")

router = APIRouter(prefix="/api/v1", tags=["news"])


@router.get("/trips/{trip_id}/news")
async def get_trip_news(
    trip_id: str,
    hours: int = Query(24, ge=1, le=168, description="Search window in hours"),
    limit: int = Query(20, ge=1, le=100, description="Maximum articles"),
    type: Optional[str] = Query(None, description="Filter by disruption type"),
    severity: Optional[str] = Query(None, description="Filter by severity"),
    location: Optional[str] = Query(None, description="Filter by location"),
):
    """
    Get trip-aware travel news.

    Returns normalized news articles relevant to the user's trip locations.
    """
    try:
        result = await news_service.get_trip_news(
            trip_id,
            hours=hours,
            limit=limit,
            disruption_type=type,
            severity=severity,
            location=location,
        )
        return result.to_dict()
    except Exception as e:
        logger.error(f"Error fetching news for trip {trip_id}: {e}")
        raise HTTPException(status_code=500, detail="Travel news is temporarily unavailable")


@router.get("/news/status")
async def get_news_provider_status():
    """Get health status of all news providers."""
    try:
        statuses = await news_service.get_provider_status()
        return {
            "providers": [s.to_dict() for s in statuses],
            "total": len(statuses),
            "available": sum(1 for s in statuses if s.status == "LIVE"),
        }
    except Exception as e:
        logger.error(f"Error checking provider status: {e}")
        raise HTTPException(status_code=500, detail="Could not check provider status")
