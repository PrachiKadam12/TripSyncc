from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
import logging
from database import (
    supabase_client,
    DEMO_TRIP_ID,
    DEMO_PROFILE,
    DEMO_TRIP,
    DEMO_MEMBERS,
    DEMO_BOOKINGS,
    DEMO_ITINERARY,
    DEMO_BUDGET,
    DEMO_EXPENSES,
    DEMO_DOCUMENTS,
)
from schemas import (
    ProfileResponse,
    TripDetail,
    TripMember,
    Booking,
    ItineraryItem,
    BudgetSummary,
    ExpenseItem,
    DocumentItem,
    DashboardResponse,
)

logger = logging.getLogger("tripsync.router.dashboard")
router = APIRouter(prefix="/api", tags=["Dashboard"])

@router.get("/profile/me", response_model=ProfileResponse)
def get_profile_me():
    """Fetch current user profile details."""
    if supabase_client:
        try:
            res = supabase_client.table("profiles").select("*").limit(1).execute()
            if res.data and len(res.data) > 0:
                p = res.data[0]
                return ProfileResponse(
                    id=str(p.get("id")),
                    username=p.get("username", "tanvi"),
                    full_name=p.get("full_name", "Tanvi"),
                    home_city=p.get("home_city", "Mumbai")
                )
        except Exception as e:
            logger.error(f"Error fetching profile from Supabase: {e}")
    return ProfileResponse(**DEMO_PROFILE)

@router.get("/trips/current", response_model=TripDetail)
def get_current_trip():
    """Fetch active/current trip information."""
    if supabase_client:
        try:
            res = supabase_client.table("trips").select("*").eq("id", DEMO_TRIP_ID).execute()
            if res.data and len(res.data) > 0:
                t = res.data[0]
                return TripDetail(
                    id=str(t["id"]),
                    title=t["title"],
                    origin=t["origin"],
                    destination=t["destination"],
                    route=t["route"],
                    start_date=str(t["start_date"]),
                    end_date=str(t["end_date"]),
                    dates_label=t["dates_label"],
                    status=t["status"],
                    travelers_count=t["travelers_count"]
                )
        except Exception as e:
            logger.error(f"Error fetching current trip from Supabase: {e}")
    return TripDetail(**DEMO_TRIP)

@router.get("/trips/{trip_id}", response_model=TripDetail)
def get_trip_by_id(trip_id: str):
    """Fetch details of a specific trip by ID."""
    if supabase_client:
        try:
            res = supabase_client.table("trips").select("*").eq("id", trip_id).execute()
            if res.data and len(res.data) > 0:
                t = res.data[0]
                return TripDetail(
                    id=str(t["id"]),
                    title=t["title"],
                    origin=t["origin"],
                    destination=t["destination"],
                    route=t["route"],
                    start_date=str(t["start_date"]),
                    end_date=str(t["end_date"]),
                    dates_label=t["dates_label"],
                    status=t["status"],
                    travelers_count=t["travelers_count"]
                )
        except Exception as e:
            logger.error(f"Error fetching trip {trip_id} from Supabase: {e}")
    if trip_id == DEMO_TRIP_ID or trip_id == "current":
        return TripDetail(**DEMO_TRIP)
    raise HTTPException(status_code=404, detail="Trip not found")

@router.get("/trips/{trip_id}/members", response_model=List[TripMember])
def get_trip_members(trip_id: str):
    """Fetch travel group members for a trip."""
    if supabase_client:
        try:
            res = supabase_client.table("trip_members").select("*").eq("trip_id", trip_id).execute()
            if res.data:
                return [
                    TripMember(
                        id=str(m["id"]),
                        trip_id=str(m["trip_id"]),
                        name=m["name"],
                        member_code=m["member_code"],
                        role=m.get("role", "Traveler"),
                        affected=m.get("affected", False),
                        note=m.get("note")
                    )
                    for m in res.data
                ]
        except Exception as e:
            logger.error(f"Error fetching trip members from Supabase: {e}")
    return [TripMember(**m) for m in DEMO_MEMBERS]

@router.get("/trips/{trip_id}/itinerary", response_model=List[ItineraryItem])
def get_trip_itinerary(trip_id: str):
    """Fetch upcoming itinerary items for a trip."""
    if supabase_client:
        try:
            res = supabase_client.table("itinerary_items").select("*").eq("trip_id", trip_id).order("sort_order").execute()
            if res.data:
                return [
                    ItineraryItem(
                        id=str(i["id"]),
                        trip_id=str(i["trip_id"]),
                        title=i["title"],
                        type=i["type"],
                        location=i["location"],
                        start_time=str(i["start_time"]),
                        end_time=str(i["end_time"]) if i.get("end_time") else None,
                        status=i["status"],
                        booking_ref=i.get("booking_ref"),
                        sort_order=i.get("sort_order", 0)
                    )
                    for i in res.data
                ]
        except Exception as e:
            logger.error(f"Error fetching itinerary from Supabase: {e}")
    return [ItineraryItem(**i) for i in DEMO_ITINERARY]

