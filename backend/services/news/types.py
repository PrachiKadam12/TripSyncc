"""
News Intelligence — Standard Types and Contracts

Every news provider MUST normalize into TripSyncNewsArticle.
Provider-specific response structures MUST NEVER leak beyond the adapter boundary.
"""
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime


@dataclass
class TripSyncNewsArticle:
    """Provider-independent normalized news article."""
    id: str
    title: str
    summary: Optional[str] = None
    url: str = ""
    image_url: Optional[str] = None
    source_id: Optional[str] = None
    source_name: str = ""
    source_domain: Optional[str] = None
    published_at: str = ""
    fetched_at: str = ""
    language: Optional[str] = None
    country: Optional[str] = None

    # Location relevance
    location_name: Optional[str] = None
    location_latitude: Optional[float] = None
    location_longitude: Optional[float] = None
    location_confidence: float = 0.0

    # Relevance scoring
    relevance_score: float = 0.0
    matched_location: Optional[str] = None
    matched_keywords: list = field(default_factory=list)
    relevance_reasons: list = field(default_factory=list)

    # Disruption classification
    is_disruption: bool = False
    disruption_type: str = "OTHER"
    disruption_severity: str = "LOW"
    disruption_confidence: float = 0.0
    disruption_impacts: list = field(default_factory=list)
    disruption_reasons: list = field(default_factory=list)

    # Impact score (0-100)
    impact_score: float = 0.0
    impact_reasons: list = field(default_factory=list)

    # Provider metadata
    provider_name: str = ""
    provider_article_id: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "summary": self.summary,
            "url": self.url,
            "imageUrl": self.image_url,
            "source": {
                "id": self.source_id,
                "name": self.source_name,
                "domain": self.source_domain,
            },
            "publishedAt": self.published_at,
            "fetchedAt": self.fetched_at,
            "language": self.language,
            "country": self.country,
            "location": {
                "name": self.location_name,
                "latitude": self.location_latitude,
                "longitude": self.location_longitude,
                "confidence": self.location_confidence,
            },
            "relevance": {
                "score": self.relevance_score,
                "matchedLocation": self.matched_location,
                "matchedKeywords": self.matched_keywords,
                "reasons": self.relevance_reasons,
            },
            "disruption": {
                "isDisruption": self.is_disruption,
                "type": self.disruption_type,
                "severity": self.disruption_severity,
                "confidence": self.disruption_confidence,
                "impacts": self.disruption_impacts,
                "reasons": self.disruption_reasons,
            },
            "impactScore": self.impact_score,
            "impactReasons": self.impact_reasons,
            "provider": {
                "name": self.provider_name,
                "articleId": self.provider_article_id,
            },
        }


@dataclass
class NewsProviderStatus:
    """Provider health/status information."""
    provider: str
    status: str  # LIVE | CACHED | DEGRADED | UNAVAILABLE
    last_successful_fetch: Optional[str] = None
    cached: bool = False
    message: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "provider": self.provider,
            "status": self.status,
            "lastSuccessfulFetch": self.last_successful_fetch,
            "cached": self.cached,
            "message": self.message,
        }


@dataclass
class TripNewsResult:
    """Standardized response for trip news queries."""
    trip_id: str
    fetched_at: str
    source_status: str  # LIVE | CACHED | UNAVAILABLE
    provider: NewsProviderStatus
    articles: list = field(default_factory=list)
    summary: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "tripId": self.trip_id,
            "fetchedAt": self.fetched_at,
            "sourceStatus": self.source_status,
            "provider": self.provider.to_dict(),
            "articles": [a.to_dict() if isinstance(a, TripSyncNewsArticle) else a for a in self.articles],
            "summary": self.summary,
        }
