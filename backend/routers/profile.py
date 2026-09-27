"""
profile.py — Router for Travel Profile Completion and Overview Calculation.
Calculates dynamic completion based on authenticated Supabase user profile, emergency contacts, and documents.
"""

import logging
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Header, Query, Request
from pydantic import BaseModel
from database import supabase_client

logger = logging.getLogger("tripsync.router.profile")

router = APIRouter(prefix="", tags=["Profile"])


class SectionDetail(BaseModel):
    name: str
    weight: int
    score: int
    status: str  # 'complete', 'partially_complete', 'missing'
    missing_count: int = 0
    details: str
    missing_fields: List[str] = []


class ProfileCompletionResponse(BaseModel):
    percentage: int
    status: str  # 'travel_ready', 'almost_ready', 'action_required'
    items_remaining: int
    sections: Dict[str, SectionDetail]


def calculate_completion(
    profile: Optional[Dict[str, Any]],
    user_email: Optional[str],
    user_phone: Optional[str],
    emergency_contacts: List[Dict[str, Any]],
    documents: List[Dict[str, Any]],
) -> Dict[str, Any]:
    sections: Dict[str, Dict[str, Any]] = {
        "personal_details": {
            "name": "Personal Details",
            "weight": 25,
            "score": 0,
            "status": "missing",
            "missing_count": 0,
            "details": "Full legal name, date of birth & residence",
            "missing_fields": [],
        },
        "contact_details": {
            "name": "Contact Details",
            "weight": 15,
            "score": 0,
            "status": "missing",
            "missing_count": 0,
            "details": "Verified email address & mobile number",
            "missing_fields": [],
        },
        "emergency_contact": {
            "name": "Emergency Contact",
            "weight": 15,
            "score": 0,
            "status": "missing",
            "missing_count": 0,
            "details": "At least one trusted emergency contact",
            "missing_fields": [],
        },
        "travel_identity": {
            "name": "Travel Identity",
            "weight": 20,
            "score": 0,
            "status": "missing",
            "missing_count": 0,
            "details": "Government Photo ID, passport & nationality",
            "missing_fields": [],
        },
        "travel_documents": {
            "name": "Travel Documents",
            "weight": 15,
            "score": 0,
            "status": "missing",
            "missing_count": 0,
            "details": "Flight tickets, train passes, or hotel bookings",
            "missing_fields": [],
        },
        "health_insurance": {
            "name": "Health Insurance",
            "weight": 10,
            "score": 0,
            "status": "missing",
            "missing_count": 0,
            "details": "Active travel medical & health insurance policy",
            "missing_fields": [],
        },
    }

    # 1. Personal Details (25%)
    first_name = (profile or {}).get("first_name") or (profile or {}).get("full_name")
    last_name = (profile or {}).get("last_name")
    dob = (profile or {}).get("date_of_birth")
    home_city = (profile or {}).get("home_city")

    personal_items = [bool(first_name), bool(last_name), bool(dob), bool(home_city)]
    filled_personal = sum(personal_items)

    if filled_personal == 4:
        sections["personal_details"]["score"] = 25
        sections["personal_details"]["status"] = "complete"
    elif filled_personal > 0:
        sections["personal_details"]["score"] = round((filled_personal / 4) * 25)
        sections["personal_details"]["status"] = "partially_complete"
        sections["personal_details"]["missing_count"] = 4 - filled_personal
    else:
        sections["personal_details"]["score"] = 0
        sections["personal_details"]["status"] = "missing"
        sections["personal_details"]["missing_count"] = 4

    if not first_name:
        sections["personal_details"]["missing_fields"].append("First Name")
    if not last_name:
        sections["personal_details"]["missing_fields"].append("Last Name")
    if not dob:
        sections["personal_details"]["missing_fields"].append("Date of Birth")
    if not home_city:
        sections["personal_details"]["missing_fields"].append("Home City")

    # 2. Contact Details (15%)
    email = (profile or {}).get("email") or user_email
    phone = (profile or {}).get("phone") or user_phone

    if email and phone:
        sections["contact_details"]["score"] = 15
        sections["contact_details"]["status"] = "complete"
    elif email or phone:
        sections["contact_details"]["score"] = 10 if email else 5
        sections["contact_details"]["status"] = "partially_complete"
        sections["contact_details"]["missing_count"] = 1
        if not phone:
            sections["contact_details"]["missing_fields"].append("Mobile Phone")
        if not email:
            sections["contact_details"]["missing_fields"].append("Email")
    else:
        sections["contact_details"]["score"] = 0
        sections["contact_details"]["status"] = "missing"
        sections["contact_details"]["missing_count"] = 2
        sections["contact_details"]["missing_fields"].extend(["Email", "Mobile Phone"])

    # 3. Emergency Contact (15%)
    valid_contacts = [c for c in emergency_contacts if c.get("name") or c.get("contact_name")]
    if valid_contacts:
        primary = valid_contacts[0]
        if primary.get("phone"):
            sections["emergency_contact"]["score"] = 15
            sections["emergency_contact"]["status"] = "complete"
        else:
            sections["emergency_contact"]["score"] = 8
            sections["emergency_contact"]["status"] = "partially_complete"
            sections["emergency_contact"]["missing_count"] = 1
            sections["emergency_contact"]["missing_fields"].append("Contact Phone")
    else:
        sections["emergency_contact"]["score"] = 0
        sections["emergency_contact"]["status"] = "missing"
        sections["emergency_contact"]["missing_count"] = 1
        sections["emergency_contact"]["missing_fields"].append("Emergency Contact Person")

    # 4. Travel Identity (20%)
    nationality = (profile or {}).get("nationality")
    has_passport_doc = any(
        d.get("document_type") in ["passport", "id"] or d.get("kind") in ["passport", "id"]
        for d in documents
    ) or bool((profile or {}).get("passport_last4"))

    if nationality and has_passport_doc:
        sections["travel_identity"]["score"] = 20
        sections["travel_identity"]["status"] = "complete"
    elif nationality or has_passport_doc:
        sections["travel_identity"]["score"] = 10
        sections["travel_identity"]["status"] = "partially_complete"
        sections["travel_identity"]["missing_count"] = 1
        if not nationality:
            sections["travel_identity"]["missing_fields"].append("Nationality")
        if not has_passport_doc:
            sections["travel_identity"]["missing_fields"].append("Passport Document")
    else:
        sections["travel_identity"]["score"] = 0
        sections["travel_identity"]["status"] = "missing"
        sections["travel_identity"]["missing_count"] = 2
        sections["travel_identity"]["missing_fields"].extend(["Nationality", "Passport Document"])

    # 5. Travel Documents (15%)
    travel_kinds = ["flight", "hotel", "train", "bus", "booking", "ticket", "transport"]
    travel_docs = [
        d for d in documents
        if (d.get("document_type") in travel_kinds or d.get("kind") in travel_kinds)
    ]
    if travel_docs:
        sections["travel_documents"]["score"] = 15
        sections["travel_documents"]["status"] = "complete"
    else:
        sections["travel_documents"]["score"] = 0
        sections["travel_documents"]["status"] = "missing"
        sections["travel_documents"]["missing_count"] = 1
        sections["travel_documents"]["missing_fields"].append("Travel Booking / Ticket")

    # 6. Health Insurance (10%)
    insurance_docs = [
        d for d in documents
        if d.get("document_type") == "insurance"
        or d.get("kind") == "insurance"
        or "insurance" in str(d.get("title", "")).lower()
    ]
    if insurance_docs:
        sections["health_insurance"]["score"] = 10
        sections["health_insurance"]["status"] = "complete"
    else:
        sections["health_insurance"]["score"] = 0
        sections["health_insurance"]["status"] = "missing"
        sections["health_insurance"]["missing_count"] = 1
        sections["health_insurance"]["missing_fields"].append("Insurance Policy")

    total_score = min(100, sum(s["score"] for s in sections.values()))

    # Status classification:
    # 90–100% = Travel Ready
    # 70–89% = Almost Ready
    # below 70% = Action Required
    if total_score >= 90:
        overall_status = "travel_ready"
    elif total_score >= 70:
        overall_status = "almost_ready"
    else:
        overall_status = "action_required"

    items_remaining = sum(1 for s in sections.values() if s["status"] != "complete")

    return {
        "percentage": total_score,
        "status": overall_status,
        "items_remaining": items_remaining,
        "sections": {k: SectionDetail(**v) for k, v in sections.items()},
    }


