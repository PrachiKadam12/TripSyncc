"""
News Disruption Classifier — deterministic classification of news articles.
Classifies articles by disruption type, severity, and travel impact.
"""
import re
from .types import TripSyncNewsArticle


# Disruption type keywords
DISRUPTION_KEYWORDS = {
    "WEATHER": ["weather", "rain", "rainfall", "storm", "cyclone", "monsoon", "drought", "heat wave", "cold wave", "temperature"],
    "FLOOD": ["flood", "flooding", "inundation", "waterlogged", "flash flood"],
    "LANDSLIDE": ["landslide", "land slip", "rockfall", "mudslide", "debris flow"],
    "CYCLONE": ["cyclone", "hurricane", "typhoon", "tropical storm"],
    "STORM": ["storm", "thunderstorm", "lightning", "gale", "squall"],
    "EARTHQUAKE": ["earthquake", "quake", "tremor", "seismic"],
    "FIRE": ["fire", "wildfire", "forest fire", "blaze"],
    "ROAD_CLOSURE": ["road closed", "road closure", "highway closed", "road blocked", "roadblock", "road shut"],
    "ROAD_DISRUPTION": ["road disruption", "traffic jam", "traffic congestion", "road accident", "road damage", "road repair"],
    "TRAFFIC": ["traffic", "congestion", "gridlock", "snail pace", "slow moving"],
    "AIRPORT": ["airport", "airstrip", "airfield", "aviation"],
    "FLIGHT": ["flight", "airline", "aircraft", "plane", "aviation", "departure", "arrival"],
    "RAILWAY": ["railway", "rail", "train", "locomotive", "railtrack", "rail line"],
    "TRAIN": ["train", "express", "passenger train", "freight train", "railway"],
    "PUBLIC_TRANSPORT": ["bus", "public transport", "metro", "subway", "tram", "cab", "taxi", "uber", "ola"],
    "STRIKE": ["strike", "bandh", "hartal", "protest", "demonstration", "agitation"],
    "PROTEST": ["protest", "demonstration", "rally", "march", "sit-in", "dharna"],
    "SECURITY": ["security", "terror", "attack", "threat", "alert", "suspicious", "bomb", "explosion"],
    "INFRASTRUCTURE": ["power outage", "blackout", "water supply", "bridge collapse", "building collapse", "infrastructure"],
}

# Severity keywords
SEVERITY_KEYWORDS = {
    "SEVERE": ["severe", "extreme", "catastrophic", "disastrous", "devastating", "deadly", "fatal", "critical", "emergency", "red alert"],
    "HIGH": ["heavy", "major", "significant", "serious", "intense", "strong", "high", "orange alert", "warning"],
    "MODERATE": ["moderate", "medium", "partial", "some", "light", "minor", "yellow alert", "advisory"],
    "LOW": ["low", "minimal", "slight", "mild", "normal", "clear", "calm"],
}

# Travel impact mapping
DISRUPTION_IMPACT_MAP = {
    "WEATHER": ["ROAD_TRAVEL", "FLIGHT", "TRANSFER", "ACTIVITY"],
    "FLOOD": ["ROAD_TRAVEL", "RAILWAY", "AIRPORT_ACCESS"],
    "LANDSLIDE": ["ROAD_TRAVEL", "TRANSFER"],
    "CYCLONE": ["FLIGHT", "RAILWAY", "ROAD_TRAVEL", "AIRPORT_ACCESS"],
    "STORM": ["FLIGHT", "ROAD_TRAVEL", "ACTIVITY"],
    "EARTHQUAKE": ["FLIGHT", "RAILWAY", "ROAD_TRAVEL", "AIRPORT_ACCESS", "HOTEL"],
    "FIRE": ["ROAD_TRAVEL", "ACTIVITY", "AIRPORT_ACCESS"],
    "ROAD_CLOSURE": ["ROAD_TRAVEL", "TRANSFER", "HOTEL_ARRIVAL"],
    "ROAD_DISRUPTION": ["ROAD_TRAVEL", "TRANSFER"],
    "TRAFFIC": ["ROAD_TRAVEL", "TRANSFER", "AIRPORT_ACCESS"],
    "AIRPORT": ["FLIGHT", "AIRPORT_ACCESS", "TRANSFER"],
    "FLIGHT": ["FLIGHT", "AIRPORT_ACCESS", "TRANSFER"],
    "RAILWAY": ["TRAIN", "GROUND_TRANSFER"],
    "TRAIN": ["TRAIN", "GROUND_TRANSFER"],
    "PUBLIC_TRANSPORT": ["GROUND_TRANSFER", "ROAD_TRAVEL"],
    "STRIKE": ["PUBLIC_TRANSPORT", "FLIGHT", "RAILWAY", "ROAD_TRAVEL"],
    "PROTEST": ["PUBLIC_TRANSPORT", "ROAD_TRAVEL", "TRANSFER"],
    "SECURITY": ["FLIGHT", "AIRPORT_ACCESS", "PUBLIC_TRANSPORT", "HOTEL"],
    "INFRASTRUCTURE": ["PUBLIC_TRANSPORT", "ROAD_TRAVEL", "HOTEL", "AIRPORT_ACCESS"],
    "OTHER": ["ROAD_TRAVEL"],
}


