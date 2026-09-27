"""
NewsAPI Provider Adapter.
All NewsAPI-specific code lives HERE and nowhere else.
The rest of TripSync never imports NewsAPI directly.
"""
import os
from datetime import datetime, timezone, timedelta
from typing import Optional
import httpx
from .base import BaseNewsProvider
from ..types import TripSyncNewsArticle, NewsProviderStatus
from ..news_normalizer import normalize_newsapi_article

NEWSAPI_BASE = "https://newsapi.org/v2"


class NewsApiProvider(BaseNewsProvider):
    """NewsAPI.org provider — supports keyword search, India-focused."""

    def __init__(self, api_key: Optional[str] = None):
        super().__init__(api_key=api_key or os.getenv("NEWS_API_KEY"))
        self._last_successful_fetch: Optional[str] = None

    def get_provider_name(self) -> str:
        return "newsapi"

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
            self._last_error = "NEWS_API_KEY not configured"
            return []

        try:
            from_date = (datetime.now(timezone.utc) - timedelta(hours=from_hours_ago)).strftime("%Y-%m-%dT%H:%M:%S")

            params = {
                "q": query,
                "language": language,
                "from": from_date,
                "sortBy": "publishedAt",
                "pageSize": min(max_results, 100),
                "apiKey": self._api_key,
            }
            if country:
                params["country"] = country

            data = await self._fetch(f"{NEWSAPI_BASE}/everything", params=params)
            articles = data.get("articles", [])

            # Normalize all articles
            normalized = [normalize_newsapi_article(a, "newsapi") for a in articles]
            self._last_successful_fetch = datetime.now(timezone.utc).isoformat()
            return normalized

        except httpx.HTTPStatusError as e:
            self._last_error = f"NewsAPI HTTP {e.response.status_code}"
            return []
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
                "language": language,
                "pageSize": min(max_results, 100),
                "apiKey": self._api_key,
            }
            if country:
                params["country"] = country

            data = await self._fetch(f"{NEWSAPI_BASE}/top-headlines", params=params)
            articles = data.get("articles", [])
            normalized = [normalize_newsapi_article(a, "newsapi") for a in articles]
            self._last_successful_fetch = datetime.now(timezone.utc).isoformat()
            return normalized

        except Exception as e:
            self._last_error = str(e)
            return []

    async def health_check(self) -> NewsProviderStatus:
        if not self._api_key:
            return NewsProviderStatus(
                provider="newsapi",
                status="UNAVAILABLE",
                message="NEWS_API_KEY not configured",
            )
        try:
            # lightweight check — fetch 1 article
            params = {"q": "India", "pageSize": 1, "apiKey": self._api_key}
            data = await self._fetch(f"{NEWSAPI_BASE}/everything", params=params)
            if data.get("status") == "ok":
                return NewsProviderStatus(
                    provider="newsapi",
                    status="LIVE",
                    last_successful_fetch=self._last_successful_fetch,
                    cached=False,
                )
            return NewsProviderStatus(
                provider="newsapi",
                status="DEGRADED",
                message=data.get("message", "Unknown error"),
            )
        except Exception as e:
            return NewsProviderStatus(
                provider="newsapi",
                status="UNAVAILABLE",
                message=str(e),
            )
