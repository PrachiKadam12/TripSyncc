from pydantic import BaseModel, Field
from typing import Optional, List, Any

class ProfileResponse(BaseModel):
    id: str
    username: str
    full_name: str
    home_city: str

class TripMember(BaseModel):
    id: str
    trip_id: str
    name: str
    member_code: str
    role: Optional[str] = "Traveler"
    affected: bool = False
    note: Optional[str] = None

class BookingLink(BaseModel):
    label: str
    url: str

class Booking(BaseModel):
    id: str
    trip_id: str
    booking_key: str
    type: str
    label: str
    subtitle: Optional[str] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    location: Optional[str] = None
    carrier_or_provider: Optional[str] = None
    pnr: Optional[str] = None
    booking_date: Optional[str] = None
    booking_time: Optional[str] = None
    price: float
    status: str = "confirmed"
    refund_potential: float = 0.00
    links: List[BookingLink] = []

class ItineraryItem(BaseModel):
    id: str
    trip_id: str
    title: str
    type: str
    location: str
    start_time: str
    end_time: Optional[str] = None
    status: str = "scheduled"
    booking_ref: Optional[str] = None
    sort_order: int = 0

class BudgetSummary(BaseModel):
    trip_id: str
    total_budget: float
    total_spent: float
    at_risk: float
    remaining: float

class ExpenseItem(BaseModel):
    id: str
    trip_id: str
    description: str
    category: str
    amount: float
    paid_by: str
    date: str

class DocumentItem(BaseModel):
    id: str
    trip_id: str
    doc_key: str
    title: str
    kind: str
    meta: Optional[str] = None
    is_offline: bool = True
    relevant_on_disruption: bool = False

class TripDetail(BaseModel):
    id: str
    title: str
    origin: str
    destination: str
    route: List[str]
    start_date: str
    end_date: str
    dates_label: str
    status: str
    travelers_count: int

class DashboardResponse(BaseModel):
    profile: ProfileResponse
    current_trip: TripDetail
    next_event: Optional[ItineraryItem] = None
    itinerary: List[ItineraryItem] = []
    bookings: List[Booking] = []
    budget: BudgetSummary
    expenses: List[ExpenseItem] = []
    group_members: List[TripMember] = []
    documents: List[DocumentItem] = []