def classify_disruption(article: TripSyncNewsArticle) -> TripSyncNewsArticle:
    """
    Classify an article for disruption type, severity, and travel impact.
    Uses deterministic keyword matching.
    """
    text = f"{article.title} {article.summary or ''}".lower()

    # Determine disruption type
    best_type = "OTHER"
    best_type_score = 0

    for dtype, keywords in DISRUPTION_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in text)
        if score > best_type_score:
            best_type_score = score
            best_type = dtype

    # Determine severity
    best_severity = "LOW"
    best_severity_score = 0

    for severity, keywords in SEVERITY_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in text)
        if score > best_severity_score:
            best_severity_score = score
            best_severity = severity

    # Determine if this is actually a disruption
    is_disruption = best_type_score > 0 and best_type != "OTHER"

    # Get impacts for this disruption type
    impacts = DISRUPTION_IMPACT_MAP.get(best_type, ["ROAD_TRAVEL"])

    # Build reasons
    reasons = []
    if is_disruption:
        reasons.append(f"Classified as {best_type.replace('_', ' ').title()}")
        reasons.append(f"Severity: {best_severity}")
        if impacts:
            reasons.append(f"Potential impacts: {', '.join(i.replace('_', ' ').title() for i in impacts[:3])}")

    # Update article
    article.is_disruption = is_disruption
    article.disruption_type = best_type
    article.disruption_severity = best_severity
    article.disruption_confidence = min(1.0, best_type_score * 0.3)
    article.disruption_impacts = impacts
    article.disruption_reasons = reasons

    return article


def calculate_impact_score(article: TripSyncNewsArticle) -> TripSyncNewsArticle:
    """
    Calculate deterministic impact score (0-100).

    Weights:
    - Recency: 25
    - Location Match: 30
    - Travel Relevance: 25
    - Disruption Severity: 20
    """
    from datetime import datetime, timezone

    # Recency score (0-25)
    recency_score = 0
    try:
        if article.published_at:
            pub_date = datetime.fromisoformat(article.published_at.replace("Z", "+00:00"))
            now = datetime.now(timezone.utc)
            hours_ago = (now - pub_date).total_seconds() / 3600
            if hours_ago <= 6:
                recency_score = 25
            elif hours_ago <= 12:
                recency_score = 20
            elif hours_ago <= 24:
                recency_score = 15
            elif hours_ago <= 48:
                recency_score = 10
            else:
                recency_score = 5
    except Exception:
        recency_score = 10

    # Location match score (0-30)
    location_score = article.location_confidence * 30

    # Travel relevance score (0-25)
    relevance_score = 0
    if article.matched_keywords:
        relevance_score = min(25, len(article.matched_keywords) * 8)
    if article.relevance_score > 0.7:
        relevance_score = max(relevance_score, 20)

    # Disruption severity score (0-20)
    severity_scores = {"LOW": 5, "MODERATE": 10, "HIGH": 15, "SEVERE": 20}
    severity_score = severity_scores.get(article.disruption_severity, 5) if article.is_disruption else 0

    total_score = recency_score + location_score + relevance_score + severity_score

    # Build impact reasons
    impact_reasons = []
    if recency_score >= 20:
        impact_reasons.append("Published very recently")
    elif recency_score >= 15:
        impact_reasons.append("Published within last 24 hours")

    if article.location_confidence >= 0.8:
        impact_reasons.append("Directly mentions trip location")
    elif article.location_confidence >= 0.5:
        impact_reasons.append("Mentions nearby area")

    if article.is_disruption:
        impact_reasons.append(f"Reports {article.disruption_type.replace('_', ' ').lower()}")

    if article.disruption_impacts:
        impact_reasons.append(f"May affect: {', '.join(i.replace('_', ' ').lower() for i in article.disruption_impacts[:2])}")

    article.impact_score = min(100, total_score)
    article.impact_reasons = impact_reasons

    return article
