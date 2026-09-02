"""
spatial.py — Dependency-free spatial utilities for RailMind AI.

Provides haversine distance and radius-based train/station search used by
the hybrid event enrichment layer to correlate live trains with events.
"""
import math
from typing import Any, Dict, List, Optional


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Return the great-circle distance in kilometres between two WGS-84 points.

    Uses the haversine formula — accurate to within ~0.5% for distances up to
    several thousand kilometres, which is more than sufficient for India-scale
    railway operations.
    """
    earth_radius_km = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = (
        math.sin(dphi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
    )
    return earth_radius_km * 2.0 * math.asin(math.sqrt(a))


def find_nearby_trains(
    event_lat: float,
    event_lon: float,
    trains: List[Dict[str, Any]],
    radius_km: float = 25.0,
) -> List[Dict[str, Any]]:
    """
    Return all trains within *radius_km* of (event_lat, event_lon), sorted
    by ascending distance.

    Each entry in *trains* must be a dict using the project's snake_case schema
    (fields: latitude, longitude, train_number, train_name, current_speed,
    delay_minutes).  Missing lat/lon trains are silently skipped.

    Returns a list of dicts; each dict carries the original train fields
    plus a computed ``distance_km`` key.
    """
    affected: List[Dict[str, Any]] = []
    for train in trains:
        lat = train.get("latitude")
        lon = train.get("longitude")
        if lat is None or lon is None:
            continue
        try:
            distance = haversine_km(event_lat, event_lon, float(lat), float(lon))
        except (TypeError, ValueError):
            continue
        if distance <= radius_km:
            affected.append(
                {
                    "train_number": train.get("train_number"),
                    "train_name": train.get("train_name"),
                    "distance_km": round(distance, 2),
                    "current_speed": train.get("current_speed"),
                    "delay_minutes": train.get("delay_minutes"),
                    "latitude": lat,
                    "longitude": lon,
                    "source": train.get("source", "simulation"),
                    "stale": train.get("stale", False),
                }
            )
    return sorted(affected, key=lambda x: x["distance_km"])


def nearest_station(
    event_lat: float,
    event_lon: float,
    stations: List[Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    """
    Return the closest station dict to (event_lat, event_lon) together with
    a computed ``distance_km`` key, or None if *stations* is empty.

    Station dicts are expected to carry at minimum: id, name, latitude,
    longitude (matching the project's Station.to_dict() shape).
    """
    best: Optional[Dict[str, Any]] = None
    best_dist = float("inf")
    for station in stations:
        lat = station.get("latitude")
        lon = station.get("longitude")
        if lat is None or lon is None:
            continue
        try:
            d = haversine_km(event_lat, event_lon, float(lat), float(lon))
        except (TypeError, ValueError):
            continue
        if d < best_dist:
            best_dist = d
            best = {**station, "distance_km": round(d, 2)}
    return best
