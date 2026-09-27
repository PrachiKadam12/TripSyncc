"""
itinerary_graph_service.py — Stage 14 NetworkX Dependency Graph & Blast Radius Engine

Core PS2 Disruption Recovery Architecture:
1. Builds a directed NetworkX graph (DiGraph) from connected itinerary items and dependencies.
2. Supports multi-root independent itinerary chains (e.g. Flight A -> Hotel A vs Train B -> Hotel B).
3. Traverses downstream dependencies using NetworkX (descendants, successors, topological sort).
4. Evaluates feasibility and impact deterministically based on timing, buffers, and deadlines.
5. Classifies each node into:
   - DIRECTLY_AFFECTED (direct root disruption)
   - DOWNSTREAM_AFFECTED (broken connection or missed schedule)
   - AT_RISK (tight buffer, late check-in warning)
   - PRESERVED (downstream node remaining feasible)
   - NOT_AFFECTED (independent chains or unrelated nodes)
6. Includes cycle detection and circular dependency protection.
"""

from typing import Dict, List, Any, Optional, Set, Tuple
from datetime import datetime, timedelta
import logging
import networkx as nx

logger = logging.getLogger("tripsync.graph_service")


# Impact type constants matching Stage 14 specifications
IMPACT_DIRECT = "direct"
IMPACT_DOWNSTREAM = "downstream"
IMPACT_AT_RISK = "at_risk"
IMPACT_PRESERVED = "preserved"
IMPACT_NOT_AFFECTED = "not_affected"

# Status uppercase aliases
STATUS_DIRECT = "DIRECTLY_AFFECTED"
STATUS_DOWNSTREAM = "DOWNSTREAM_AFFECTED"
STATUS_AT_RISK = "AT_RISK"
STATUS_PRESERVED = "PRESERVED"
STATUS_NOT_AFFECTED = "NOT_AFFECTED"


def parse_datetime_safe(val: Any) -> Optional[datetime]:
    """Safely parse various datetime formats into a datetime object."""
    if not val:
        return None
    if isinstance(val, datetime):
        return val
    if isinstance(val, (int, float)):
        try:
            return datetime.fromtimestamp(val / 1000.0 if val > 1e11 else val)
        except Exception:
            return None
    if isinstance(val, str):
        val = val.strip()
        # Remove trailing Z if present for ISO parsing
        if val.endswith("Z"):
            val = val[:-1]
        for fmt in (
            "%Y-%m-%dT%H:%M:%S.%f",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d",
            "%d %b %Y %H:%M",
            "%d-%m-%Y %H:%M:%S",
        ):
            try:
                return datetime.strptime(val, fmt)
            except ValueError:
                continue
    return None


