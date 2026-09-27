"""
test_itinerary_graph_service.py — Stage 14 Python Test Suite for NetworkX Graph Engine

Tests:
1. Create dependency graph
2. Direct impact detection
3. Downstream traversal
4. Unrelated branch remains unaffected
5. Multiple independent itinerary chains
6. Multi-level dependency propagation
7. Missing dependency edge
8. Circular dependency protection
9. Empty itinerary
10. Missing root disruption item
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
import networkx as nx
from services.itinerary_graph_service import (
    ItineraryGraphService,
    itinerary_graph_service,
    IMPACT_DIRECT,
    IMPACT_DOWNSTREAM,
    IMPACT_AT_RISK,
    IMPACT_PRESERVED,
    IMPACT_NOT_AFFECTED,
    STATUS_DIRECT,
    STATUS_DOWNSTREAM,
    STATUS_AT_RISK,
    STATUS_PRESERVED,
    STATUS_NOT_AFFECTED,
)


@pytest.fixture
def service():
    return ItineraryGraphService()


# 1. Create dependency graph
def test_create_dependency_graph(service):
    items = [
        {"id": "item-1", "type": "flight", "title": "Flight AI-101", "start_time": "2026-10-10T08:00:00", "end_time": "2026-10-10T10:00:00"},
        {"id": "item-2", "type": "transfer", "title": "Cab to Hotel", "start_time": "2026-10-10T10:45:00", "end_time": "2026-10-10T12:00:00"},
        {"id": "item-3", "type": "hotel", "title": "Hilltop Resort", "start_time": "2026-10-10T14:00:00", "end_time": "2026-10-12T11:00:00"},
    ]
    deps = [
        {"from_item_id": "item-1", "to_item_id": "item-2", "dependency_type": "transfer"},
        {"from_item_id": "item-2", "to_item_id": "item-3", "dependency_type": "checkin"},
    ]

    G = service.build_graph(items, deps)

    assert isinstance(G, nx.DiGraph)
    assert len(G.nodes) == 3
    assert len(G.edges) == 2
    assert G.has_edge("item-1", "item-2")
    assert G.has_edge("item-2", "item-3")
    assert G.nodes["item-1"]["title"] == "Flight AI-101"
    assert G.nodes["item-1"]["item_type"] == "flight"


# 2. Direct impact detection
def test_direct_impact_detection(service):
    items = [
        {"id": "fl-1", "type": "flight", "title": "Morning Flight", "start_time": "2026-10-10T08:00:00", "end_time": "2026-10-10T10:00:00"},
        {"id": "ht-1", "type": "hotel", "title": "Mountain View Hotel", "start_time": "2026-10-10T14:00:00", "end_time": "2026-10-12T11:00:00"},
    ]
    deps = [{"from": "fl-1", "to": "ht-1"}]

    G = service.build_graph(items, deps)
    result = service.compute_blast_radius(G, root_item_id="fl-1", disruption_data={"title": "Flight Cancelled", "delay_minutes": 180})

    root_node = next(n for n in result["nodes"] if n["item_id"] == "fl-1")
    assert root_node["impact_type"] == IMPACT_DIRECT
    assert root_node["status"] == STATUS_DIRECT
    assert root_node["severity"] == "high"
    assert "Direct disruption source" in root_node["reason"]
    assert result["summary"]["direct"] == 1


# 3. Downstream traversal
def test_downstream_traversal(service):
    items = [
        {"id": "fl-1", "type": "flight", "title": "Flight A", "start_time": "2026-10-10T08:00:00", "end_time": "2026-10-10T10:00:00"},
        {"id": "tr-1", "type": "transfer", "title": "Pre-booked Cab", "start_time": "2026-10-10T10:30:00", "end_time": "2026-10-10T12:00:00"},
        {"id": "ht-1", "type": "hotel", "title": "Valley Hotel", "start_time": "2026-10-10T14:00:00"},
    ]
    deps = [
        {"from": "fl-1", "to": "tr-1", "minimum_buffer_minutes": 30},
        {"from": "tr-1", "to": "ht-1"},
    ]

    G = service.build_graph(items, deps)
    # 90m delay causes missed connection on tr-1 (scheduled buffer is 30m, 30 - 90 = -60m)
    result = service.compute_blast_radius(G, root_item_id="fl-1", disruption_data={"delay_minutes": 90})

    tr_node = next(n for n in result["nodes"] if n["item_id"] == "tr-1")
    assert tr_node["impact_type"] == IMPACT_DOWNSTREAM
    assert tr_node["status"] == STATUS_DOWNSTREAM
    assert tr_node["severity"] == "high"
    assert "Missed connection" in tr_node["reason"]


# 4. Unrelated branch remains unaffected
def test_unrelated_branch_remains_unaffected(service):
    items = [
        {"id": "fl-A", "type": "flight", "title": "Flight A", "start_time": "2026-10-10T08:00:00", "end_time": "2026-10-10T10:00:00"},
        {"id": "tr-A", "type": "transfer", "title": "Cab A", "start_time": "2026-10-10T10:30:00", "end_time": "2026-10-10T12:00:00"},
        {"id": "act-B", "type": "activity", "title": "Unrelated Day 4 Museum Tour", "start_time": "2026-10-14T10:00:00"},
    ]
    # Edge only from fl-A -> tr-A. act-B has NO dependency edge from fl-A
    deps = [{"from": "fl-A", "to": "tr-A"}]

    G = service.build_graph(items, deps)
    result = service.compute_blast_radius(G, root_item_id="fl-A", disruption_data={"delay_minutes": 240})

    act_b = next(n for n in result["nodes"] if n["item_id"] == "act-B")
    assert act_b["impact_type"] == IMPACT_NOT_AFFECTED
    assert act_b["status"] == STATUS_NOT_AFFECTED
    assert act_b["severity"] == "none"
    assert "Independent branch" in act_b["reason"]
    assert result["summary"]["not_affected"] >= 1


# 5. Multiple independent itinerary chains
def test_multiple_independent_itinerary_chains(service):
    # Chain 1: Flight A -> Hotel A -> Activity A
    # Chain 2: Train B -> Hotel B -> Activity B
    items = [
        {"id": "fl-A", "chain_id": "chain-A", "type": "flight", "title": "Flight A", "start_time": "2026-10-10T08:00:00", "end_time": "2026-10-10T10:00:00"},
        {"id": "ht-A", "chain_id": "chain-A", "type": "hotel", "title": "Hotel A", "start_time": "2026-10-10T14:00:00"},
        {"id": "act-A", "chain_id": "chain-A", "type": "activity", "title": "Activity A", "start_time": "2026-10-10T15:00:00"},

        {"id": "train-B", "chain_id": "chain-B", "type": "train", "title": "Train B", "start_time": "2026-10-10T09:00:00", "end_time": "2026-10-10T13:00:00"},
        {"id": "ht-B", "chain_id": "chain-B", "type": "hotel", "title": "Hotel B", "start_time": "2026-10-10T14:30:00"},
        {"id": "act-B", "chain_id": "chain-B", "type": "activity", "title": "Activity B", "start_time": "2026-10-10T17:00:00"},
    ]
    deps = [
        {"from": "fl-A", "to": "ht-A"},
        {"from": "ht-A", "to": "act-A"},
        {"from": "train-B", "to": "ht-B"},
        {"from": "ht-B", "to": "act-B"},
    ]

    G = service.build_graph(items, deps)
    result = service.compute_blast_radius(G, root_item_id="fl-A", disruption_data={"delay_minutes": 360})

    nodes_by_id = {n["item_id"]: n for n in result["nodes"]}

    # Chain A is impacted
    assert nodes_by_id["fl-A"]["impact_type"] == IMPACT_DIRECT
    assert nodes_by_id["ht-A"]["impact_type"] in (IMPACT_DOWNSTREAM, IMPACT_AT_RISK, IMPACT_PRESERVED)
    assert nodes_by_id["act-A"]["impact_type"] in (IMPACT_DOWNSTREAM, IMPACT_AT_RISK)

    # Chain B MUST BE NOT_AFFECTED
    assert nodes_by_id["train-B"]["impact_type"] == IMPACT_NOT_AFFECTED
    assert nodes_by_id["ht-B"]["impact_type"] == IMPACT_NOT_AFFECTED
    assert nodes_by_id["act-B"]["impact_type"] == IMPACT_NOT_AFFECTED


# 6. Multi-level dependency propagation
def test_multilevel_dependency_propagation(service):
    # Level 1: Flight -> Level 2: Transfer -> Level 3: Hotel -> Level 4: Evening Activity
    items = [
        {"id": "L1", "type": "flight", "title": "Flight", "start_time": "2026-10-10T08:00:00", "end_time": "2026-10-10T10:00:00"},
        {"id": "L2", "type": "transfer", "title": "Shuttle", "start_time": "2026-10-10T10:30:00", "end_time": "2026-10-10T12:00:00"},
        {"id": "L3", "type": "hotel", "title": "Resort", "start_time": "2026-10-10T14:00:00", "end_time": "2026-10-11T11:00:00"},
        {"id": "L4", "type": "activity", "title": "Evening Safari", "start_time": "2026-10-10T15:00:00", "end_time": "2026-10-10T18:00:00"},
    ]
    deps = [
        {"from": "L1", "to": "L2"},
        {"from": "L2", "to": "L3"},
        {"from": "L3", "to": "L4"},
    ]

    G = service.build_graph(items, deps)
    # 5 hour (300m) delay pushes arrival to 17:00, conflicting with 15:00 activity
    result = service.compute_blast_radius(G, root_item_id="L1", disruption_data={"delay_minutes": 300})

    nodes_by_id = {n["item_id"]: n for n in result["nodes"]}
    assert nodes_by_id["L1"]["impact_type"] == IMPACT_DIRECT
    assert nodes_by_id["L2"]["impact_type"] == IMPACT_DOWNSTREAM
    assert nodes_by_id["L4"]["impact_type"] == IMPACT_DOWNSTREAM
    assert "Time conflict" in nodes_by_id["L4"]["reason"]


# 7. Missing dependency edge (sequential fallback or unlinked components)
def test_missing_dependency_edge(service):
    items = [
        {"id": "A", "type": "flight", "title": "Flight A"},
        {"id": "B", "type": "transfer", "title": "Cab B"},
        {"id": "C", "type": "activity", "title": "Activity C"},
    ]
    # Edge A -> B exists, but edge from B to C is MISSING
    deps = [{"from": "A", "to": "B"}]

    G = service.build_graph(items, deps)
    result = service.compute_blast_radius(G, root_item_id="A", disruption_data={"delay_minutes": 120})

    nodes_by_id = {n["item_id"]: n for n in result["nodes"]}
    assert nodes_by_id["A"]["impact_type"] == IMPACT_DIRECT
    assert nodes_by_id["B"]["impact_type"] in (IMPACT_DOWNSTREAM, IMPACT_AT_RISK)
    # C has no edge, so it remains unaffected
    assert nodes_by_id["C"]["impact_type"] == IMPACT_NOT_AFFECTED


# 8. Circular dependency protection
def test_circular_dependency_protection(service):
    # A -> B -> C -> A (cycle!)
    items = [
        {"id": "node-A", "type": "flight", "title": "A"},
        {"id": "node-B", "type": "transfer", "title": "B"},
        {"id": "node-C", "type": "hotel", "title": "C"},
    ]
    deps = [
        {"from": "node-A", "to": "node-B"},
        {"from": "node-B", "to": "node-C"},
        {"from": "node-C", "to": "node-A"},  # Cycle edge!
    ]

    G = service.build_graph(items, deps)

    # Must be sanitized to DAG
    assert nx.is_directed_acyclic_graph(G)

    # Computation must complete without recursion error or hanging
    result = service.compute_blast_radius(G, root_item_id="node-A", disruption_data={"delay_minutes": 60})
    assert len(result["nodes"]) == 3
    assert result["summary"]["direct"] == 1


# 9. Empty itinerary
def test_empty_itinerary(service):
    G = service.build_graph([], [])
    assert len(G.nodes) == 0

    result = service.compute_blast_radius(G, root_item_id="none", disruption_data={})
    assert result["nodes"] == []
    assert result["edges"] == []
    assert result["summary"]["total"] == 0


# 10. Missing root disruption item
def test_missing_root_disruption_item(service):
    items = [
        {"id": "valid-1", "type": "flight", "title": "Flight 1"},
        {"id": "valid-2", "type": "hotel", "title": "Hotel 2"},
    ]
    G = service.build_graph(items, [{"from": "valid-1", "to": "valid-2"}])

    result = service.compute_blast_radius(G, root_item_id="non-existent-id", disruption_data={})
    assert result["summary"]["direct"] == 0
    assert result["summary"]["not_affected"] == 2
    for node in result["nodes"]:
        assert node["impact_type"] == IMPACT_NOT_AFFECTED
