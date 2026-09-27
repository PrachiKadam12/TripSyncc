"""
NewsData.io Provider Adapter.
All NewsData.io-specific code lives HERE and nowhere else.

API docs: https://newsdata.io/docs
Base URL: https://newsdata.io/api/1/news
"""
import os
import hashlib
from datetime import datetime, timezone
from typing import Optional
import httpx
from .base import BaseNewsProvider
from ..types import TripSyncNewsArticle, NewsProviderStatus

NEWSDATA_BASE = "https://newsdata.io/api/1/news"


class NewsDataProvider(BaseNewsProvider):
    """NewsData.io provider — supports keyword search, India-focused, free tier available."""

    def __init__(self, api_key: Optional[str] = None):
        super().__init__(api_key=api_key or os.getenv("NEWSDATA_API_KEY"))
        self._last_successful_fetch: Optional[str] = None

    def get_provider_name(self) -> str:
        return "newsdata"

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
            self._last_error = "NEWSDATA_API_KEY not configured"
            return []

        try:
            params = {
                "apikey": self._api_key,
                "q": query,
                "language": language,
                "size": min(max_results, 50),
            }
            if country:
                params["country"] = country

            data = await self._fetch(NEWSDATA_BASE, params=params)
            results = data.get("results", [])

            normalized = [self._normalize_article(r) for r in results]
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
                "apikey": self._api_key,
                "language": language,
                "size": min(max_results, 50),
            }
            if country:
                params["country"] = country

            data = await self._fetch(NEWSDATA_BASE, params=params)
            results = data.get("results", [])

            normalized = [self._normalize_article(r) for r in results]
            self._last_successful_fetch = datetime.now(timezone.utc).isoformat()
            return normalized

        except Exception as e:
            self._last_error = str(e)
            return []

    async def health_check(self) -> NewsProviderStatus:
        if not self._api_key:
            return NewsProviderStatus(
                provider="newsdata",
                status="UNAVAILABLE",
                message="NEWSDATA_API_KEY not configured",
            )
        try:
            params = {"apikey": self._api_key, "q": "India", "size": 1}
            data = await self._fetch(NEWSDATA_BASE, params=params)
            if data.get("status") == "success":
                return NewsProviderStatus(
                    provider="newsdata",
                    status="LIVE",
                    last_successful_fetch=self._last_successful_fetch,
                    cached=False,
                )
            return NewsProviderStatus(
                provider="newsdata",
                status="DEGRADED",
                message=data.get("message", "Unknown error"),
            )
        except Exception as e:
            return NewsProviderStatus(
                provider="newsdata",
                status="UNAVAILABLE",
                message=str(e),
            )

    def _normalize_article(self, raw: dict) -> TripSyncNewsArticle:
        """Normalize a NewsData.io article into TripSyncNewsArticle."""
        title = raw.get("title") or "Untitled"
        url = raw.get("link") or ""
        source_name = raw.get("source_id") or "Unknown"

        article_id = hashlib.md5(f"newsdata:{url or title}".encode()).hexdigest()[:16]

        return TripSyncNewsArticle(
            id=article_id,
            title=title,
            summary=raw.get("description") or None,
            url=url,
            image_url=raw.get("image_url") or None,
            source_id=raw.get("source_id") or None,
            source_name=source_name,
            source_domain=self._extract_domain(url),
            published_at=raw.get("pubDate") or "",
            fetched_at=datetime.now(timezone.utc).isoformat(),
            language=raw.get("language") or "en",
            country=(raw.get("country") or [None])[0] if isinstance(raw.get("country"), list) else raw.get("country"),
            provider_name="newsdata",
            provider_article_id=url or None,
        )

    def _extract_domain(self, url: str) -> Optional[str]:
        if not url:
            return None
        try:
            from urllib.parse import urlparse
            return urlparse(url).netloc or None
        except Exception:
            return None
