"""Discrete-time agent-based traffic model on a configurable road graph."""
from __future__ import annotations

import heapq
import math
import random
from collections import defaultdict


NODES = [
    {"id": "N1", "x": .10, "y": .15, "signal": False},
    {"id": "N2", "x": .50, "y": .15, "signal": True},
    {"id": "N3", "x": .90, "y": .15, "signal": False},
    {"id": "N4", "x": .10, "y": .50, "signal": True},
    {"id": "N5", "x": .50, "y": .50, "signal": True},
    {"id": "N6", "x": .90, "y": .50, "signal": True},
    {"id": "N7", "x": .10, "y": .85, "signal": False},
    {"id": "N8", "x": .50, "y": .85, "signal": True},
    {"id": "N9", "x": .90, "y": .85, "signal": False},
]


def make_edges(arterial_lanes: int = 2, local_lanes: int = 1,
               flyover: bool = True) -> list[dict]:
    pairs = [("N1", "N2", "arterial"), ("N2", "N3", "arterial"),
             ("N4", "N5", "arterial"), ("N5", "N6", "arterial"),
             ("N7", "N8", "arterial"), ("N8", "N9", "arterial"),
             ("N1", "N4", "local"), ("N4", "N7", "local"),
             ("N2", "N5", "arterial"), ("N5", "N8", "arterial"),
             ("N3", "N6", "local"), ("N6", "N9", "local")]
    node_by_id = {n["id"]: n for n in NODES}
    edges = []
    for i, (a, b, kind) in enumerate(pairs, 1):
        na, nb = node_by_id[a], node_by_id[b]
        length = round(math.hypot(
            (na["x"]-nb["x"])*1200, (na["y"]-nb["y"])*900))
        arterial = kind == "arterial"
        edges.append({"id": f"R{i}", "from": a, "to": b, "length_m": length,
                      "lanes": arterial_lanes if arterial else local_lanes,
                      "speed_kmh": 50 if arterial else 35, "kind": kind, "flyover": False})
    if flyover:
        # This link jumps over N5, so it has no at-grade crossing conflict there.
        edges.append({"id": "F1", "from": "N2", "to": "N6", "length_m": 540,
                      "lanes": 2, "speed_kmh": 70, "kind": "flyover", "flyover": True})
    return edges


def _shortest_path(start: str, end: str, edges: list[dict]) -> list[tuple[str, str, str]]:
    graph: dict[str, list[tuple[str, str, float]]] = defaultdict(list)
    for edge in edges:
        cost = edge["length_m"] / (edge["speed_kmh"] / 3.6)
        graph[edge["from"]].append((edge["to"], edge["id"], cost))
        graph[edge["to"]].append((edge["from"], edge["id"], cost))
    queue = [(0.0, start, [])]
    best = {}
    while queue:
        cost, node, route = heapq.heappop(queue)
        if node in best and best[node] <= cost:
            continue
        best[node] = cost
        if node == end:
            return route
        for nxt, edge_id, weight in graph[node]:
            if nxt not in best:
                heapq.heappush(queue, (cost + weight, nxt,
                               route + [(edge_id, node, nxt)]))
    return []


