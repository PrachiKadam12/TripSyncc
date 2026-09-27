"""
blast_radius.py — FastAPI Router for Stage 14 NetworkX Blast Radius Engine
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, List, Any, Optional
from pydantic import BaseModel
import logging
from database import supabase_client
from services.itinerary_graph_service import itinerary_graph_service

logger = logging.getLogger("tripsync.blast_radius")

router = APIRouter(prefix="/api/v1", tags=["blast-radius"])


class BlastRadiusNode(BaseModel):
    item_id: str
    item_type: str
    title: str
    impact_type: str
    status: str
    severity: str
    reason: str
    start_time: Optional[Any] = None
    end_time: Optional[Any] = None
    location: Optional[Any] = None


class BlastRadiusEdge(BaseModel):
    from_item: str
    to_item: str
    relationship: str = "connection"
    minimum_buffer_minutes: int = 30
    description: Optional[str] = None


class BlastRadiusSummary(BaseModel):
    direct: int
    downstream: int
    at_risk: int
    preserved: int
    not_affected: int
    total: int


class BlastRadiusResponse(BaseModel):
    disruption_id: str
    root_item_id: str
    nodes: List[Dict[str, Any]]
    edges: List[Dict[str, Any]]
    summary: Dict[str, int]


class BlastRadiusRequest(BaseModel):
    trip_id: Optional[str] = None
    disruption_id: Optional[str] = None
    root_item_id: Optional[str] = None
    delay_minutes: Optional[int] = 240
    items: Optional[List[Dict[str, Any]]] = None
    dependencies: Optional[List[Dict[str, Any]]] = None
    disruption: Optional[Dict[str, Any]] = None


@router.post("/itinerary/blast-radius", response_model=BlastRadiusResponse)
def compute_blast_radius_endpoint(payload: BlastRadiusRequest):
    """
    Compute NetworkX dependency graph traversal and blast radius impact.
    Accepts raw items & dependencies or loads them for the given trip_id.
    """
    items = payload.items or []
    dependencies = payload.dependencies or []
    trip_id = payload.trip_id
    disruption_data = payload.disruption or {}

    if payload.disruption_id and "id" not in disruption_data:
        disruption_data["id"] = payload.disruption_id
    if payload.delay_minutes and "expected_delay_minutes" not in disruption_data:
        disruption_data["expected_delay_minutes"] = payload.delay_minutes

    # If items are not provided, query Supabase for trip itinerary items
    if not items and trip_id and supabase_client:
        try:
            res_items = supabase_client.table("itinerary_items").select("*").eq("trip_id", trip_id).order("sort_order").execute()
            if res_items.data:
                items = res_items.data

            res_deps = supabase_client.table("dependencies").select("*").eq("trip_id", trip_id).execute()
            if res_deps.data:
                dependencies = res_deps.data

            # If no disruption is provided, fetch active disruption from DB
            if not disruption_data:
                res_disr = supabase_client.table("disruptions").select("*").eq("trip_id", trip_id).is_("resolved_at", "null").order("created_at", desc=True).limit(1).execute()
                if res_disr.data:
                    disruption_data = res_disr.data[0]
        except Exception as e:
            logger.warning(f"Error querying Supabase for trip {trip_id}: {e}")

    # Fallback to demo items if items are still empty
    if not items:
        items = [
            {"id": "item-flight-1", "type": "flight", "title": "Air India AI-101", "start_time": "2026-10-10T08:30:00", "end_time": "2026-10-10T11:30:00", "chain_id": "main"},
            {"id": "item-transfer-1", "type": "transfer", "title": "Delhi Airport Cab Transfer", "start_time": "2026-10-10T12:15:00", "end_time": "2026-10-10T18:45:00", "chain_id": "main"},
            {"id": "item-hotel-1", "type": "hotel", "title": "Mountain View Residency", "start_time": "2026-10-10T19:00:00", "end_time": "2026-10-14T11:00:00", "chain_id": "main"},
            {"id": "item-act-1", "type": "activity", "title": "Solang Valley Paragliding", "start_time": "2026-10-11T10:00:00", "end_time": "2026-10-11T13:00:00", "chain_id": "main"},
            {"id": "item-act-unrelated", "type": "activity", "title": "Independent Day 4 Spa", "start_time": "2026-10-14T14:00:00", "chain_id": "independent"},
        ]
        dependencies = [
            {"from_item_id": "item-flight-1", "to_item_id": "item-transfer-1", "dependency_type": "layover", "minimum_buffer_minutes": 45},
            {"from_item_id": "item-transfer-1", "to_item_id": "item-hotel-1", "dependency_type": "arrival_checkin", "minimum_buffer_minutes": 30},
            {"from_item_id": "item-hotel-1", "to_item_id": "item-act-1", "dependency_type": "activity_transition", "minimum_buffer_minutes": 60},
        ]

    # Determine root disrupted item
    root_id = payload.root_item_id
    if not root_id:
        meta = disruption_data.get("metadata") or {}
        root_id = meta.get("affected_item_id") or meta.get("affected_booking_id")

    if not root_id:
        # Find first flight or first item
        flight_item = next((it for it in items if str(it.get("type", "")).lower() == "flight"), None)
        root_id = str(flight_item.get("id") if flight_item else items[0].get("id"))

    # Build NetworkX directed graph
    G = itinerary_graph_service.build_graph(items=items, dependencies=dependencies)

    # Compute deterministic blast radius
    result = itinerary_graph_service.compute_blast_radius(
        G=G,
        root_item_id=root_id,
        disruption_data=disruption_data,
    )

    return result


@router.get("/trips/{trip_id}/blast-radius", response_model=BlastRadiusResponse)
def get_trip_blast_radius(trip_id: str):
    """
    GET endpoint to retrieve blast radius computation for a trip.
    """
    return compute_blast_radius_endpoint(BlastRadiusRequest(trip_id=trip_id))
