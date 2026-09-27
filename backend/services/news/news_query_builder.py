"""
News Query Builder — generates disruption-focused queries from actual trip locations.
No hardcoded locations — everything comes from the user's trip data.
"""

# Query categories with templates
QUERY_CATEGORIES = {
    "weather": [
        "{location} heavy rain",
        "{location} rainfall",
        "{location} storm",
        "{location} cyclone",
        "{location} flooding",
        "{location} snowfall",
    ],
    "transport": [
        "{location} airport disruption",
        "{location} flight delay",
        "{location} flight cancellation",
        "{location} railway disruption",
        "{location} train cancellation",
        "{location} road closure",
        "{location} highway closure",
        "{location} traffic disruption",
    ],
    "disaster": [
        "{location} landslide",
        "{location} flood",
        "{location} earthquake",
    ],
    "public": [
        "{location} strike",
        "{location} protest",
        "{location} transport disruption",
        "{location} power outage",
    ],
}


def build_trip_news_queries(
    trip_locations: list[dict],
    *,
    categories: Optional[list[str]] = None,
    max_queries: int = 20,
) -> list[str]:
    """
    Generate disruption-focused news queries from trip locations.

    Args:
        trip_locations: List of {name, city, state, aliases, airports} dicts
        categories: Which query categories to include (default: all)
        max_queries: Maximum total queries to return

    Returns:
        Deduplicated list of query strings
    """
    if categories is None:
        categories = list(QUERY_CATEGORIES.keys())

    queries: list[str] = []
    seen: set[str] = set()

    for loc in trip_locations:
        location_name = loc.get("name") or loc.get("city") or ""
        if not location_name:
            continue

        for category in categories:
            templates = QUERY_CATEGORIES.get(category, [])
            for template in templates:
                query = template.format(location=location_name)
                normalized = query.lower().strip()
                if normalized not in seen:
                    seen.add(normalized)
                    queries.append(query)

        # Also add aliases as location sources
        for alias in (loc.get("aliases") or []):
            if len(queries) >= max_queries:
                break
            for category in categories[:2]:  # Only weather + transport for aliases
                templates = QUERY_CATEGORIES.get(category, [])
                for template in templates[:2]:  # Limit per alias
                    query = template.format(location=alias)
                    normalized = query.lower().strip()
                    if normalized not in seen:
                        seen.add(normalized)
                        queries.append(query)

    return queries[:max_queries]
