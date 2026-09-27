"""
group_invitations.py — Router for Group Trip Invitations, Member Responses, and Status Tracking.
Secures invitation tokens and coordinates with Supabase database & Email Service.
"""

import logging
import secrets
import uuid
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, status
from database import supabase_client
from services.email_service import send_invitation_email

logger = logging.getLogger("tripsync.router.group_invitations")
router = APIRouter(prefix="/api/trips", tags=["Group Invitations"])


class InviteMemberRequest(BaseModel):
    email: str
    member_name: Optional[str] = None
    organizer_name: Optional[str] = "Organizer"


class RespondInviteRequest(BaseModel):
    action: str  # 'accept' or 'decline'


class ConfirmGroupRequest(BaseModel):
    accepted_member_ids: List[str]
    declined_member_ids: List[str] = []


def parse_member_status(member_dict: Dict[str, Any]) -> str:
    """Helper to extract normalized member status (invited, accepted, declined, organizer)."""
    if member_dict.get("is_primary_traveler") or member_dict.get("role") in ["owner", "Lead Traveler"]:
        return "organizer"

    # Check direct column first if exists
    if member_dict.get("member_status"):
        return str(member_dict["member_status"]).lower()

    # Fallback to note parsing
    note = str(member_dict.get("note") or "")
    if "status: accepted" in note.lower() or "accepted" in note.lower():
        return "accepted"
    if "status: declined" in note.lower() or "declined" in note.lower():
        return "declined"
    return "invited"


def extract_token_from_member(member_dict: Dict[str, Any]) -> str:
    """Extract invitation token from member_code or note."""
    if member_dict.get("invitation_token"):
        return str(member_dict["invitation_token"])
    code = str(member_dict.get("member_code") or "")
    if code and not code.startswith("tanvi") and not code.startswith("aisha") and not code.startswith("rahul"):
        return code
    note = str(member_dict.get("note") or "")
    if "Token:" in note:
        parts = note.split("Token:")
        if len(parts) > 1:
            return parts[1].strip().split()[0]
    return ""


@router.post("/{trip_id}/invitations")
async def create_group_invitation(trip_id: str, req: InviteMemberRequest):
    """
    1. Create a pending group member invitation for the trip.
    2. Secure token generation.
    3. Persist to Supabase trip_members.
    4. Trigger invitation email.
    """
    email_clean = str(req.email).strip().lower()
    name_clean = (req.member_name or email_clean.split("@")[0]).strip()
    token = f"inv_{secrets.token_urlsafe(18)}"

    trip_name = "Group Adventure"
    origin = "Origin"
    destination = "Destination"
    start_date = ""
    end_date = ""
    organizer = req.organizer_name or "Trip Organizer"

    # Look up trip details from Supabase if available
    if supabase_client:
        try:
            t_res = supabase_client.table("trips").select("*").eq("id", trip_id).execute()
            if t_res.data:
                trip_data = t_res.data[0]
                trip_name = trip_data.get("name") or trip_data.get("title") or trip_name
                origin = trip_data.get("origin_city") or trip_data.get("origin") or origin
                destination = trip_data.get("destination_city") or trip_data.get("destination") or destination
                start_date = str(trip_data.get("start_at") or trip_data.get("start_date") or "")[:10]
                end_date = str(trip_data.get("end_at") or trip_data.get("end_date") or "")[:10]
                meta = trip_data.get("provider_metadata") or {}
                if meta.get("organizer_name"):
                    organizer = meta["organizer_name"]
        except Exception as e:
            logger.warning(f"Could not load trip details for email: {e}")

    # Check if member already exists
    member_id = str(uuid.uuid4())
    if supabase_client:
        try:
            # Check existing member by email
            existing = supabase_client.table("trip_members").select("*").eq("trip_id", trip_id).eq("email", email_clean).execute()
            if existing.data:
                existing_member = existing.data[0]
                member_id = existing_member["id"]
                token = extract_token_from_member(existing_member) or token
                # Update status back to invited if pending/re-inviting
                supabase_client.table("trip_members").update({
                    "member_code": token,
                    "note": f"Status: invited | Token: {token}"
                }).eq("id", member_id).execute()
            else:
                # Insert new member with status: invited
                new_row = {
                    "id": member_id,
                    "trip_id": trip_id,
                    "name": name_clean,
                    "first_name": name_clean,
                    "email": email_clean,
                    "role": "traveler",
                    "is_primary_traveler": False,
                    "member_code": token,
                    "note": f"Status: invited | Token: {token}"
                }
                supabase_client.table("trip_members").insert(new_row).execute()
        except Exception as e:
            logger.error(f"Failed to persist trip_member to Supabase: {e}")

    # Send invitation email
    email_result = await send_invitation_email(
        trip_name=trip_name,
        starting_city=origin,
        destination=destination,
        start_date=start_date,
        end_date=end_date,
        organizer_name=organizer,
        invitation_token=token,
        recipient_email=email_clean
    )

    return {
        "success": True,
        "member_id": member_id,
        "trip_id": trip_id,
        "email": email_clean,
        "name": name_clean,
        "token": token,
        "status": "invited",
        "email_delivery": email_result
    }