@router.get("/api/v1/profile/completion", response_model=ProfileCompletionResponse)
@router.get("/api/profile/completion", response_model=ProfileCompletionResponse)
async def get_profile_completion(
    user_id: Optional[str] = Query(None, description="Supabase user UUID"),
    authorization: Optional[str] = Header(None),
):
    """
    Computes profile completion breakdown for the authenticated traveler.
    Retrieves data directly from Supabase profiles, emergency_contacts, and documents tables.
    """
    resolved_user_id = user_id
    user_email = None
    user_phone = None

    # If auth header provided, attempt to verify user with Supabase
    if authorization and authorization.startswith("Bearer ") and supabase_client:
        token = authorization.replace("Bearer ", "").strip()
        try:
            auth_user_resp = supabase_client.auth.get_user(token)
            if auth_user_resp and auth_user_resp.user:
                resolved_user_id = auth_user_resp.user.id
                user_email = auth_user_resp.user.email
                user_phone = auth_user_resp.user.phone
        except Exception as e:
            logger.warning(f"Could not verify user token via Supabase: {e}")

    if not resolved_user_id:
        # If unauthenticated, return 0% completion with action_required
        return calculate_completion(
            profile=None,
            user_email=None,
            user_phone=None,
            emergency_contacts=[],
            documents=[],
        )

    # Fetch live data from Supabase
    profile_data = None
    contacts_data = []
    documents_data = []

    if supabase_client:
        try:
            p_res = (
                supabase_client.table("profiles")
                .select("*")
                .eq("id", resolved_user_id)
                .limit(1)
                .execute()
            )
            if p_res.data and len(p_res.data) > 0:
                profile_data = p_res.data[0]
        except Exception as e:
            logger.error(f"Error querying profiles table: {e}")

        try:
            c_res = (
                supabase_client.table("emergency_contacts")
                .select("*")
                .eq("user_id", resolved_user_id)
                .execute()
            )
            if c_res.data:
                contacts_data = c_res.data
        except Exception as e:
            logger.error(f"Error querying emergency_contacts table: {e}")

        try:
            d_res = (
                supabase_client.table("documents")
                .select("*")
                .eq("uploaded_by", resolved_user_id)
                .execute()
            )
            if d_res.data:
                documents_data = d_res.data
        except Exception as e:
            logger.error(f"Error querying documents table: {e}")

    result = calculate_completion(
        profile=profile_data,
        user_email=user_email,
        user_phone=user_phone,
        emergency_contacts=contacts_data,
        documents=documents_data,
    )

    return ProfileCompletionResponse(**result)
