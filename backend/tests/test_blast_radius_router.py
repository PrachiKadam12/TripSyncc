"""
test_blast_radius_router.py — Integration Tests for FastAPI Blast Radius Endpoint
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_blast_radius_endpoint_with_custom_payload():
    payload = {
        "trip_id": "test-trip-1",
        "disruption_id": "disr-123",
        "root_item_id": "fl-1",
        "delay_minutes": 180,
        "items": [
            {"id": "fl-1", "type": "flight", "title": "Flight Delhi to Manali", "start_time": "2026-10-10T08:00:00", "end_time": "2026-10-10T11:00:00"},
            {"id": "tr-1", "type": "transfer", "title": "Airport Cab", "start_time": "2026-10-10T11:30:00", "end_time": "2026-10-10T18:00:00"},
            {"id": "ht-1", "type": "hotel", "title": "Mountain View Resort", "start_time": "2026-10-10T18:30:00"},
            {"id": "act-unrelated", "type": "activity", "title": "Separate Day 5 Tour", "start_time": "2026-10-15T10:00:00"},
        ],
        "dependencies": [
            {"from": "fl-1", "to": "tr-1", "minimum_buffer_minutes": 30},
            {"from": "tr-1", "to": "ht-1", "minimum_buffer_minutes": 30},
        ],
    }

    response = client.post("/api/v1/itinerary/blast-radius", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["disruption_id"] == "disr-123"
    assert data["root_item_id"] == "fl-1"
    assert len(data["nodes"]) == 4
    assert len(data["edges"]) == 2

    # Check root node
    fl_node = next(n for n in data["nodes"] if n["item_id"] == "fl-1")
    assert fl_node["impact_type"] == "direct"
    assert fl_node["status"] == "DIRECTLY_AFFECTED"

    # Check downstream transfer (missed connection)
    tr_node = next(n for n in data["nodes"] if n["item_id"] == "tr-1")
    assert tr_node["impact_type"] == "downstream"
    assert tr_node["status"] == "DOWNSTREAM_AFFECTED"

    # Check unrelated node
    unrel_node = next(n for n in data["nodes"] if n["item_id"] == "act-unrelated")
    assert unrel_node["impact_type"] == "not_affected"
    assert unrel_node["status"] == "NOT_AFFECTED"

    # Check summary
    assert data["summary"]["direct"] == 1
    assert data["summary"]["downstream"] >= 1
    assert data["summary"]["not_affected"] == 1


def test_blast_radius_endpoint_fallback():
    # Calling with empty body should use demo items safely
    response = client.post("/api/v1/itinerary/blast-radius", json={})
    assert response.status_code == 200
    data = response.json()
    assert len(data["nodes"]) > 0
    assert "summary" in data