@router.get("/{trip_id}/invitations")
async def get_group_invitations(trip_id: str):
    """
    Fetch all group members and invitations for the organizer's view.
    """
    members = []
    if supabase_client:
        try:
            res = supabase_client.table("trip_members").select("*").eq("trip_id", trip_id).order("created_at").execute()
            for m in (res.data or []):
                status_val = parse_member_status(m)
                token = extract_token_from_member(m)
                members.append({
                    "id": str(m["id"]),
                    "trip_id": str(m["trip_id"]),
                    "name": m.get("name") or m.get("first_name") or "Member",
                    "email": m.get("email"),
                    "role": m.get("role", "traveler"),
                    "is_organizer": bool(m.get("is_primary_traveler") or m.get("role") in ["owner", "Lead Traveler"]),
                    "status": status_val,
                    "token": token,
                    "joined_at": m.get("joined_at") or m.get("created_at")
                })
        except Exception as e:
            logger.error(f"Error fetching group members: {e}")

    # Summary counts
    accepted_count = sum(1 for m in members if m["status"] == "accepted")
    declined_count = sum(1 for m in members if m["status"] == "declined")
    pending_count = sum(1 for m in members if m["status"] == "invited")

    return {
        "trip_id": trip_id,
        "members": members,
        "summary": {
            "accepted": accepted_count,
            "declined": declined_count,
            "pending": pending_count,
            "total_invited": len(members)
        }
    }


