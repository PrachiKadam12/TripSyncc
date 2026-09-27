"""Base provider with common functionality."""
import httpx
from typing import Optional
from ..types import TripSyncNewsArticle, NewsProviderStatus


class BaseNewsProvider:
    """Base class for news providers with common timeout/retry logic."""

    def __init__(self, api_key: Optional[str] = None, timeout: int = 10):
        self._api_key = api_key
        self._timeout = timeout

    async def _fetch(self, url: str, params: dict = None, headers: dict = None) -> dict:
        """Make HTTP GET request with timeout."""
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            res = await client.get(url, params=params, headers=headers)
            res.raise_for_status()
            return res.json()

    def _handle_error(self, err: Exception) -> list[TripSyncNewsArticle]:
        """Return empty list on error — never raise to caller."""
        return []

    def _handle_status_error(self, provider_name: str) -> NewsProviderStatus:
        return NewsProviderStatus(
            provider=provider_name,
            status="UNAVAILABLE",
            message=str(self._last_error),
        )

    _last_error: Optional[str] = None
