"""
News Relevance Engine — deterministic location matching and relevance scoring.
Calculates how relevant a news article is to the user's actual trip locations.
"""
import re
from typing import Optional
from .types import TripSyncNewsArticle


# Location confidence levels
CONFIDENCE_EXACT_DESTINATION = 1.0
CONFIDENCE_EXACT_AIRPORT = 0.9
CONFIDENCE_EXACT_CITY = 0.8
CONFIDENCE_STATE_REGION = 0.7
CONFIDENCE_NEARBY = 0.5
CONFIDENCE_WEAK = 0.2
CONFIDENCE_UNRELATED = 0.0


def calculate_location_relevance(
    article: TripSyncNewsArticle,
    trip_locations: list[dict],
) -> TripSyncNewsArticle:
    """
    Calculate location relevance for an article against trip locations.

    Args:
        article: The normalized news article
        trip_locations: List of {name, city, state, country, aliases, airports, latitude, longitude}

    Returns:
        Article with updated relevance fields
    """
    text = f"{article.title} {article.summary or ''}".lower()
    best_match = None
    best_confidence = 0.0
    matched_keywords = []
    reasons = []

    for loc in trip_locations:
        loc_name = (loc.get("name") or loc.get("city") or "").lower()
        state = (loc.get("state") or "").lower()
        country = (loc.get("country") or "").lower()
        aliases = [a.lower() for a in (loc.get("aliases") or [])]
        airports = [a.lower() for a in (loc.get("airports") or [])]

        # Check exact city/name match
        if loc_name and loc_name in text:
            confidence = CONFIDENCE_EXACT_CITY
            if loc.get("is_destination"):
                confidence = CONFIDENCE_EXACT_DESTINATION
            elif loc.get("is_origin"):
                confidence = CONFIDENCE_EXACT_CITY

            if confidence > best_confidence:
                best_confidence = confidence
                best_match = loc.get("name") or loc.get("city")
                matched_keywords.append(loc_name)
                reasons.append(f"Directly mentions {loc.get('name') or loc.get('city')}")

        # Check airport codes
        for airport in airports:
            if airport and airport in text:
                if CONFIDENCE_EXACT_AIRPORT > best_confidence:
                    best_confidence = CONFIDENCE_EXACT_AIRPORT
                    best_match = loc.get("name") or loc.get("city")
                    matched_keywords.append(airport)
                    reasons.append(f"Mentions airport: {airport}")

        # Check aliases
        for alias in aliases:
            if alias and alias in text:
                if CONFIDENCE_EXACT_CITY > best_confidence:
                    best_confidence = CONFIDENCE_EXACT_CITY
                    best_match = loc.get("name") or loc.get("city")
                    matched_keywords.append(alias)
                    reasons.append(f"Mentions location alias: {alias}")

        # Check state/region match
        if state and state in text:
            if CONFIDENCE_STATE_REGION > best_confidence:
                best_confidence = CONFIDENCE_STATE_REGION
                best_match = loc.get("name") or loc.get("city")
                matched_keywords.append(state)
                reasons.append(f"Mentions state/region: {state}")

        # Check country match (weak)
        if country and country in text and best_confidence < CONFIDENCE_WEAK:
            best_confidence = CONFIDENCE_WEAK
            best_match = loc.get("name") or loc.get("city")
            matched_keywords.append(country)
            reasons.append(f"Mentions country: {country}")

    # Update article with relevance info
    article.location_name = best_match
    article.location_confidence = best_confidence
    article.matched_location = best_match
    article.matched_keywords = list(set(matched_keywords))
    article.relevance_reasons = reasons
    article.relevance_score = best_confidence

    return article