class ItineraryGraphService:
    """
    NetworkX-based dependency graph engine for Stage 14 travel itineraries.
    """

    def __init__(self):
        self.default_min_transfer_buffer = 30  # minutes
        self.default_hotel_checkin_cutoff_hour = 23
        self.default_hotel_checkin_cutoff_minute = 30

    def build_graph(
        self,
        items: List[Dict[str, Any]],
        dependencies: Optional[List[Dict[str, Any]]] = None,
    ) -> nx.DiGraph:
        """
        Build a directed NetworkX graph from itinerary items and dependency definitions.

        Supports:
        - Explicit dependency lists: [{"from_item_id": "...", "to_item_id": "...", ...}]
        - Implicit item attributes: item.get("depends_on"), item.get("next_item_id")
        - Multi-root chains (via chain_id or disconnected components)
        - Sequential fallback within chains/trips if no explicit dependencies exist
        """
        G = nx.DiGraph()

        if not items:
            return G

        # 1. Add all items as nodes with normalized attributes
        for item in items:
            item_id = str(item.get("id") or item.get("item_id") or "")
            if not item_id:
                continue

            node_attrs = {
                "item_id": item_id,
                "item_type": str(item.get("type") or item.get("itemType") or item.get("booking_type") or "other").lower(),
                "title": str(item.get("title") or item.get("name") or "Itinerary Item"),
                "location": item.get("location") or item.get("destination") or item.get("city") or "",
                "start_time": item.get("start_time") or item.get("startDateTime") or item.get("departure_at"),
                "end_time": item.get("end_time") or item.get("endDateTime") or item.get("arrival_at"),
                "booking_id": item.get("booking_id") or item.get("booking_ref") or item.get("rawId"),
                "status": item.get("status") or "scheduled",
                "chain_id": item.get("chain_id") or item.get("group_id") or None,
                "dependency_metadata": item.get("metadata") or item.get("dependency_metadata") or {},
                "raw_item": item,
            }
            G.add_node(item_id, **node_attrs)

        # 2. Add explicit dependencies if provided
        edges_added = False
        if dependencies:
            for dep in dependencies:
                from_id = str(dep.get("from_item_id") or dep.get("from") or dep.get("source") or "")
                to_id = str(dep.get("to_item_id") or dep.get("to") or dep.get("target") or "")

                if from_id and to_id and from_id in G and to_id in G:
                    edge_attrs = {
                        "relationship": dep.get("dependency_type") or dep.get("relationship") or "connection",
                        "minimum_buffer_minutes": int(dep.get("minimum_buffer_minutes") or dep.get("buffer_minutes") or self.default_min_transfer_buffer),
                        "description": dep.get("description") or f"{from_id} -> {to_id}",
                    }
                    G.add_edge(from_id, to_id, **edge_attrs)
                    edges_added = True

        # 3. Add item-level dependency declarations (depends_on / parent_id / next_item_id)
        for item in items:
            item_id = str(item.get("id") or item.get("item_id") or "")
            if not item_id or item_id not in G:
                continue

            # Inbound dependencies
            depends_on = item.get("depends_on") or item.get("parent_id")
            if depends_on:
                parent_ids = depends_on if isinstance(depends_on, list) else [depends_on]
                for pid in parent_ids:
                    pid_str = str(pid)
                    if pid_str in G:
                        G.add_edge(pid_str, item_id, relationship="dependency", minimum_buffer_minutes=self.default_min_transfer_buffer)
                        edges_added = True

            # Outbound dependencies
            next_id = item.get("next_item_id")
            if next_id:
                next_ids = next_id if isinstance(next_id, list) else [next_id]
                for nid in next_ids:
                    nid_str = str(nid)
                    if nid_str in G:
                        G.add_edge(item_id, nid_str, relationship="sequence", minimum_buffer_minutes=self.default_min_transfer_buffer)
                        edges_added = True

        # 4. If no explicit edges were supplied, build dynamic connections grouped by chain_id
        if not edges_added:
            # Group items by chain_id (or all together if no chain_id is defined)
            chains: Dict[str, List[Dict[str, Any]]] = {}
            for item in items:
                cid = str(item.get("chain_id") or "default_chain")
                chains.setdefault(cid, []).append(item)

            for cid, chain_items in chains.items():
                # Sort chain items by start_time or sequence_no / sort_order
                def sort_key(it):
                    dt = parse_datetime_safe(it.get("start_time") or it.get("startDateTime") or it.get("departure_at"))
                    seq = it.get("sequence_no") if it.get("sequence_no") is not None else it.get("sort_order", 0)
                    return (dt or datetime.max, seq)

                sorted_chain = sorted(chain_items, key=sort_key)
                for idx in range(len(sorted_chain) - 1):
                    src_id = str(sorted_chain[idx].get("id") or sorted_chain[idx].get("item_id"))
                    dst_id = str(sorted_chain[idx + 1].get("id") or sorted_chain[idx + 1].get("item_id"))
                    if src_id in G and dst_id in G:
                        src_type = G.nodes[src_id].get("item_type")
                        dst_type = G.nodes[dst_id].get("item_type")
                        rel = "connection"
                        if src_type == "flight" and dst_type in ("transfer", "cab", "train"):
                            rel = "layover"
                        elif dst_type == "hotel":
                            rel = "arrival_checkin"
                        elif dst_type == "activity":
                            rel = "activity_transition"

                        G.add_edge(src_id, dst_id, relationship=rel, minimum_buffer_minutes=self.default_min_transfer_buffer)

        # 5. Circular Dependency Protection: break any detected cycles to ensure DAG
        self._sanitize_cycles(G)

        return G

    def _sanitize_cycles(self, G: nx.DiGraph) -> None:
        """
        Detect and break any directed cycles in the graph to protect traversal
        against infinite loops while logging warnings.
        """
        if not nx.is_directed_acyclic_graph(G):
            try:
                cycles = list(nx.simple_cycles(G))
                logger.warning(f"Circular dependency detected in itinerary graph: {cycles}")
                for cycle in cycles:
                    if len(cycle) >= 2:
                        # Break the closing back-edge
                        u, v = cycle[-1], cycle[0]
                        if G.has_edge(u, v):
                            G.remove_edge(u, v)
                            logger.info(f"Broken cycle back-edge: {u} -> {v}")
            except Exception as e:
                logger.error(f"Error handling graph cycles: {e}")

    def compute_blast_radius(
        self,
        G: nx.DiGraph,
        root_item_id: str,
        disruption_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Calculate blast radius impact propagation across the NetworkX graph.

        Deterministic impact classification:
        - DIRECTLY_AFFECTED: The root disrupted item
        - DOWNSTREAM_AFFECTED: Dependent items with broken connection or missed schedule
        - AT_RISK: Dependent items with narrow transfer buffers or late check-in
        - PRESERVED: Downstream items whose schedule remains feasible
        - NOT_AFFECTED: Items not reachable from root (independent chains or prior items)
        """
        disruption_data = disruption_data or {}
        disruption_id = disruption_data.get("id") or disruption_data.get("disruption_id") or "disr-root"
        delay_minutes = int(
            disruption_data.get("expected_delay_minutes")
            or disruption_data.get("delay_minutes")
            or 240
        )
        disruption_title = disruption_data.get("title") or disruption_data.get("disruption_type") or "Flight Disruption"

        # Edge case: Empty graph
        if len(G) == 0:
            return {
                "disruption_id": disruption_id,
                "root_item_id": root_item_id,
                "nodes": [],
                "edges": [],
                "summary": {
                    "direct": 0,
                    "downstream": 0,
                    "at_risk": 0,
                    "preserved": 0,
                    "not_affected": 0,
                    "total": 0,
                },
            }

        # Edge case: Root item not found in graph
        root_str = str(root_item_id)
        if root_str not in G:
            logger.warning(f"Root item {root_str} not found in itinerary graph.")
            all_nodes = []
            for n_id, data in G.nodes(data=True):
                all_nodes.append({
                    "item_id": n_id,
                    "item_type": data.get("item_type", "other"),
                    "title": data.get("title", ""),
                    "impact_type": IMPACT_NOT_AFFECTED,
                    "status": STATUS_NOT_AFFECTED,
                    "severity": "none",
                    "reason": "Root disruption item was not found in itinerary.",
                    "start_time": data.get("start_time"),
                    "end_time": data.get("end_time"),
                    "location": data.get("location"),
                })
            return {
                "disruption_id": disruption_id,
                "root_item_id": root_str,
                "nodes": all_nodes,
                "edges": self._extract_edges(G),
                "summary": {
                    "direct": 0,
                    "downstream": 0,
                    "at_risk": 0,
                    "preserved": 0,
                    "not_affected": len(all_nodes),
                    "total": len(all_nodes),
                },
            }

        # 1. Use NetworkX to find all reachable downstream dependent nodes
        reachable_descendants: Set[str] = nx.descendants(G, root_str)

        # Build node impact mapping
        node_results: Dict[str, Dict[str, Any]] = {}

        # 2. Mark root item as DIRECTLY_AFFECTED
        root_data = G.nodes[root_str]
        node_results[root_str] = {
            "item_id": root_str,
            "item_type": root_data.get("item_type", "flight"),
            "title": root_data.get("title", "Disrupted Item"),
            "impact_type": IMPACT_DIRECT,
            "status": STATUS_DIRECT,
            "severity": "high",
            "reason": f"Direct disruption source: {disruption_title} (+{delay_minutes}m delay)",
            "start_time": root_data.get("start_time"),
            "end_time": root_data.get("end_time"),
            "location": root_data.get("location"),
        }

        # 3. Mark all nodes outside descendants as NOT_AFFECTED
        for node_id, data in G.nodes(data=True):
            if node_id != root_str and node_id not in reachable_descendants:
                node_results[node_id] = {
                    "item_id": node_id,
                    "item_type": data.get("item_type", "other"),
                    "title": data.get("title", ""),
                    "impact_type": IMPACT_NOT_AFFECTED,
                    "status": STATUS_NOT_AFFECTED,
                    "severity": "none",
                    "reason": "Independent branch / unaffected by disruption chain",
                    "start_time": data.get("start_time"),
                    "end_time": data.get("end_time"),
                    "location": data.get("location"),
                }

        # 4. Evaluate reachable downstream nodes deterministically along dependency edges
        # Use topological sorting of the induced subgraph for chronological propagation
        subgraph_nodes = reachable_descendants.union({root_str})
        subgraph = G.subgraph(subgraph_nodes)

        # Topological order ensures parents are evaluated before children
        try:
            topo_order = list(nx.topological_sort(subgraph))
        except nx.NetworkXUnfeasible:
            # If cycle somehow remains, fall back to BFS order
            bfs_edges = list(nx.bfs_edges(G, root_str))
            topo_order = [root_str] + [v for _, v in bfs_edges]

        # Track accumulated delay for each node
        accumulated_delays: Dict[str, int] = {root_str: delay_minutes}

        for current_id in topo_order:
            if current_id == root_str:
                continue

            current_data = G.nodes[current_id]
            current_type = current_data.get("item_type", "other")
            current_start = parse_datetime_safe(current_data.get("start_time"))
            current_end = parse_datetime_safe(current_data.get("end_time"))

            # Determine incoming dependencies from predecessors in G
            predecessors = list(G.predecessors(current_id))
            max_incoming_delay = 0
            worst_pred_id = None

            for pred_id in predecessors:
                if pred_id in accumulated_delays:
                    pred_delay = accumulated_delays[pred_id]
                    if pred_delay > max_incoming_delay:
                        max_incoming_delay = pred_delay
                        worst_pred_id = pred_id

            edge_data = G.get_edge_data(worst_pred_id, current_id) if worst_pred_id else {}
            min_buffer = edge_data.get("minimum_buffer_minutes", self.default_min_transfer_buffer) if edge_data else self.default_min_transfer_buffer

            # Deterministic evaluation logic
            impact_type = IMPACT_PRESERVED
            status = STATUS_PRESERVED
            severity = "low"
            reason = "Preserved: timing remains feasible within schedule"

            pred_data = G.nodes[worst_pred_id] if worst_pred_id else {}
            pred_end = parse_datetime_safe(pred_data.get("end_time") or pred_data.get("start_time"))

            # A. Transport / Transfer connection
            if current_type in ("transfer", "cab", "bus", "train", "flight"):
                if pred_end and current_start:
                    scheduled_buffer = int((current_start - pred_end).total_seconds() / 60)
                    available_buffer = scheduled_buffer - max_incoming_delay

                    if available_buffer < 0:
                        impact_type = IMPACT_DOWNSTREAM
                        status = STATUS_DOWNSTREAM
                        severity = "high"
                        reason = f"Missed connection: delay exceeds scheduled buffer by {abs(available_buffer)}m"
                        accumulated_delays[current_id] = max_incoming_delay
                    elif available_buffer < min_buffer:
                        impact_type = IMPACT_AT_RISK
                        status = STATUS_AT_RISK
                        severity = "medium"
                        reason = f"Tight transfer: only {available_buffer}m buffer remaining (minimum required: {min_buffer}m)"
                        accumulated_delays[current_id] = max_incoming_delay
                    else:
                        impact_type = IMPACT_PRESERVED
                        status = STATUS_PRESERVED
                        severity = "low"
                        reason = f"Transfer buffer of {available_buffer}m absorbs delay"
                        accumulated_delays[current_id] = 0
                else:
                    # No explicit timing; inherit downstream delay
                    impact_type = IMPACT_DOWNSTREAM if max_incoming_delay > 60 else IMPACT_AT_RISK
                    status = STATUS_DOWNSTREAM if max_incoming_delay > 60 else STATUS_AT_RISK
                    severity = "medium"
                    reason = f"Downstream schedule impacted by +{max_incoming_delay}m delay"
                    accumulated_delays[current_id] = max_incoming_delay

            # B. Hotel Check-in
            elif current_type == "hotel":
                # Check check-in deadline
                hotel_deadline = parse_datetime_safe(current_data.get("dependency_metadata", {}).get("checkin_deadline"))
                est_arrival = (pred_end + timedelta(minutes=max_incoming_delay)) if pred_end else None

                if est_arrival and hotel_deadline:
                    if est_arrival > hotel_deadline:
                        impact_type = IMPACT_AT_RISK
                        status = STATUS_AT_RISK
                        severity = "medium"
                        reason = f"Late check-in: arrival at {est_arrival.strftime('%H:%M')} exceeds check-in deadline"
                    else:
                        impact_type = IMPACT_PRESERVED
                        status = STATUS_PRESERVED
                        severity = "low"
                        reason = f"Arrives before hotel check-in deadline ({hotel_deadline.strftime('%H:%M')})"
                elif est_arrival:
                    if est_arrival.hour > self.default_hotel_checkin_cutoff_hour or (
                        est_arrival.hour == self.default_hotel_checkin_cutoff_hour
                        and est_arrival.minute > self.default_hotel_checkin_cutoff_minute
                    ):
                        impact_type = IMPACT_AT_RISK
                        status = STATUS_AT_RISK
                        severity = "medium"
                        reason = f"Late night arrival ({est_arrival.strftime('%H:%M')}): requires hotel late check-in notification"
                    else:
                        impact_type = IMPACT_PRESERVED
                        status = STATUS_PRESERVED
                        severity = "low"
                        reason = f"Arrival at {est_arrival.strftime('%H:%M')} is within standard reception hours"
                else:
                    impact_type = IMPACT_PRESERVED
                    status = STATUS_PRESERVED
                    severity = "low"
                    reason = "Hotel booking preserved"

                accumulated_delays[current_id] = max_incoming_delay

            # C. Scheduled Activity
            elif current_type == "activity":
                est_arrival = (pred_end + timedelta(minutes=max_incoming_delay)) if pred_end else None
                if est_arrival and current_start:
                    if est_arrival > current_start:
                        impact_type = IMPACT_DOWNSTREAM
                        status = STATUS_DOWNSTREAM
                        severity = "high"
                        reason = f"Time conflict: delay pushes arrival past scheduled activity start ({current_start.strftime('%H:%M')})"
                    elif (current_start - est_arrival).total_seconds() < 3600:
                        impact_type = IMPACT_AT_RISK
                        status = STATUS_AT_RISK
                        severity = "medium"
                        reason = "Tight schedule: less than 1 hour between arrival and activity start"
                    else:
                        impact_type = IMPACT_PRESERVED
                        status = STATUS_PRESERVED
                        severity = "low"
                        reason = f"Activity starts after arrival ({current_start.strftime('%H:%M')}) — unaffected"
                else:
                    impact_type = IMPACT_PRESERVED
                    status = STATUS_PRESERVED
                    severity = "low"
                    reason = "Activity schedule preserved"

                accumulated_delays[current_id] = max_incoming_delay

            # D. Generic node
            else:
                if max_incoming_delay > 180:
                    impact_type = IMPACT_DOWNSTREAM
                    status = STATUS_DOWNSTREAM
                    severity = "medium"
                    reason = f"Downstream itinerary shift of +{max_incoming_delay}m"
                elif max_incoming_delay > 30:
                    impact_type = IMPACT_AT_RISK
                    status = STATUS_AT_RISK
                    severity = "low"
                    reason = f"Minor buffer compression from +{max_incoming_delay}m delay"
                else:
                    impact_type = IMPACT_PRESERVED
                    status = STATUS_PRESERVED
                    severity = "low"
                    reason = "Item unaffected by upstream schedule changes"

                accumulated_delays[current_id] = max_incoming_delay

            node_results[current_id] = {
                "item_id": current_id,
                "item_type": current_type,
                "title": current_data.get("title", ""),
                "impact_type": impact_type,
                "status": status,
                "severity": severity,
                "reason": reason,
                "start_time": current_data.get("start_time"),
                "end_time": current_data.get("end_time"),
                "location": current_data.get("location"),
            }

        # 5. Build normalized response matching Stage 14 specifications
        nodes_list = list(node_results.values())
        edges_list = self._extract_edges(G)

        summary = {
            "direct": sum(1 for n in nodes_list if n["impact_type"] == IMPACT_DIRECT),
            "downstream": sum(1 for n in nodes_list if n["impact_type"] == IMPACT_DOWNSTREAM),
            "at_risk": sum(1 for n in nodes_list if n["impact_type"] == IMPACT_AT_RISK),
            "preserved": sum(1 for n in nodes_list if n["impact_type"] == IMPACT_PRESERVED),
            "not_affected": sum(1 for n in nodes_list if n["impact_type"] == IMPACT_NOT_AFFECTED),
            "total": len(nodes_list),
        }

        return {
            "disruption_id": disruption_id,
            "root_item_id": root_str,
            "nodes": nodes_list,
            "edges": edges_list,
            "summary": summary,
        }

    def _extract_edges(self, G: nx.DiGraph) -> List[Dict[str, Any]]:
        """Extract and normalize all edges from the NetworkX graph."""
        edges = []
        for u, v, data in G.edges(data=True):
            edges.append({
                "from": u,
                "to": v,
                "relationship": data.get("relationship", "connection"),
                "minimum_buffer_minutes": data.get("minimum_buffer_minutes", self.default_min_transfer_buffer),
                "description": data.get("description", f"{u} -> {v}"),
            })
        return edges


# Singleton instance for application-wide reuse
itinerary_graph_service = ItineraryGraphService()
