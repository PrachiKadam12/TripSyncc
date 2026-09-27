"""
News Normalizer — converts provider-specific responses into TripSyncNewsArticle.
All provider-specific field mapping happens HERE and nowhere else.
"""
import hashlib
from datetime import datetime, timezone
from typing import Optional
from .types import TripSyncNewsArticle


def normalize_newsapi_article(raw: dict, provider_name: str = "newsapi") -> TripSyncNewsArticle:
    """
    Normalize a NewsAPI article into TripSyncNewsArticle.
    All NewsAPI-specific field names are handled here.
    """
    title = raw.get("title") or "Untitled"
    url = raw.get("url") or ""
    published = raw.get("publishedAt") or ""
    source = raw.get("source") or {}

    # Generate stable ID
    article_id = hashlib.md5(f"{provider_name}:{url or title}".encode()).hexdigest()[:16]

    return TripSyncNewsArticle(
        id=article_id,
        title=title,
        summary=raw.get("description") or None,
        url=url,
        image_url=raw.get("urlToImage") or None,
        source_id=source.get("id") or None,
        source_name=source.get("name") or "Unknown",
        source_domain=_extract_domain(url),
        published_at=published,
        fetched_at=datetime.now(timezone.utc).isoformat(),
        language=raw.get("language") or "en",
        country=raw.get("country") or None,
        provider_name=provider_name,
        provider_article_id=raw.get("url") or None,
    )


def normalize_gnews_article(raw: dict, provider_name: str = "gnews") -> TripSyncNewsArticle:
    """Normalize a GNews article into TripSyncNewsArticle."""
    title = raw.get("title") or "Untitled"
    url = raw.get("url") or ""
    published = raw.get("publishedAt") or ""
    source = raw.get("source") or {}

    article_id = hashlib.md5(f"{provider_name}:{url or title}".encode()).hexdigest()[:16]

    return TripSyncNewsArticle(
        id=article_id,
        title=title,
        summary=raw.get("description") or raw.get("content") or None,
        url=url,
        image_url=raw.get("image") or None,
        source_id=None,
        source_name=source.get("name") or "Unknown",
        source_domain=_extract_domain(url),
        published_at=published,
        fetched_at=datetime.now(timezone.utc).isoformat(),
        language="en",
        country=None,
        provider_name=provider_name,
        provider_article_id=url or None,
    )


def normalize_rss_item(raw: dict, provider_name: str = "rss") -> TripSyncNewsArticle:
    """Normalize an RSS item into TripSyncNewsArticle."""
    title = raw.get("title") or "Untitled"
    url = raw.get("link") or ""
    published = raw.get("pubDate") or raw.get("published") or ""

    article_id = hashlib.md5(f"{provider_name}:{url or title}".encode()).hexdigest()[:16]

    return TripSyncNewsArticle(
        id=article_id,
        title=title,
        summary=raw.get("description") or raw.get("summary") or None,
        url=url,
        image_url=raw.get("image") or raw.get("enclosure", {}).get("url") or None,
        source_id=None,
        source_name=raw.get("source") or "RSS Feed",
        source_domain=_extract_domain(url),
        published_at=published,
        fetched_at=datetime.now(timezone.utc).isoformat(),
        language="en",
        country=None,
        provider_name=provider_name,
        provider_article_id=url or None,
    )


def _extract_domain(url: str) -> Optional[str]:
    """Extract domain from URL."""
    if not url:
        return None
    try:
        from urllib.parse import urlparse
        return urlparse(url).netloc or None
    except Exception:
        return None
