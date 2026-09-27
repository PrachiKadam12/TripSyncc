"""
News Service — main orchestrator for trip-aware travel news.
Coordinates providers, caching, relevance, classification, and correlation.
"""
import logging
from datetime import datetime, timezone
from typing import Optional
from .types import TripSyncNewsArticle, NewsProviderStatus, TripNewsResult
from .news_cache import news_cache
from .news_query_builder import build_trip_news_queries
from .news_location_extractor import get_trip_news_locations
from .news_relevance import calculate_location_relevance
from .news_classifier import classify_disruption, calculate_impact_score
from .news_deduplicator import deduplicate_articles
from .providers.newsapi_provider import NewsApiProvider
from .providers.gnews_provider import GNewsProvider
from .providers.newsdata_provider import NewsDataProvider

logger = logging.getLogger("tripsync.service.news")


class NewsService:
    """Main news intelligence service."""

    def __init__(self):
        self._providers: list = []
        self._register_providers()

    def _register_providers(self):
        """Register available providers. Add new providers here."""
        self._providers = [
            NewsDataProvider(),
            NewsApiProvider(),
            GNewsProvider(),
        ]
        logger.info(f"Registered {len(self._providers)} news providers: {[p.get_provider_name() for p in self._providers]}")

    async def get_trip_news(
        self,
        trip_id: str,
        trip: Optional[dict] = None,
        *,
        hours: int = 24,
        limit: int = 20,
        disruption_type: Optional[str] = None,
        severity: Optional[str] = None,
        location: Optional[str] = None,
    ) -> TripNewsResult:
        """
        Get trip-aware travel news.

        Args:
            trip_id: Trip identifier
            trip: Trip object from Supabase (optional — will fetch if not provided)
            hours: Search window in hours
            limit: Maximum articles to return
            disruption_type: Filter by disruption type
            severity: Filter by severity
            location: Filter by location

        Returns:
            TripNewsResult with normalized articles
        """
        fetched_at = datetime.now(timezone.utc).isoformat()

        # Get trip data if not provided
        if trip is None:
            trip = await self._fetch_trip(trip_id)

        # Extract locations from actual trip
        trip_locations = get_trip_news_locations(trip)
        logger.info(f"Trip {trip_id}: extracted {len(trip_locations)} locations")

        # Check cache first
        cached = news_cache.get(trip_id)
        if cached:
            logger.info(f"Trip {trip_id}: returning {len(cached)} cached articles")
            return TripNewsResult(
                trip_id=trip_id,
                fetched_at=fetched_at,
                source_status="CACHED",
                provider=NewsProviderStatus(
                    provider=self._providers[0].get_provider_name() if self._providers else "none",
                    status="CACHED",
                    cached=True,
                ),
                articles=self._filter_articles(cached, disruption_type, severity, location),
                summary=self._build_summary(cached),
            )

        # Generate queries from trip locations
        queries = build_trip_news_queries(trip_locations, max_queries=15)
        logger.info(f"Trip {trip_id}: generated {len(queries)} queries")

        # Fetch from providers
        all_articles: list[TripSyncNewsArticle] = []
        provider_status = NewsProviderStatus(provider="none", status="UNAVAILABLE")

        for provider in self._providers:
            name = provider.get_provider_name()
            for query in queries:
                try:
                    articles = await provider.search(
                        query,
                        language="en",
                        country="in",
                        from_hours_ago=hours,
                        max_results=min(limit, 20),
                    )
                    all_articles.extend(articles)
                    if articles:
                        provider_status = NewsProviderStatus(
                            provider=name,
                            status="LIVE",
                            last_successful_fetch=datetime.now(timezone.utc).isoformat(),
                            cached=False,
                        )
                        logger.info(f"Trip {trip_id}: {name} returned {len(articles)} articles for '{query}'")
                except Exception as e:
                    logger.warning(f"Trip {trip_id}: provider {name} failed for '{query}': {e}")

        # If no live data, mark as unavailable
        if not all_articles and provider_status.status != "LIVE":
            provider_status.status = "UNAVAILABLE"
            provider_status.message = "No live news available from any provider"

        # Deduplicate
        unique_articles = deduplicate_articles(all_articles)
        logger.info(f"Trip {trip_id}: {len(all_articles)} -> {len(unique_articles)} after dedup")

        # Calculate relevance for each article
        for article in unique_articles:
            calculate_location_relevance(article, trip_locations)

        # Filter by relevance threshold
        relevant = [a for a in unique_articles if a.relevance_score >= 0.2]

        # Classify disruptions
        for article in relevant:
            classify_disruption(article)
            calculate_impact_score(article)

        # Sort by impact score (highest first)
        relevant.sort(key=lambda a: a.impact_score, reverse=True)

        # Apply filters
        filtered = self._filter_articles(relevant, disruption_type, severity, location)

        # Cache the results
        if filtered:
            news_cache.set(trip_id, filtered)

        # Build summary
        summary = self._build_summary(filtered)

        return TripNewsResult(
            trip_id=trip_id,
            fetched_at=fetched_at,
            source_status="LIVE" if provider_status.status == "LIVE" else "UNAVAILABLE",
            provider=provider_status,
            articles=filtered[:limit],
            summary=summary,
        )

    def _filter_articles(
        self,
        articles: list[TripSyncNewsArticle],
        disruption_type: Optional[str] = None,
        severity: Optional[str] = None,
        location: Optional[str] = None,
    ) -> list[TripSyncNewsArticle]:
        """Filter articles by type, severity, or location."""
        result = articles
        if disruption_type:
            result = [a for a in result if a.disruption_type == disruption_type]
        if severity:
            result = [a for a in result if a.disruption_severity == severity]
        if location:
            loc_lower = location.lower()
            result = [a for a in result if a.matched_location and loc_lower in a.matched_location.lower()]
        return result

    def _build_summary(self, articles: list[TripSyncNewsArticle]) -> dict:
        """Build summary statistics."""
        disruptions = [a for a in articles if a.is_disruption]
        high_risk = [a for a in articles if a.disruption_severity in ("HIGH", "SEVERE")]
        locations = set(a.matched_location for a in articles if a.matched_location)

        return {
            "total": len(articles),
            "disruptions": len(disruptions),
            "highRisk": len(high_risk),
            "locationsAffected": len(locations),
        }

    async def _fetch_trip(self, trip_id: str) -> Optional[dict]:
        """Fetch trip data from Supabase."""
        try:
            from database import supabase_client
            if supabase_client:
                res = supabase_client.table("trips").select("*").eq("id", trip_id).execute()
                if res.data:
                    return res.data[0]
        except Exception as e:
            logger.warning(f"Could not fetch trip {trip_id}: {e}")
        return None

    async def get_provider_status(self) -> list[NewsProviderStatus]:
        """Get health status of all providers."""
        statuses = []
        for provider in self._providers:
            try:
                status = await provider.health_check()
                statuses.append(status)
            except Exception as e:
                statuses.append(NewsProviderStatus(
                    provider=provider.get_provider_name(),
                    status="UNAVAILABLE",
                    message=str(e),
                ))
        return statuses


# Singleton instance
news_service = NewsService()
