import logging
from typing import Optional, Dict, Any, List
from config import settings

logger = logging.getLogger("tripsync.database")

supabase_client: Optional[Any] = None

# Initialize Supabase client if valid credentials exist
if settings.SUPABASE_URL and not settings.SUPABASE_URL.startswith("https://your-project") and settings.SUPABASE_SERVICE_ROLE_KEY:
    try:
        from supabase import create_client, Client
        supabase_client: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
        logger.info("Successfully connected to Supabase PostgreSQL Database")
    except Exception as e:
        logger.warning(f"Could not initialize Supabase client: {e}. Falling back to default data store.")
else:
    logger.info("Supabase credentials unconfigured or default placeholder. Operating in fallback data mode.")

# Demo Seed Data Fallback Store (Matches schema.sql and demoTrip.js)
DEMO_TRIP_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"

DEMO_PROFILE = {
    "id": "tanvi-user-id",
    "username": "tanvi",
    "full_name": "Tanvi",
    "home_city": "Mumbai"
}

DEMO_TRIP = {
    "id": DEMO_TRIP_ID,
    "title": "Mumbai → Delhi → Manali",
    "origin": "Mumbai",
    "destination": "Manali",
    "route": ["Mumbai", "Delhi", "Manali"],
    "start_date": "2026-09-12",
    "end_date": "2026-09-18",
    "dates_label": "12 – 18 Sep 2026",
    "status": "normal",
    "travelers_count": 5
}

DEMO_MEMBERS = [
    {"id": "m1", "trip_id": DEMO_TRIP_ID, "name": "Tanvi", "member_code": "tanvi", "role": "Lead Traveler", "affected": True, "note": "On the cancelled flight — needs a recovery plan"},
    {"id": "m2", "trip_id": DEMO_TRIP_ID, "name": "Aisha", "member_code": "aisha", "role": "Traveler", "affected": False, "note": None},
    {"id": "m3", "trip_id": DEMO_TRIP_ID, "name": "Rahul", "member_code": "rahul", "role": "Traveler", "affected": False, "note": None},
    {"id": "m4", "trip_id": DEMO_TRIP_ID, "name": "Riya", "member_code": "riya", "role": "Traveler", "affected": False, "note": None},
    {"id": "m5", "trip_id": DEMO_TRIP_ID, "name": "Karan", "member_code": "karan", "role": "Traveler", "affected": False, "note": None}
]

DEMO_BOOKINGS = [
    {
        "id": "b1",
        "trip_id": DEMO_TRIP_ID,
        "booking_key": "outboundFlight",
        "type": "flight",
        "label": "Air India AI-123",
        "subtitle": "Mumbai → Delhi",
        "origin": "Mumbai",
        "destination": "Delhi",
        "location": "Delhi Airport T3",
        "carrier_or_provider": "Air India",
        "pnr": "AI9X4K2",
        "booking_date": "2026-09-12",
        "booking_time": "8:30 AM",
        "price": 4200.00,
        "status": "confirmed",
        "refund_potential": 0.00,
        "links": [{"label": "Air India · manage PNR", "url": "https://www.airindia.in/"}]
    },
    {
        "id": "b2",
        "trip_id": DEMO_TRIP_ID,
        "booking_key": "transfer",
        "type": "transfer",
        "label": "Delhi Airport → Hotel",
        "subtitle": "Airport transfer",
        "origin": "Delhi Airport (T3)",
        "destination": "Interstate Bus Terminus → Manali road",
        "location": "Delhi",
        "carrier_or_provider": "Uber Intercity",
        "pnr": None,
        "booking_date": "2026-09-12",
        "booking_time": "10:30 AM",
        "price": 1200.00,
        "status": "confirmed",
        "refund_potential": 0.00,
        "links": [{"label": "Book cab on Uber", "url": "https://www.uber.com/"}]
    },
    {
        "id": "b3",
        "trip_id": DEMO_TRIP_ID,
        "booking_key": "hotel",
        "type": "hotel",
        "label": "Mountain View Residency",
        "subtitle": "Manali · Old Manali Road",
        "origin": None,
        "destination": None,
        "location": "Manali",
        "carrier_or_provider": "Mountain View Residency",
        "pnr": None,
        "booking_date": "2026-09-12",
        "booking_time": "2:00 PM",
        "price": 18000.00,
        "status": "confirmed",
        "refund_potential": 6500.00,
        "links": [
            {"label": "View on MakeMyTrip", "url": "https://www.makemytrip.com/"},
            {"label": "View on Booking.com", "url": "https://www.booking.com/"}
        ]
    },
    {
        "id": "b4",
        "trip_id": DEMO_TRIP_ID,
        "booking_key": "activity",
        "type": "activity",
        "label": "Solang Valley Adventure",
        "subtitle": "Paragliding + zipline",
        "origin": None,
        "destination": None,
        "location": "Solang Valley, Manali",
        "carrier_or_provider": "Thrillophilia",
        "pnr": None,
        "booking_date": "2026-09-14",
        "booking_time": "9:00 AM",
        "price": 2500.00,
        "status": "confirmed",
        "refund_potential": 0.00,
        "links": [{"label": "Book on Thrillophilia", "url": "https://www.thrillophilia.com/"}]
    },
    {
        "id": "b5",
        "trip_id": DEMO_TRIP_ID,
        "booking_key": "returnFlight",
        "type": "flight",
        "label": "Air India AI-224",
        "subtitle": "Delhi → Mumbai",
        "origin": "Delhi",
        "destination": "Mumbai",
        "location": "Delhi Airport T3",
        "carrier_or_provider": "Air India",
        "pnr": "AI7H3Q1",
        "booking_date": "2026-09-18",
        "booking_time": "4:00 PM",
        "price": 4800.00,
        "status": "confirmed",
        "refund_potential": 0.00,
        "links": [{"label": "Air India · manage PNR", "url": "https://www.airindia.in/"}]
    }
]

