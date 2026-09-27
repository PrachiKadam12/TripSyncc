"""
News Deduplicator — removes duplicate articles from multiple sources.
Uses URL, title similarity, and publication timestamp for deduplication.
"""
import re
from difflib import SequenceMatcher
from typing import Optional
from .types import TripSyncNewsArticle


def deduplicate_articles(articles: list[TripSyncNewsArticle]) -> list[TripSyncNewsArticle]:
    """
    Remove duplicate articles, keeping the most complete version.

    Deduplication strategy:
    1. Canonical URL match
    2. Provider article ID match
    3. Normalized title match
    4. Title similarity (fuzzy)
    """
    seen_urls: set[str] = set()
    seen_ids: set[str] = set()
    seen_titles: set[str] = set()
    unique: list[TripSyncNewsArticle] = []

    for article in articles:
        # 1. URL-based dedup
        canonical_url = _canonicalize_url(article.url)
        if canonical_url and canonical_url in seen_urls:
            continue
        if canonical_url:
            seen_urls.add(canonical_url)

        # 2. Provider ID dedup
        provider_key = f"{article.provider_name}:{article.provider_article_id}"
        if article.provider_article_id and provider_key in seen_ids:
            continue
        if article.provider_article_id:
            seen_ids.add(provider_key)

        # 3. Normalized title dedup
        norm_title = _normalize_title(article.title)
        if norm_title in seen_titles:
            continue

        # 4. Fuzzy title similarity
        is_duplicate = False
        for existing in unique:
            existing_norm = _normalize_title(existing.title)
            similarity = SequenceMatcher(None, norm_title, existing_norm).ratio()
            if similarity > 0.85:
                is_duplicate = True
                # Keep the more complete version
                if _completeness_score(article) > _completeness_score(existing):
                    unique.remove(existing)
                    unique.append(article)
                break

        if not is_duplicate:
            seen_titles.add(norm_title)
            unique.append(article)

    return unique


def _canonicalize_url(url: str) -> Optional[str]:
    """Normalize URL for comparison."""
    if not url:
        return None
    url = url.strip().lower()
    url = re.sub(r"^https?://", "", url)
    url = re.sub(r"^www\.", "", url)
    url = url.rstrip("/")
    return url


def _normalize_title(title: str) -> str:
    """Normalize title for comparison."""
    return re.sub(r"[^\w\s]", "", title.lower()).strip()


def _completeness_score(article: TripSyncNewsArticle) -> int:
    """Score article completeness (higher = more complete)."""
    score = 0
    if article.summary:
        score += 2
    if article.image_url:
        score += 1
    if article.source_name and article.source_name != "Unknown":
        score += 1
    if article.published_at:
        score += 1
    return score
