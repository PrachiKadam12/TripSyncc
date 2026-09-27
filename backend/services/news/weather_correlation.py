"""
Weather + News Correlation Engine.
Connects live Open-Meteo weather data with news signals to detect
corroborated weather disruptions.
"""
from .types import TripSyncNewsArticle


def correlate_weather_news(
    articles: list[TripSyncNewsArticle],
    weather_data: dict,
) -> list[dict]:
    """
    Correlate news articles with live weather data.

    Args:
        articles: Classified news articles
        weather_data: {location_name: {risk: {level, score, reasons}, current: {...}}}

    Returns:
        List of correlation results for articles that match weather signals
    """
    correlations = []

    for article in articles:
        if not article.matched_location:
            continue

        loc_name = article.matched_location.lower()
        weather = weather_data.get(loc_name) or weather_data.get(article.matched_location)

        if not weather:
            continue

        weather_risk = weather.get("risk", {})
        weather_level = weather_risk.get("level", "LOW")
        news_level = article.disruption_severity

        # Check if both signals agree
        risk_levels = {"LOW": 0, "MODERATE": 1, "HIGH": 2, "SEVERE": 3}
        weather_val = risk_levels.get(weather_level, 0)
        news_val = risk_levels.get(news_level, 0)

        if weather_val >= 2 and news_val >= 2:  # Both HIGH or above
            confidence = min(1.0, (weather_val + news_val) / 6 + 0.3)
            correlations.append({
                "type": "CORROBORATED_WEATHER_DISRUPTION",
                "location": article.matched_location,
                "weatherRisk": weather_level,
                "newsRisk": news_level,
                "confidence": round(confidence, 2),
                "reasons": [
                    f"Live weather indicates {weather_level.lower()} risk at {article.matched_location}",
                    f"Recent news reports {article.disruption_type.replace('_', ' ').lower()}",
                    "Both signals refer to the same trip location",
                ],
                "articleId": article.id,
            })
        elif weather_val >= 1 and news_val >= 1:  # Both MODERATE or above
            confidence = min(1.0, (weather_val + news_val) / 6 + 0.2)
            correlations.append({
                "type": "WEATHER_NEWS_SIGNAL",
                "location": article.matched_location,
                "weatherRisk": weather_level,
                "newsRisk": news_level,
                "confidence": round(confidence, 2),
                "reasons": [
                    f"Weather risk at {article.matched_location}: {weather_level}",
                    f"News disruption level: {news_level}",
                ],
                "articleId": article.id,
            })

    return correlations
