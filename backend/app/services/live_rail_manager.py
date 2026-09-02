"""
live_rail_manager.py — Singleton polling manager for live railway data.

Responsibilities
----------------
1. Owns a LiveRailAdapter instance and runs an asyncio polling loop in a
   dedicated background daemon thread.
2. Maintains a curated set of trains to poll (quota-safe: 15 trains with a
   configurable interval, defaulting to 5 minutes).
3. Falls back transparently to simulation-only mode when the API key is
   absent or the API is unreachable.
4. Pushes live train updates to the frontend via Socket.IO /pulse namespace
   after every successful poll cycle.
5. Exposes get_live_trains() for synchronous callers (event_service, agents).

Quota note
----------
With RAILRADAR_POLL_INTERVAL_SECONDS=300 (5 min) and 15 trains:
  15 trains × 12 polls/hr × 24 hr × 30 days = 129,600 requests/month.
That still exceeds the 1,000-request sandbox tier.
For the sandbox, set RAILRADAR_POLL_INTERVAL_SECONDS=14400 (4-hour interval):
  15 × 6 × 30 = 2,700 — still over. The safest sandbox setting is to poll
  only on-demand (event-triggered) rather than on a schedule. The manager
  therefore exposes poll_train_now() for event-triggered fetches, and the
  background loop is OFF by default when the api key is absent.
"""

import asyncio
import logging
import os
import threading
import time
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ── Curated poll list — these 15 trains are always tracked when live data is on.
# They match the TRAIN_NUMBERS list in sensor_stream.py for consistency.
CURATED_TRAIN_NUMBERS = [
    "12301",  # Howrah Rajdhani
    "12951",  # Mumbai Rajdhani
    "22691",  # Rajdhani Express
    "12259",  # Sealdah Duronto
    "12622",  # Tamil Nadu Express
    "12001",  # Bhopal Shatabdi
    "12050",  # Gatimaan Express
    "19031",  # Mumbai Haridwar Express
    "11057",  # Amritsar Express
    "12841",  # Coromandel Express
    "12002",  # New Delhi Shatabdi
    "12027",  # Chennai Shatabdi
    "12626",  # Kerala Express
    "12309",  # Rajendra Nagar Patna Express
    "12724",  # Telangana Express
]