def simulate(vehicles: int = 120, duration_s: int = 240, signal_cycle_s: int = 60,
             arterial_lanes: int = 2, local_lanes: int = 1, flyover: bool = True,
             seed: int = 7) -> dict:
    if not 20 <= vehicles <= 500:
        raise ValueError("Vehicle demand must be between 20 and 500.")
    if not 60 <= duration_s <= 600:
        raise ValueError(
            "Simulation duration must be between 60 and 600 seconds.")
    if not 30 <= signal_cycle_s <= 120:
        raise ValueError("Signal cycle must be between 30 and 120 seconds.")
    if arterial_lanes not in (1, 2, 3, 4) or local_lanes not in (1, 2):
        raise ValueError(
            "Arterials allow 1–4 lanes; local roads allow 1–2 lanes.")

    rng = random.Random(seed)
    edges = make_edges(arterial_lanes, local_lanes, flyover)
    edge_by_id = {e["id"]: e for e in edges}
    node_by_id = {n["id"]: n for n in NODES}
    perimeter = ["N1", "N2", "N3", "N4", "N6", "N7", "N8", "N9"]
    arrivals = []
    for i in range(vehicles):
        origin = rng.choice(perimeter)
        destination = rng.choice([n for n in perimeter if n != origin])
        arrivals.append((i * duration_s / vehicles, origin, destination))

    cars: list[dict] = []
    frames, completed_times, moving_speeds = [], [], []
    total_distance = 0.0
    max_queue = 0
    signal_offset = {node_id: (i * signal_cycle_s // 3)
                     for i, node_id in enumerate(node_by_id)}
    spawn_cursor = 0

    def signal_green(node: str, t: int) -> bool:
        return (t + signal_offset[node]) % signal_cycle_s < signal_cycle_s * .52

    def current_lane_counts() -> dict[tuple[str, str, str, int], int]:
        counts: dict[tuple[str, str, str, int], int] = defaultdict(int)
        for car in cars:
            if car["leg"] < len(car["route"]):
                edge_id, a, b = car["route"][car["leg"]]
                counts[(edge_id, a, b, car["lane"])] += 1
        return counts

    def lane_capacity(edge_id: str) -> int:
        # Storage capacity: one vehicle per 8 metres per lane.
        return max(1, edge_by_id[edge_id]["length_m"] // 8)

    for t in range(duration_s + 1):
        while spawn_cursor < len(arrivals) and arrivals[spawn_cursor][0] <= t:
            _, origin, destination = arrivals[spawn_cursor]
            route = _shortest_path(origin, destination, edges)
            if route:
                edge_id, a, b = route[0]
                counts = current_lane_counts()
                lane = min(range(edge_by_id[edge_id]["lanes"]),
                           key=lambda i: counts[(edge_id, a, b, i)])
                cars.append({"id": spawn_cursor + 1, "origin": origin, "destination": destination,
                             "route": route, "leg": 0, "lane": lane, "progress": 0.0,
                             "speed": 0.0, "born": t, "waiting": True})
            spawn_cursor += 1

        # Follow a lead vehicle in the same lane, respecting lane-specific headway.
        on_lane: dict[tuple[str, str, str, int],
                      list[dict]] = defaultdict(list)
        for car in cars:
            if car["leg"] < len(car["route"]):
                edge_id, a, b = car["route"][car["leg"]]
                on_lane[(edge_id, a, b, car["lane"])].append(car)
        for (edge_id, a, b, lane), lane_cars in on_lane.items():
            lane_cars.sort(key=lambda c: c["progress"], reverse=True)
            edge = edge_by_id[edge_id]
            front_progress = None
            for car in lane_cars:
                length = edge["length_m"]
                free_speed = edge["speed_kmh"] / 3.6
                desired = free_speed
                if front_progress is not None:
                    gap = front_progress - car["progress"]
                    desired = min(desired, max(0.0, (gap - 7.0) / 1.4))
                at_end = car["leg"] == len(car["route"]) - 1
                if not at_end and node_by_id[b]["signal"] and not signal_green(b, t):
                    desired = min(desired, max(
                        0.0, (length - 5.0 - car["progress"]) / 1.4))
                advance = min(desired, max(0.0, length - car["progress"]))
                car["speed"] = advance
                car["progress"] += advance
                car["waiting"] = advance < .15
                if advance >= .15:
                    moving_speeds.append(advance * 3.6)
                total_distance += advance
                front_progress = car["progress"]

        # Junctions serve one vehicle per second; lane storage limits entry to the next road.
        occupancy = current_lane_counts()
        junction_used = set()
        completed_ids = set()
        for car in sorted(cars, key=lambda c: c["id"]):
            if car["leg"] >= len(car["route"]):
                continue
            edge_id, a, b = car["route"][car["leg"]]
            edge = edge_by_id[edge_id]
            if car["progress"] < edge["length_m"] - .5:
                continue
            current_key = (edge_id, a, b, car["lane"])
            if car["leg"] == len(car["route"]) - 1:
                completed_times.append(t - car["born"])
                occupancy[current_key] -= 1
                completed_ids.add(car["id"])
                car["leg"] += 1
                continue
            if node_by_id[b]["signal"] and not signal_green(b, t):
                car["progress"] = edge["length_m"] - 5.0
                car["speed"] = 0.0
                car["waiting"] = True
                continue
            if b in junction_used:
                car["progress"] = edge["length_m"] - 5.0
                car["speed"] = 0.0
                car["waiting"] = True
                continue
            next_edge_id, next_a, next_b = car["route"][car["leg"] + 1]
            next_edge = edge_by_id[next_edge_id]
            candidates = sorted(range(next_edge["lanes"]),
                                key=lambda lane: occupancy[(next_edge_id, next_a, next_b, lane)])
            free_lanes = [lane for lane in candidates
                          if occupancy[(next_edge_id, next_a, next_b, lane)] < lane_capacity(next_edge_id)]
            if not free_lanes:
                car["progress"] = edge["length_m"] - 5.0
                car["speed"] = 0.0
                car["waiting"] = True
                continue
            next_lane = free_lanes[0]
            junction_used.add(b)
            occupancy[current_key] -= 1
            occupancy[(next_edge_id, next_a, next_b, next_lane)] += 1
            car["leg"] += 1
            car["lane"] = next_lane
            car["progress"] = 0.0

        if completed_ids:
            cars = [c for c in cars if c["id"] not in completed_ids]
        queue_count = sum(1 for c in cars if c["waiting"])
        max_queue = max(max_queue, queue_count)

        if t % 2 == 0 or t == duration_s:
            frame_cars = []
            density = []
            for car in cars:
                if car["leg"] >= len(car["route"]):
                    continue
                edge_id, a, b = car["route"][car["leg"]]
                edge = edge_by_id[edge_id]
                na, nb = node_by_id[a], node_by_id[b]
                frac = min(1.0, car["progress"] / edge["length_m"])
                frame_cars.append({"id": car["id"], "edge": edge_id,
                                  "x": na["x"] + (nb["x"]-na["x"])*frac,
                                   "y": na["y"] + (nb["y"]-na["y"])*frac,
                                   "heading": math.degrees(math.atan2(nb["y"]-na["y"], nb["x"]-na["x"])),
                                   "lane": car["lane"], "lanes": edge["lanes"],
                                   "speed_kmh": round(car["speed"]*3.6, 1), "waiting": car["waiting"],
                                   "flyover": edge["flyover"]})
            for edge in edges:
                count = sum(1 for c in cars if c["leg"] < len(c["route"])
                            and c["route"][c["leg"]][0] == edge["id"])
                capacity = max(1, edge["lanes"] * lane_capacity(edge["id"]))
                density.append({"edge": edge["id"], "vehicles": count,
                                "capacity": capacity, "utilization": round(min(1, count/capacity), 3)})
            signals = [{"node": n["id"], "state": "green" if signal_green(n["id"], t) else "red"}
                       for n in NODES if n["signal"]]
            frames.append({"time_s": t, "cars": frame_cars, "queue": queue_count,
                           "density": density, "signals": signals})

    avg_trip = round(sum(completed_times)/len(completed_times),
                     1) if completed_times else None
    avg_speed = round(sum(moving_speeds)/len(moving_speeds),
                      1) if moving_speeds else 0
    max_utilization = max((d["utilization"]
                          for f in frames for d in f["density"]), default=0)
    return {"nodes": NODES, "edges": edges, "frames": frames,
            "metrics": {"demand": vehicles, "completed": len(completed_times),
                        "in_network": len(cars), "completion_pct": round(100*len(completed_times)/vehicles, 1),
                        "avg_trip_s": avg_trip, "avg_speed_kmh": avg_speed, "max_queue": max_queue,
                        "peak_link_utilization": round(max_utilization*100, 1),
                        "vehicle_km": round(total_distance/1000, 2),
                        "estimated_co2_kg": round(total_distance/1000*.19, 2)},
            "settings": {"duration_s": duration_s, "signal_cycle_s": signal_cycle_s,
                         "arterial_lanes": arterial_lanes, "local_lanes": local_lanes,
                         "flyover": flyover, "seed": seed}}
