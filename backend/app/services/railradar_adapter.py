"""
railradar_adapter.py — Backend-only adapter for the RailRadar REST API.

Normalises RailRadar responses into RailMind AI's existing snake_case schema.
The API key is read exclusively from the RAILRADAR_API_KEY environment variable
and is never forwarded to the frontend under any circumstances.

Fail-safe behaviour
-------------------
* If RAILRADAR_API_KEY is unset the adapter raises RailRadarError on every
  live call.  Callers (LiveRailManager) catch that and fall back to
  simulation-only mode — the app boots and runs normally without a key.
* On transient failures (timeout, 429, 5xx) the adapter returns the last
  known-good snapshot for a train, marked stale=True.
* Route geometry is cached for the full session; it is never re-fetched.
"""

import asyncio
import logging
import os
import time
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)


class RailRadarError(Exception):
    """Raised when the RailRadar API returns an error or is unavailable."""


class LiveRailAdapter:
    """Async adapter for the RailRadar REST API (https://api.railradar.in)."""

    BASE_URL = "https://api.railradar.in"

    def __init__(self) -> None:
        self.api_key: Optional[str] = os.getenv("RAILRADAR_API_KEY") or None
        self.timeout = float(os.getenv("RAILRADAR_REQUEST_TIMEOUT_SECONDS", "15"))
        self.poll_interval = int(os.getenv("RAILRADAR_POLL_INTERVAL_SECONDS", "300"))
        self.max_concurrent = int(os.getenv("RAILRADAR_MAX_CONCURRENT_REQUESTS", "5"))

        # position cache:  train_number → {timestamp, data}
        self._cache: Dict[str, Dict[str, Any]] = {}
        # route geometry cache — session-long, never evicted
        self._route_cache: Dict[str, Dict[str, Any]] = {}
        # per-train last-known-good (for stale fallback)
        self._last_known_good: Dict[str, Dict[str, Any]] = {}
        # rate limit backoff timestamp
        self._rate_limited_until: float = 0.0
        # concurrency cap
        self._semaphore: asyncio.Semaphore = asyncio.Semaphore(self.max_concurrent)

    # ------------------------------------------------------------------ #
    # Private helpers                                                      #
    # ------------------------------------------------------------------ #

    def _headers(self) -> Dict[str, str]:
        if not self.api_key:
            raise RailRadarError(
                "RAILRADAR_API_KEY is not configured — running in simulation-only mode."
            )
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/json",
        }

    async def _get(
        self, path: str, params: Optional[Dict[str, str]] = None
    ) -> Any:
        """Make an authenticated GET request and return the ``data`` payload."""
        now = time.time()
        if self._rate_limited_until and now < self._rate_limited_until:
            cooldown_left = int(self._rate_limited_until - now)
            raise RailRadarError(f"RailRadar rate limit backoff active ({cooldown_left}s remaining).")

        url = f"{self.BASE_URL}{path}"
        async with self._semaphore:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    url, headers=self._headers(), params=params or {}
                )

        if response.status_code == 429:
            self._rate_limited_until = time.time() + 300  # 5-minute backoff
            logger.warning("RailRadar returned 429 Too Many Requests — backing off for 300 seconds")
            raise RailRadarError("RailRadar rate limit reached (HTTP 429).")

        if response.status_code in (401, 403):
            raise RailRadarError(f"RailRadar authentication failed (HTTP {response.status_code}).")

        if response.status_code >= 400:
            raise RailRadarError(
                f"RailRadar returned HTTP {response.status_code}: "
                f"{response.text[:500]}"
            )

        payload = response.json()
        if not payload.get("success", True):
            raise RailRadarError(
                payload.get("message", "RailRadar request failed.")
            )
        return payload.get("data", payload)

    # ------------------------------------------------------------------ #
    # Public API methods                                                   #
    # ------------------------------------------------------------------ #

    async def get_live_train(
        self,
        train_number: str,
        authoritative: bool = False,
        geometry: bool = False,
    ) -> Dict[str, Any]:
        """
        Fetch live status for *train_number*.

        Results are cached for ``poll_interval`` seconds.  On failure the
        last known-good snapshot is returned with ``stale=True``.
        """
        train_number = str(train_number)
        now = time.time()
        cached = self._cache.get(train_number)

        # Return cache hit unless caller demands authoritative data
        if cached and not authoritative:
            age = now - cached["timestamp"]
            if age < self.poll_interval:
                return cached["data"]

        # If rate-limit cooldown is active, return stale cached snapshot immediately
        if self._rate_limited_until and now < self._rate_limited_until:
            stale = self._last_known_good.get(train_number)
            if stale:
                return {**stale, "stale": True}
            raise RailRadarError("RailRadar rate-limited; backoff active.")

        try:
            data = await self._get(
                f"/v1/trains/{train_number}/live",
                params={
                    "authoritative": str(authoritative).lower(),
                    "geometry": str(geometry).lower(),
                    "format": "geojson",
                    "includeCoordinates": "true",
                },
            )
            normalized = self._normalize_train(data)
            self._cache[train_number] = {"timestamp": now, "data": normalized}
            self._last_known_good[train_number] = normalized
            return normalized
        except RailRadarError as exc:
            logger.warning(
                "RailRadar live fetch failed for %s: %s", train_number, exc
            )
            stale = self._last_known_good.get(train_number)
            if stale:
                return {**stale, "stale": True}
            raise

    async def get_route(self, train_number: str) -> Dict[str, Any]:
        """
        Fetch route geometry for *train_number*.

        Cached indefinitely for the session (route geometry never changes
        during a run, and re-fetching it wastes quota).
        """
        train_number = str(train_number)
        if train_number in self._route_cache:
            return self._route_cache[train_number]["data"]

        data = await self._get(
            f"/v1/trains/{train_number}/route",
            params={"format": "geojson", "stops": "true"},
        )
        self._route_cache[train_number] = {"timestamp": time.time(), "data": data}
        return data

    async def get_station_board(
        self, station_code: str, hours: int = 4
    ) -> Dict[str, Any]:
        """Fetch the live arrivals/departures board for a station."""
        return await self._get(
            f"/v1/stations/{station_code}/live",
            params={"hours": str(hours), "includeIntermediate": "true"},
        )

    # ------------------------------------------------------------------ #
    # Normalisation — maps RailRadar fields → project snake_case schema   #
    # ------------------------------------------------------------------ #

    def _normalize_train(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Map a raw RailRadar live-train payload to the project's schema.

        Field naming matches the existing Train model and sensor_stream.py
        conventions (snake_case).  ``source`` is always ``"live"`` here so
        downstream code can unambiguously distinguish live from simulated data.
        """
        current = data.get("currentLocation") or {}
        previous = data.get("previousHalt") or {}
        next_halt = data.get("nextHalt") or {}
        train_meta = data.get("train") or {}

        # Coordinates — RailRadar uses lat/lng inside currentLocation
        latitude = current.get("lat") or data.get("lat")
        longitude = current.get("lng") or data.get("lng")

        return {
            # Identity
            "id": str(data.get("trainNumber", "")),
            "train_number": str(data.get("trainNumber", "")),
            "train_name": (
                data.get("trainName")
                or train_meta.get("name")
                or str(data.get("trainNumber", ""))
            ),
            "train_type": train_meta.get("type") or data.get("trainType"),

            # Position (matches Train.latitude / Train.longitude)
            "latitude": latitude,
            "longitude": longitude,

            # Motion (current_speed matches Train.current_speed)
            "current_speed": current.get("speedKmh") or current.get("speed"),
            "bearing": current.get("bearingDegrees") or current.get("bearing"),

            # Schedule (delay_minutes matches Train.delay_minutes)
            "delay_minutes": data.get("delayMinutes", 0),
            "status": data.get("status") or "running",
            "is_live": data.get("isLive", True),

            # Station chain
            "current_station": {
                "code": current.get("stationCode"),
                "sequence": current.get("sequence"),
            },
            "previous_station": {
                "code": previous.get("stationCode"),
                "name": previous.get("stationName"),
                "sequence": previous.get("sequence"),
            },
            "next_station": {
                "code": next_halt.get("stationCode"),
                "name": next_halt.get("stationName"),
                "sequence": next_halt.get("sequence"),
            },

            # Route / geometry
            "route": data.get("route", []),
            "exceptions": data.get("exceptions", []),

            # Meta
            "last_updated": data.get("lastUpdatedAt"),
            "provider": "railradar",

            # !! Source flag — mandatory and unambiguous !!
            "source": "live",
            "stale": False,
        }

    # ------------------------------------------------------------------ #
    # Cache accessors (synchronous — safe to call from non-async code)    #
    # ------------------------------------------------------------------ #

    def get_cached_trains(self) -> List[Dict[str, Any]]:
        """Return all currently cached live-train dicts."""
        return [item["data"] for item in self._cache.values()]

    def get_cached_train(self, train_number: str) -> Optional[Dict[str, Any]]:
        """Return the cached dict for a specific train, or None."""
        item = self._cache.get(str(train_number))
        return item["data"] if item else None

    def get_cached_route(self, train_number: str) -> Optional[Dict[str, Any]]:
        """Return the cached route geometry for a train, or None."""
        item = self._route_cache.get(str(train_number))
        return item["data"] if item else None