DEMO_ITINERARY = [
    {
        "id": "i1",
        "trip_id": DEMO_TRIP_ID,
        "title": "Outbound Flight AI-123",
        "type": "flight",
        "location": "Mumbai (BOM) → Delhi (DEL)",
        "start_time": "2026-09-12T08:30:00+05:30",
        "end_time": "2026-09-12T10:30:00+05:30",
        "status": "scheduled",
        "booking_ref": "AI9X4K2",
        "sort_order": 1
    },
    {
        "id": "i2",
        "trip_id": DEMO_TRIP_ID,
        "title": "Airport Transfer to Bus Terminal",
        "type": "transfer",
        "location": "Delhi Airport (T3) → Kashmiri Gate ISBT",
        "start_time": "2026-09-12T10:45:00+05:30",
        "end_time": "2026-09-12T11:45:00+05:30",
        "status": "scheduled",
        "booking_ref": "UBER-9821",
        "sort_order": 2
    },
    {
        "id": "i3",
        "trip_id": DEMO_TRIP_ID,
        "title": "Overnight Volvo Bus to Manali",
        "type": "bus",
        "location": "Delhi ISBT → Manali Bus Stand",
        "start_time": "2026-09-12T19:00:00+05:30",
        "end_time": "2026-09-13T08:00:00+05:30",
        "status": "scheduled",
        "booking_ref": "HRTC-7819",
        "sort_order": 3
    },
    {
        "id": "i4",
        "trip_id": DEMO_TRIP_ID,
        "title": "Check-in Mountain View Residency",
        "type": "hotel",
        "location": "Old Manali Road, Manali",
        "start_time": "2026-09-13T12:00:00+05:30",
        "end_time": "2026-09-17T11:00:00+05:30",
        "status": "scheduled",
        "booking_ref": "MVR-2026",
        "sort_order": 4
    },
    {
        "id": "i5",
        "trip_id": DEMO_TRIP_ID,
        "title": "Solang Valley Adventure Sports",
        "type": "activity",
        "location": "Solang Valley, Manali",
        "start_time": "2026-09-14T09:00:00+05:30",
        "end_time": "2026-09-14T14:00:00+05:30",
        "status": "scheduled",
        "booking_ref": "THRILL-4410",
        "sort_order": 5
    }
]

DEMO_BUDGET = {
    "trip_id": DEMO_TRIP_ID,
    "total_budget": 40000.00,
    "total_spent": 31200.00,
    "at_risk": 6500.00,
    "remaining": 8800.00
}

DEMO_EXPENSES = [
    {"id": "e1", "trip_id": DEMO_TRIP_ID, "description": "Outbound Flight (Air India AI-123)", "category": "flight", "amount": 4200.00, "paid_by": "Tanvi", "date": "2026-09-01"},
    {"id": "e2", "trip_id": DEMO_TRIP_ID, "description": "Mountain View Residency (Advance)", "category": "hotel", "amount": 18000.00, "paid_by": "Tanvi", "date": "2026-09-02"},
    {"id": "e3", "trip_id": DEMO_TRIP_ID, "description": "Delhi Airport Transfer", "category": "transfer", "amount": 1200.00, "paid_by": "Aisha", "date": "2026-09-05"},
    {"id": "e4", "trip_id": DEMO_TRIP_ID, "description": "Solang Adventure Booking", "category": "activity", "amount": 2500.00, "paid_by": "Rahul", "date": "2026-09-06"},
    {"id": "e5", "trip_id": DEMO_TRIP_ID, "description": "Return Flight (Air India AI-224)", "category": "flight", "amount": 4800.00, "paid_by": "Tanvi", "date": "2026-09-08"}
]

DEMO_DOCUMENTS = [
    {"id": "d1", "trip_id": DEMO_TRIP_ID, "doc_key": "doc-flight", "title": "Air India E-Ticket (AI-123)", "kind": "flight", "meta": "BOM → DEL · PNR AI9X4K2", "is_offline": True, "relevant_on_disruption": True},
    {"id": "d2", "trip_id": DEMO_TRIP_ID, "doc_key": "doc-hotel", "title": "Hotel Voucher — Mountain View", "kind": "hotel", "meta": "Check-in 12 Sep · Old Manali", "is_offline": True, "relevant_on_disruption": True},
    {"id": "d3", "trip_id": DEMO_TRIP_ID, "doc_key": "doc-insurance", "title": "Travel Insurance Policy", "kind": "insurance", "meta": "Policy #TS-99218-IN · Reliance General", "is_offline": True, "relevant_on_disruption": True},
    {"id": "d4", "trip_id": DEMO_TRIP_ID, "doc_key": "doc-passport", "title": "Government Photo ID / Passport", "kind": "passport", "meta": "Tanvi · Verified on device", "is_offline": True, "relevant_on_disruption": True}
]
