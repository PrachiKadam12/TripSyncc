"""
News Cache — lightweight in-memory cache for news articles.
Prevents repeated provider calls within the cache window.
"""
import time
import hashlib
from typing import Optional
from .types import TripSyncNewsArticle, NewsProviderStatus


class NewsCache:
    """Thread-safe in-memory cache for news results."""

    def __init__(self, ttl_seconds: int = 300):
        self._cache: dict[str, dict] = {}
        self._ttl = ttl_seconds
        self._last_successful_fetch: Optional[str] = None

    def _make_key(self, trip_id: str, query: str = "") -> str:
        raw = f"{trip_id}:{query}"
        return hashlib.md5(raw.encode()).hexdigest()

    def get(self, trip_id: str, query: str = "") -> Optional[list[TripSyncNewsArticle]]:
        key = self._make_key(trip_id, query)
        entry = self._cache.get(key)
        if entry and (time.time() - entry["stored_at"]) < self._ttl:
            return entry["articles"]
        return None

    def set(self, trip_id: str, articles: list[TripSyncNewsArticle], query: str = ""):
        key = self._make_key(trip_id, query)
        self._cache[key] = {
            "articles": articles,
            "stored_at": time.time(),
        }
        self._last_successful_fetch = articles[0].fetched_at if articles else None

    def get_status(self, trip_id: str, query: str = "") -> NewsProviderStatus:
        key = self._make_key(trip_id, query)
        entry = self._cache.get(key)
        is_cached = entry is not None and (time.time() - entry["stored_at"]) < self._ttl
        return NewsProviderStatus(
            provider="newsapi",
            status="CACHED" if is_cached else "UNAVAILABLE",
            last_successful_fetch=self._last_successful_fetch,
            cached=is_cached,
        )

    def clear(self):
        self._cache.clear()
        self._last_successful_fetch = None


# Global cache instance
news_cache = NewsCache(ttl_seconds=300)  # 5 minutes