class LiveRailManager:
    """
    Singleton that owns the RailRadar adapter and background polling loop.
    """

    def __init__(self) -> None:
        self._adapter = None          # initialised lazily in start()
        self._app = None              # Flask app reference for socketio context
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._loop: Optional[asyncio.AbstractEventLoop] = None

        self.poll_interval = int(
            os.getenv("RAILRADAR_POLL_INTERVAL_SECONDS", "300")
        )
        self.affect_radius_km = float(
            os.getenv("LIVE_TRAIN_AFFECT_RADIUS_KM", "25")
        )
        self.rail_data_mode = os.getenv("RAIL_DATA_MODE", "hybrid").lower()

        # In-memory store of the last successful poll result
        self._live_trains: List[Dict[str, Any]] = []
        self._mode: str = "simulation_only"   # updated after first poll

    # ------------------------------------------------------------------ #
    # Lifecycle                                                            #
    # ------------------------------------------------------------------ #

    def start(self, app) -> None:
        """Start the background polling thread (called once from create_app)."""
        from app.services.railradar_adapter import LiveRailAdapter

        self._app = app
        self._adapter = LiveRailAdapter()

        api_key = os.getenv("RAILRADAR_API_KEY")
        if not api_key or self.rail_data_mode == "simulation":
            logger.info(
                "LiveRailManager: no RAILRADAR_API_KEY or RAIL_DATA_MODE=simulation "
                "— running in simulation-only mode."
            )
            self._mode = "simulation_only"
            return

        self._running = True
        self._thread = threading.Thread(
            target=self._poll_loop,
            daemon=True,
            name="live-rail-manager",
        )
        self._thread.start()
        logger.info(
            "✅ LiveRailManager started — polling %d trains every %ds",
            len(CURATED_TRAIN_NUMBERS),
            self.poll_interval,
        )

    def stop(self) -> None:
        self._running = False
        if self._thread:
            self._thread.join(timeout=5)

    # ------------------------------------------------------------------ #
    # Background polling loop                                             #
    # ------------------------------------------------------------------ #

    def _poll_loop(self) -> None:
        """Run an asyncio event loop inside a daemon thread."""
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        try:
            self._loop.run_until_complete(self._async_poll_loop())
        except Exception as exc:
            logger.error("LiveRailManager poll loop crashed: %s", exc)
        finally:
            self._loop.close()

    async def _async_poll_loop(self) -> None:
        """Async polling coroutine — polls all curated trains once per interval."""
        while self._running:
            start = time.monotonic()
            try:
                await self._fetch_all_curated()
                self._push_to_websocket()
            except Exception as exc:
                logger.warning("LiveRailManager poll cycle error: %s", exc)
            elapsed = time.monotonic() - start
            sleep_for = max(0, self.poll_interval - elapsed)
            await asyncio.sleep(sleep_for)

    async def _fetch_all_curated(self) -> None:
        """Fetch live data for all curated trains, respecting concurrency cap."""
        from app.services.railradar_adapter import RailRadarError

        tasks = [
            self._fetch_one(train_no) for train_no in CURATED_TRAIN_NUMBERS
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        live: List[Dict[str, Any]] = []
        errors = 0
        for result in results:
            if isinstance(result, Exception):
                errors += 1
            elif result is not None:
                live.append(result)

        if live:
            self._live_trains = live
            self._mode = "hybrid"
            logger.info(
                "LiveRailManager: fetched %d live trains (%d errors)",
                len(live),
                errors,
            )
        else:
            logger.warning(
                "LiveRailManager: all %d train fetches failed — staying in "
                "last-known state",
                errors,
            )

    async def _fetch_one(
        self, train_number: str
    ) -> Optional[Dict[str, Any]]:
        """Fetch a single train, returning None on error."""
        from app.services.railradar_adapter import RailRadarError

        try:
            return await self._adapter.get_live_train(train_number)
        except RailRadarError as exc:
            logger.debug("Skipping %s: %s", train_number, exc)
            return None
        except Exception as exc:
            logger.warning("Unexpected error fetching %s: %s", train_number, exc)
            return None

    # ------------------------------------------------------------------ #
    # Event-triggered on-demand fetch (quota-conscious)                  #
    # ------------------------------------------------------------------ #

    def poll_train_now(self, train_number: str) -> Optional[Dict[str, Any]]:
        """
        Synchronously fetch a single train immediately (e.g. because an event
        fired near it).  Uses the existing adapter cache when fresh.
        """
        if not self._adapter:
            return None
        if not os.getenv("RAILRADAR_API_KEY"):
            return None
        if self._loop and self._loop.is_running():
            # Schedule in the background loop — can't block
            future = asyncio.run_coroutine_threadsafe(
                self._fetch_one(train_number), self._loop
            )
            try:
                result = future.result(timeout=16)
            except Exception:
                result = None
            if result:
                # Merge into live_trains list
                existing_ids = {t["train_number"] for t in self._live_trains}
                if result["train_number"] not in existing_ids:
                    self._live_trains.append(result)
                else:
                    self._live_trains = [
                        result if t["train_number"] == result["train_number"] else t
                        for t in self._live_trains
                    ]
            return result
        # Fallback: run a fresh loop (adapter has its own semaphore)
        try:
            return asyncio.run(self._fetch_one(train_number))
        except Exception:
            return None

    def fetch_route(self, train_number: str) -> Optional[Dict[str, Any]]:
        """
        Return cached route geometry or fetch it from RailRadar.
        Route geometry is cached for the session.
        """
        if not self._adapter:
            return None
        cached = self._adapter.get_cached_route(train_number)
        if cached:
            return cached
        if not os.getenv("RAILRADAR_API_KEY"):
            return None
        try:
            if self._loop and self._loop.is_running():
                future = asyncio.run_coroutine_threadsafe(
                    self._adapter.get_route(train_number), self._loop
                )
                return future.result(timeout=16)
            return asyncio.run(self._adapter.get_route(train_number))
        except Exception as exc:
            logger.warning("Route fetch failed for %s: %s", train_number, exc)
            return None

    # ------------------------------------------------------------------ #
    # Public synchronous accessors                                        #
    # ------------------------------------------------------------------ #

    def get_live_trains(self) -> List[Dict[str, Any]]:
        """
        Return the current list of live train dicts (may be empty in
        simulation-only mode).  Guaranteed to never raise.
        """
        return list(self._live_trains)

    def get_mode(self) -> str:
        """Return 'hybrid' or 'simulation_only'."""
        return self._mode

    # ------------------------------------------------------------------ #
    # WebSocket push                                                       #
    # ------------------------------------------------------------------ #

    def _push_to_websocket(self) -> None:
        """Emit live_train_update to /pulse namespace after each poll."""
        if not self._app:
            return
        try:
            from app.core.app import socketio
            socketio.emit(
                "live_train_update",
                {
                    "trains": self._live_trains,
                    "mode": self._mode,
                    "count": len(self._live_trains),
                },
                namespace="/pulse",
            )
        except Exception as exc:
            logger.debug("live_train_update emit failed: %s", exc)


# ── Module-level singleton ───────────────────────────────────────────────────
live_rail_manager = LiveRailManager()