@router.get("/invitations/{token}")
async def get_invitation_by_token(token: str):
    """
    Public lookup for a member viewing their invitation link.
    Validates token without leaking unneeded data.
    """
    if not supabase_client:
        raise HTTPException(status_code=404, detail="Database not connected")

    try:
        # Search by member_code or note
        res = supabase_client.table("trip_members").select("*, trips(*)").eq("member_code", token).execute()
        if not res.data:
            # Try note like
            res = supabase_client.table("trip_members").select("*, trips(*)").like("note", f"%Token: {token}%").execute()

        if not res.data:
            raise HTTPException(status_code=404, detail="Invalid or expired invitation token.")

        member = res.data[0]
        trip = member.get("trips") or {}
        if isinstance(trip, list) and trip:
            trip = trip[0]

        meta = trip.get("provider_metadata") or {}
        organizer = meta.get("organizer_name") or "Trip Organizer"
        status_val = parse_member_status(member)

        return {
            "valid": True,
            "token": token,
            "member_id": str(member["id"]),
            "email": member.get("email"),
            "name": member.get("name") or member.get("first_name"),
            "status": status_val,
            "trip": {
                "id": str(trip.get("id")),
                "name": trip.get("name") or trip.get("title") or "Trip",
                "origin": trip.get("origin_city") or trip.get("origin") or "",
                "destination": trip.get("destination_city") or trip.get("destination") or "",
                "start_date": str(trip.get("start_at") or trip.get("start_date") or "")[:10],
                "end_date": str(trip.get("end_at") or trip.get("end_date") or "")[:10],
                "organizer_name": organizer
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error validating invitation token: {e}")
        raise HTTPException(status_code=500, detail="Error looking up invitation.")


@router.post("/invitations/{token}/respond")
async def respond_to_invitation(token: str, req: RespondInviteRequest):
    """
    Invited member accepts or declines the invitation.
    Validates token and updates member status to 'accepted' or 'declined'.
    Declined members are flagged and excluded from the trip.
    """
    action = req.action.lower().strip()
    if action not in ["accept", "decline"]:
        raise HTTPException(status_code=400, detail="Action must be 'accept' or 'decline'.")

    new_status = "accepted" if action == "accept" else "declined"

    if not supabase_client:
        return {"success": True, "token": token, "status": new_status, "note": "Simulation mode"}

    try:
        # Locate member
        res = supabase_client.table("trip_members").select("*").eq("member_code", token).execute()
        if not res.data:
            res = supabase_client.table("trip_members").select("*").like("note", f"%Token: {token}%").execute()

        if not res.data:
            raise HTTPException(status_code=404, detail="Invitation not found or invalid token.")

        member = res.data[0]
        member_id = member["id"]

        # Update status
        updated_note = f"Status: {new_status} | Token: {token}"
        supabase_client.table("trip_members").update({
            "note": updated_note,
            "affected": False if new_status == "accepted" else True
        }).eq("id", member_id).execute()

        return {
            "success": True,
            "token": token,
            "member_id": member_id,
            "status": new_status,
            "message": f"Invitation successfully {new_status}."
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error responding to invitation: {e}")
        raise HTTPException(status_code=500, detail="Failed to record response.")


@router.post("/{trip_id}/invitations/{member_id}/resend")
async def resend_invitation(trip_id: str, member_id: str):
    """Resend invitation email to a pending member."""
    if not supabase_client:
        raise HTTPException(status_code=500, detail="Database not configured")

    try:
        m_res = supabase_client.table("trip_members").select("*").eq("id", member_id).eq("trip_id", trip_id).execute()
        if not m_res.data:
            raise HTTPException(status_code=404, detail="Member not found.")

        member = m_res.data[0]
        email = member.get("email")
        if not email:
            raise HTTPException(status_code=400, detail="Member does not have an email address.")

        token = extract_token_from_member(member) or f"inv_{secrets.token_urlsafe(18)}"

        # Fetch trip details
        t_res = supabase_client.table("trips").select("*").eq("id", trip_id).execute()
        trip_name = "Trip"
        origin = ""
        destination = ""
        start_date = ""
        end_date = ""
        organizer = "Organizer"
        if t_res.data:
            t = t_res.data[0]
            trip_name = t.get("name") or trip_name
            origin = t.get("origin_city") or ""
            destination = t.get("destination_city") or ""
            start_date = str(t.get("start_at") or "")[:10]
            end_date = str(t.get("end_at") or "")[:10]
            meta = t.get("provider_metadata") or {}
            organizer = meta.get("organizer_name") or organizer

        email_result = await send_invitation_email(
            trip_name=trip_name,
            starting_city=origin,
            destination=destination,
            start_date=start_date,
            end_date=end_date,
            organizer_name=organizer,
            invitation_token=token,
            recipient_email=email
        )

        return {
            "success": True,
            "member_id": member_id,
            "email": email,
            "email_delivery": email_result
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resending invitation: {e}")
        raise HTTPException(status_code=500, detail="Failed to resend invitation.")