@router.get("/trips/{trip_id}/itinerary/next", response_model=Optional[ItineraryItem])
def get_next_itinerary_event(trip_id: str):
    """Fetch the next upcoming chronological itinerary item."""
    itinerary = get_trip_itinerary(trip_id)
    if itinerary and len(itinerary) > 0:
        return itinerary[0]
    return None

@router.get("/trips/{trip_id}/bookings", response_model=List[Booking])
def get_trip_bookings(trip_id: str):
    """Fetch connected bookings for a trip."""
    if supabase_client:
        try:
            res = supabase_client.table("bookings").select("*").eq("trip_id", trip_id).execute()
            if res.data:
                return [
                    Booking(
                        id=str(b["id"]),
                        trip_id=str(b["trip_id"]),
                        booking_key=b["booking_key"],
                        type=b["type"],
                        label=b["label"],
                        subtitle=b.get("subtitle"),
                        origin=b.get("origin"),
                        destination=b.get("destination"),
                        location=b.get("location"),
                        carrier_or_provider=b.get("carrier_or_provider"),
                        pnr=b.get("pnr"),
                        booking_date=str(b["booking_date"]) if b.get("booking_date") else None,
                        booking_time=b.get("booking_time"),
                        price=float(b.get("price", 0)),
                        status=b.get("status", "confirmed"),
                        refund_potential=float(b.get("refund_potential", 0)),
                        links=b.get("links", [])
                    )
                    for b in res.data
                ]
        except Exception as e:
            logger.error(f"Error fetching bookings from Supabase: {e}")
    return [Booking(**b) for b in DEMO_BOOKINGS]

@router.get("/trips/{trip_id}/budget", response_model=BudgetSummary)
@router.get("/trips/{trip_id}/budget/summary", response_model=BudgetSummary)
def get_budget_summary(trip_id: str):
    """Fetch total budget, spent amount, and remaining balance for a trip."""
    if supabase_client:
        try:
            res = supabase_client.table("budgets").select("*").eq("trip_id", trip_id).execute()
            if res.data and len(res.data) > 0:
                b = res.data[0]
                tot = float(b.get("total_budget", 40000))
                sp = float(b.get("total_spent", 31200))
                risk = float(b.get("at_risk", 6500))
                return BudgetSummary(
                    trip_id=str(b["trip_id"]),
                    total_budget=tot,
                    total_spent=sp,
                    at_risk=risk,
                    remaining=round(tot - sp, 2)
                )
        except Exception as e:
            logger.error(f"Error fetching budget from Supabase: {e}")
    return BudgetSummary(**DEMO_BUDGET)

@router.get("/trips/{trip_id}/expenses", response_model=List[ExpenseItem])
def get_trip_expenses(trip_id: str):
    """Fetch list of recorded expenses for a trip."""
    if supabase_client:
        try:
            res = supabase_client.table("expenses").select("*").eq("trip_id", trip_id).execute()
            if res.data:
                return [
                    ExpenseItem(
                        id=str(e["id"]),
                        trip_id=str(e["trip_id"]),
                        description=e["description"],
                        category=e["category"],
                        amount=float(e["amount"]),
                        paid_by=e["paid_by"],
                        date=str(e["date"])
                    )
                    for e in res.data
                ]
        except Exception as e:
            logger.error(f"Error fetching expenses from Supabase: {e}")
    return [ExpenseItem(**e) for e in DEMO_EXPENSES]

@router.get("/trips/{trip_id}/documents", response_model=List[DocumentItem])
def get_trip_documents(trip_id: str):
    """Fetch document metadata for a trip."""
    if supabase_client:
        try:
            res = supabase_client.table("documents").select("*").eq("trip_id", trip_id).execute()
            if res.data:
                return [
                    DocumentItem(
                        id=str(d["id"]),
                        trip_id=str(d["trip_id"]),
                        doc_key=d["doc_key"],
                        title=d["title"],
                        kind=d["kind"],
                        meta=d.get("meta"),
                        is_offline=d.get("is_offline", True),
                        relevant_on_disruption=d.get("relevant_on_disruption", False)
                    )
                    for d in res.data
                ]
        except Exception as e:
            logger.error(f"Error fetching documents from Supabase: {e}")
    return [DocumentItem(**d) for d in DEMO_DOCUMENTS]

@router.get("/trips/{trip_id}/dashboard", response_model=DashboardResponse)
def get_dashboard_data(trip_id: str):
    """Aggregate endpoint fetching all data needed for the Dashboard in a single request."""
    prof = get_profile_me()
    trip = get_trip_by_id(trip_id)
    itin = get_trip_itinerary(trip_id)
    nxt = itin[0] if itin else None
    bkgs = get_trip_bookings(trip_id)
    budg = get_budget_summary(trip_id)
    exps = get_trip_expenses(trip_id)
    mems = get_trip_members(trip_id)
    docs = get_trip_documents(trip_id)

    return DashboardResponse(
        profile=prof,
        current_trip=trip,
        next_event=nxt,
        itinerary=itin,
        bookings=bkgs,
        budget=budg,
        expenses=exps,
        group_members=mems,
        documents=docs
    )
