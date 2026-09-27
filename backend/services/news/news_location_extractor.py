"""
News Location Extract — extracts normalized location context from actual trip data.
Used to generate relevant news queries and calculate article relevance.
"""

# Major Indian transport hubs and their codes
TRANSPORT_HUBS = {
    "mumbai": {"airports": ["BOM", "Mumbai Airport"], "aliases": ["Bombay", "Maharashtra"]},
    "delhi": {"airports": ["DEL", "Delhi Airport", "IGI"], "aliases": ["New Delhi", "NCR"]},
    "manali": {"airports": ["KUU", "Bhuntar Airport"], "aliases": ["Kullu-Manali", "Kullu", "Himachal Pradesh"]},
    "bengaluru": {"airports": ["BLR", "Bangalore Airport"], "aliases": ["Bangalore", "Karnataka"]},
    "chennai": {"airports": ["MAA", "Chennai Airport"], "aliases": ["Madras", "Tamil Nadu"]},
    "kolkata": {"airports": ["CCU", "Kolkata Airport"], "aliases": ["Calcutta", "West Bengal"]},
    "hyderabad": {"airports": ["HYD", "Hyderabad Airport"], "aliases": ["Telangana"]},
    "pune": {"airports": ["PNQ", "Pune Airport"], "aliases": ["Maharashtra"]},
    "ahmedabad": {"airports": ["AMD", "Ahmedabad Airport"], "aliases": ["Gujarat"]},
    "jaipur": {"airports": ["JAI", "Jaipur Airport"], "aliases": ["Rajasthan"]},
    "lucknow": {"airports": ["LKO", "Lucknow Airport"], "aliases": ["Uttar Pradesh"]},
    "goa": {"airports": ["GOI", "Goa Airport", "Dabolim"], "aliases": ["Goa"]},
    "udaipur": {"airports": ["UDR", "Udaipur Airport"], "aliases": ["Rajasthan"]},
    "srinagar": {"airports": ["SXR", "Srinagar Airport"], "aliases": ["Jammu and Kashmir"]},
    "leh": {"airports": ["IXL", "Leh Airport"], "aliases": ["Ladakh"]},
    "chandigarh": {"airports": ["IXC", "Chandigarh Airport"], "aliases": ["Punjab", "Haryana"]},
    "shimla": {"airports": ["SLV", "Shimla Airport"], "aliases": ["Himachal Pradesh"]},
    "kullu": {"airports": ["KUU", "Bhuntar Airport"], "aliases": ["Manali", "Himachal Pradesh"]},
    "guwahati": {"airports": ["GAU", "Guwahati Airport"], "aliases": ["Assam"]},
    "indore": {"airports": ["IDR", "Indore Airport"], "aliases": ["Madhya Pradesh"]},
    "bhopal": {"airports": ["BHO", "Bhopal Airport"], "aliases": ["Madhya Pradesh"]},
    "nagpur": {"airports": ["NAG", "Nagpur Airport"], "aliases": ["Maharashtra"]},
    "coimbatore": {"airports": ["CJB", "Coimbatore Airport"], "aliases": ["Tamil Nadu"]},
    "kochi": {"airports": ["COK", "Kochi Airport"], "aliases": ["Cochin", "Kerala"]},
    "trivandrum": {"airports": ["TRV", "Thiruvananthapuram Airport"], "aliases": ["Kerala"]},
}


def get_trip_news_locations(trip) -> list[dict]:
    """
    Extract normalized location context from actual trip data.

    Args:
        trip: Trip object from Supabase with route, origin_city, destination_city,
              bookings, itinerary_items

    Returns:
        List of location dicts with name, city, state, country, aliases,
        airports, latitude, longitude, is_origin, is_destination
    """
    locations: list[dict] = []
    seen_names: set[str] = set()

    def add_location(name: str, is_origin: bool = False, is_destination: bool = False):
        if not name:
            return
        normalized = name.strip().lower()
        if normalized in seen_names:
            return
        seen_names.add(normalized)

        hub_info = TRANSPORT_HUBS.get(normalized, {})
        location = {
            "name": name,
            "city": name,
            "state": "",
            "country": "IN",
            "aliases": hub_info.get("aliases", []),
            "airports": hub_info.get("airports", []),
            "latitude": None,
            "longitude": None,
            "is_origin": is_origin,
            "is_destination": is_destination,
        }
        locations.append(location)

    # Extract from trip route
    if trip:
        route = trip.get("route") or []
        if isinstance(route, list):
            for i, city in enumerate(route):
                if isinstance(city, str):
                    add_location(city, is_origin=(i == 0), is_destination=(i == len(route) - 1))

        # Extract from origin/destination cities
        origin = trip.get("origin_city") or trip.get("origin")
        dest = trip.get("destination_city") or trip.get("destination")
        if origin:
            add_location(origin, is_origin=True)
        if dest:
            add_location(dest, is_destination=True)

        # Extract from bookings
        bookings = trip.get("bookings") or []
        for booking in bookings:
            origin_name = booking.get("origin_name") or booking.get("origin")
            dest_name = booking.get("destination_name") or booking.get("destination")
            if origin_name:
                add_location(origin_name)
            if dest_name:
                add_location(dest_name)

        # Extract from itinerary items
        items = trip.get("itinerary_items") or []
        for item in items:
            loc = item.get("location")
            if loc:
                add_location(loc)
            origin_name = item.get("origin_name")
            dest_name = item.get("destination_name")
            if origin_name:
                add_location(origin_name)
            if dest_name:
                add_location(dest_name)

    return locations
