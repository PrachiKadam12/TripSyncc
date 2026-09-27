"""
GNews Provider Adapter.
All GNews-specific code lives HERE and nowhere else.
"""
import os
from datetime import datetime, timezone
from typing import Optional
import httpx
from .base import BaseNewsProvider
from ..types import TripSyncNewsArticle, NewsProviderStatus
from ..news_normalizer import normalize_gnews_article

GNEWS_BASE = "https://gnews.io/api/v4"


class GNewsProvider(BaseNewsProvider):
    """GNews provider — free tier available, supports keyword search."""

    def __init__(self, api_key: Optional[str] = None):
        super().__init__(api_key=api_key or os.getenv("GNEWS_API_KEY"))
        self._last_successful_fetch: Optional[str] = None

    def get_provider_name(self) -> str:
        return "gnews"

    async def search(
        self,
        query: str,
        *,
        language: str = "en",
        country: Optional[str] = None,
        from_hours_ago: int = 24,
        max_results: int = 20,
    ) -> list[TripSyncNewsArticle]:
        if not self._api_key:
            self._last_error = "GNEWS_API_KEY not configured"
            return []

        try:
            params = {
                "q": query,
                "lang": language,
                "max": min(max_results, 100),
                "apikey": self._api_key,
            }
            if country:
                params["country"] = country

            data = await self._fetch(f"{GNEWS_BASE}/search", params=params)
            articles = data.get("articles", [])
            normalized = [normalize_gnews_article(a, "gnews") for a in articles]
            self._last_successful_fetch = datetime.now(timezone.utc).isoformat()
            return normalized

        except Exception as e:
            self._last_error = str(e)
            return []

    async def get_latest(
        self,
        *,
        language: str = "en",
        country: Optional[str] = None,
        max_results: int = 20,
    ) -> list[TripSyncNewsArticle]:
        if not self._api_key:
            return []

        try:
            params = {
                "lang": language,
                "max": min(max_results, 100),
                "apikey": self._api_key,
            }
            if country:
                params["country"] = country

            data = await self._fetch(f"{GNEWS_BASE}/top-headlines", params=params)
            articles = data.get("articles", [])
            normalized = [normalize_gnews_article(a, "gnews") for a in articles]
            self._last_successful_fetch = datetime.now(timezone.utc).isoformat()
            return normalized

        except Exception as e:
            self._last_error = str(e)
            return []

    async def health_check(self) -> NewsProviderStatus:
        if not self._api_key:
            return NewsProviderStatus(
                provider="gnews",
                status="UNAVAILABLE",
                message="GNEWS_API_KEY not configured",
            )
        try:
            params = {"q": "India", "max": 1, "apikey": self._api_key}
            data = await self._fetch(f"{GNEWS_BASE}/search", params=params)
            if data.get("totalArticles") is not None:
                return NewsProviderStatus(
                    provider="gnews",
                    status="LIVE",
                    last_successful_fetch=self._last_successful_fetch,
                    cached=False,
                )
            return NewsProviderStatus(provider="gnews", status="DEGRADED")
        except Exception as e:
            return NewsProviderStatus(provider="gnews", status="UNAVAILABLE", message=str(e))
