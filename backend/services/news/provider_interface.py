"""
News Provider Interface — the contract every provider must implement.

To add a new provider:
1. Create a class that implements NewsProvider
2. Implement search(), get_latest(), health_check(), get_provider_name()
3. Register in news_service.py
4. No frontend changes required
"""
from abc import ABC, abstractmethod
from typing import Optional
from .types import TripSyncNewsArticle, NewsProviderStatus


class NewsProvider(ABC):
    """Abstract base class for all news providers."""

    @abstractmethod
    async def search(
        self,
        query: str,
        *,
        language: str = "en",
        country: Optional[str] = None,
        from_hours_ago: int = 24,
        max_results: int = 20,
    ) -> list[TripSyncNewsArticle]:
        """
        Search for news articles matching the query.

        Args:
            query: Search query string
            language: ISO 639-1 language code
            country: ISO 3166-1 alpha-2 country code
            from_hours_ago: Only return articles from last N hours
            max_results: Maximum articles to return

        Returns:
            List of normalized TripSyncNewsArticle objects
        """
        pass

    @abstractmethod
    async def get_latest(
        self,
        *,
        language: str = "en",
        country: Optional[str] = None,
        max_results: int = 20,
    ) -> list[TripSyncNewsArticle]:
        """Get latest news articles."""
        pass

    @abstractmethod
    async def health_check(self) -> NewsProviderStatus:
        """Check provider health/status."""
        pass

    @abstractmethod
    def get_provider_name(self) -> str:
        """Return the provider name."""
        pass
