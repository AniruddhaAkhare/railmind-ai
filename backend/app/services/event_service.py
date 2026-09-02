"""Event Service — business logic for creating, updating, and processing railway events."""
import logging
import threading
from app.config.database import db
from app.models import Event, Agent, AgentMessage, EventRelationship
from datetime import datetime
from agent_event_emitter import AgentEventEmitter
from event_streamer import broadcast_graph_event

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Live-context enrichment helpers
# ---------------------------------------------------------------------------

def _get_station_coords(event: Event):
    """Return (latitude, longitude) for an event from station or metadata, or (None, None)."""
    meta = event.event_metadata or {}
    if meta.get('event_lat') is not None and meta.get('event_lon') is not None:
        try:
            return float(meta['event_lat']), float(meta['event_lon'])
        except (ValueError, TypeError):
            pass
    if event.station_id:
        try:
            from app.models import Station
            station = Station.query.get(event.station_id)
            if station:
                return station.latitude, station.longitude
        except Exception:
            pass
    return None, None


def enrich_event_with_live_context(event: Event) -> None:
    """
    Additively attach live-train spatial context to *event*.

    Modifies only ``event.event_metadata`` (an existing JSON column).
    Never renames or removes any existing field.  Safe to call even when
    the live rail layer is unavailable — it simply adds nothing.
    """
    try:
        from app.services.live_rail_manager import live_rail_manager
        from app.utils.spatial import find_nearby_trains, nearest_station
        import os

        affect_radius_km = float(os.getenv("LIVE_TRAIN_AFFECT_RADIUS_KM", "25"))

        # --- Resolve event coordinates from metadata or station ---
        event_lat, event_lon = _get_station_coords(event)
        if event_lat is None or event_lon is None:
            return   # can't do spatial work without a location

        # --- Gather all available trains (live + simulated positions) ---
        live_trains = live_rail_manager.get_live_trains()

        # Also include simulated train positions from the sensors cache
        try:
            from app.api.routes.sensors import _train_positions
            for pos in _train_positions.values():
                sim_train = {
                    "train_number": pos.get("train_no"),
                    "train_name": pos.get("train_name"),
                    "latitude": pos.get("lat"),
                    "longitude": pos.get("lng"),
                    "current_speed": pos.get("speed_kmh"),
                    "delay_minutes": pos.get("delay_min", 0),
                    "source": "simulation",
                    "stale": False,
                }
                live_trains.append(sim_train)
        except Exception:
            pass

        affected = find_nearby_trains(
            event_lat, event_lon, live_trains, radius_km=affect_radius_km
        )

        # --- Find nearest station ---
        try:
            from app.models import Station
            all_stations = [
                {"id": s.id, "name": s.name, "code": s.code,
                 "latitude": s.latitude, "longitude": s.longitude}
                for s in Station.query.all()
            ]
            nearest = nearest_station(event_lat, event_lon, all_stations)
        except Exception:
            nearest = None

        # --- Merge into event_metadata (additive only) ---
        metadata = dict(event.event_metadata or {})
        metadata["affected_trains"] = affected
        metadata["nearest_station"] = nearest
        metadata["event_radius_km"] = affect_radius_km
        metadata["live_context_at"] = datetime.utcnow().isoformat()
        metadata["event_lat"] = event_lat
        metadata["event_lon"] = event_lon

        event.event_metadata = metadata
        db.session.commit()

        if affected:
            logger.info(
                "Event %d enriched: %d nearby trains within %.0f km",
                event.id,
                len(affected),
                affect_radius_km,
            )
    except Exception as exc:
        logger.warning("Event enrichment failed (non-fatal): %s", exc)
        try:
            db.session.rollback()
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Agent pipeline definition — ordered chain of agent types per event severity
# ---------------------------------------------------------------------------
AGENT_PIPELINE = [
    'observation',
    'understanding',
    'risk',
    'impact',
    'decision',
    'coordination',
]

DOMAIN_AGENTS_BY_EVENT = {
    'fire':                  ['safety', 'emergency'],
    'flood':                 ['safety', 'emergency'],
    'emergency_incident':    ['safety', 'emergency'],
    'track_defect':          ['maintenance', 'safety'],
    'signal_failure':        ['maintenance', 'operations'],
    'ohe_failure':           ['maintenance', 'operations'],
    'bridge_risk':           ['maintenance', 'safety'],
    'congestion':            ['passenger', 'operations'],
    'platform_overcrowding': ['passenger', 'operations'],
    'train_delay':           ['operations', 'passenger'],
    'trespassing':           ['safety', 'emergency'],
    'level_crossing_violation': ['safety', 'operations'],
    'maintenance_alert':     ['maintenance'],
}

AGENT_CLASS_MAP = {}  # populated lazily


def _get_agent_classes():
    """Lazy-import all agent classes to avoid circular imports."""
    global AGENT_CLASS_MAP
    if AGENT_CLASS_MAP:
        return AGENT_CLASS_MAP

    from app.agents.core.observation_agent import ObservationAgent
    from app.agents.core.understanding_agent import UnderstandingAgent
    from app.agents.core.risk_agent import RiskAgent
    from app.agents.core.impact_agent import ImpactAgent
    from app.agents.core.decision_agent import DecisionAgent
    from app.agents.core.coordination_agent import CoordinationAgent
    from app.agents.core.communication_agent import CommunicationAgent
    from app.agents.core.knowledge_agent import KnowledgeAgent
    from app.agents.core.prediction_agent import PredictionAgent
    from app.agents.core.simulation_agent import SimulationAgent
    from app.agents.domain.safety_agent import SafetyAgent
    from app.agents.domain.maintenance_agent import MaintenanceAgent
    from app.agents.domain.emergency_agent import EmergencyAgent
    from app.agents.domain.operations_agent import OperationsAgent
    from app.agents.domain.passenger_agent import PassengerAgent

    AGENT_CLASS_MAP = {
        'observation':   ObservationAgent,
        'understanding': UnderstandingAgent,
        'risk':          RiskAgent,
        'impact':        ImpactAgent,
        'decision':      DecisionAgent,
        'coordination':  CoordinationAgent,
        'communication': CommunicationAgent,
        'knowledge':     KnowledgeAgent,
        'prediction':    PredictionAgent,
        'simulation':    SimulationAgent,
        'safety':        SafetyAgent,
        'maintenance':   MaintenanceAgent,
        'emergency':     EmergencyAgent,
        'operations':    OperationsAgent,
        'passenger':     PassengerAgent,
    }
    return AGENT_CLASS_MAP


def _run_agent_pipeline(app, event_id: int):
    """Run the full agent pipeline for an event. Runs in a background thread."""
    with app.app_context():
        try:
            event = Event.query.get(event_id)
            if not event:
                logger.error(f"Event {event_id} not found for agent pipeline.")
                return

            agent_classes = _get_agent_classes()
            domain_types = DOMAIN_AGENTS_BY_EVENT.get(event.event_type, ['safety'])
            
            # Skip domain agents for low severity
            if event.severity in ('medium', 'low') and event.severity != 'critical':
                domain_types = domain_types[:1]

            from app.agents.orchestrator import run_orchestrator
            run_orchestrator(app, event_id, agent_classes, domain_types)

        except Exception as e:
            print(f">>> Agent pipeline failed for event {event_id}: {e}", flush=True)
            logger.error(f"Agent pipeline failed for event {event_id}: {e}")


class EventService:
    """Service for event operations."""

    @staticmethod
    def create_event(event_data: dict) -> Event:
        """Create a new event, persist it, and enrich it with live-rail context."""
        station_id = event_data.get('station_id')
        resolved_station_id = None
        if station_id is not None:
            if isinstance(station_id, int):
                resolved_station_id = station_id
            else:
                try:
                    resolved_station_id = int(station_id)
                except (ValueError, TypeError):
                    from app.models import Station
                    st = Station.query.filter(
                        (Station.code == str(station_id)) | (Station.name == str(station_id))
                    ).first()
                    if st:
                        resolved_station_id = st.id

        event_type = str(event_data.get('event_type', 'track_defect')).lower().strip()
        severity = str(event_data.get('severity', 'medium')).lower().strip()

        priority = 5
        if event_data.get('priority') is not None:
            try:
                priority = int(event_data['priority'])
            except (ValueError, TypeError):
                priority = 5

        affected_passengers = 0
        if event_data.get('affected_passengers') is not None:
            try:
                affected_passengers = int(event_data['affected_passengers'])
            except (ValueError, TypeError):
                affected_passengers = 0

        estimated_delay_minutes = 0
        if event_data.get('estimated_delay_minutes') is not None:
            try:
                estimated_delay_minutes = int(event_data['estimated_delay_minutes'])
            except (ValueError, TypeError):
                estimated_delay_minutes = 0

        track_id = None
        if event_data.get('track_id') is not None:
            try:
                track_id = int(event_data['track_id'])
            except (ValueError, TypeError):
                track_id = None

        train_id = None
        if event_data.get('train_id') is not None:
            try:
                train_id = int(event_data['train_id'])
            except (ValueError, TypeError):
                train_id = None

        metadata = dict(event_data.get('event_metadata') or {})
        if 'latitude' in event_data and 'longitude' in event_data:
            try:
                metadata['event_lat'] = float(event_data['latitude'])
                metadata['event_lon'] = float(event_data['longitude'])
            except (ValueError, TypeError):
                pass

        event = Event(
            event_type=event_type,
            severity=severity,
            priority=priority,
            description=event_data.get('description'),
            station_id=resolved_station_id,
            track_id=track_id,
            train_id=train_id,
            affected_passengers=affected_passengers,
            estimated_delay_minutes=estimated_delay_minutes,
            event_metadata=metadata,
        )
        db.session.add(event)
        db.session.commit()

        # Additively attach live-train spatial context — never mutates existing fields
        try:
            enrich_event_with_live_context(event)
        except Exception as exc:
            logger.warning("Live context enrichment error: %s", exc)

        return event

    @staticmethod
    def get_event(event_id: int) -> Event:
        """Get event by ID."""
        return Event.query.get(event_id)

    @staticmethod
    def update_event(event_id: int, event_data: dict) -> Event:
        """Update an existing event."""
        event = Event.query.get(event_id)
        if not event:
            return None

        allowed_fields = {
            'event_type', 'severity', 'priority', 'status',
            'description', 'affected_passengers',
            'estimated_delay_minutes', 'event_metadata', 'resolved_at',
        }
        for key, value in event_data.items():
            if key in allowed_fields:
                setattr(event, key, value)

        event.updated_at = datetime.utcnow()
        db.session.commit()
        return event

    @staticmethod
    def resolve_event(event_id: int) -> Event:
        """Mark an event as resolved."""
        event = Event.query.get(event_id)
        if not event:
            return None
        event.status = 'resolved'
        event.resolved_at = datetime.utcnow()
        db.session.commit()
        return event

    @staticmethod
    def get_events_by_status(status: str, page: int = 1, per_page: int = 50):
        """Get events by status with pagination."""
        return Event.query.filter_by(status=status).paginate(
            page=page, per_page=per_page, error_out=False
        )

    @staticmethod
    def get_events_by_severity(severity: str, page: int = 1, per_page: int = 50):
        """Get events by severity with pagination."""
        return Event.query.filter_by(severity=severity).paginate(
            page=page, per_page=per_page, error_out=False
        )

    @staticmethod
    def get_stats() -> dict:
        """Return a summary of event counts by severity and status."""
        total = Event.query.count()
        critical = Event.query.filter_by(severity='critical').count()
        high = Event.query.filter_by(severity='high').count()
        open_events = Event.query.filter_by(status='open').count()
        in_progress = Event.query.filter_by(status='in_progress').count()
        resolved = Event.query.filter_by(status='resolved').count()
        return {
            'total': total,
            'critical': critical,
            'high': high,
            'open': open_events,
            'in_progress': in_progress,
            'resolved': resolved,
        }

    @staticmethod
    def trigger_agents(event: Event, app=None) -> None:
        """Trigger the full agent pipeline in a background thread."""
        if app is None:
            try:
                from flask import current_app
                app = current_app._get_current_object()
            except RuntimeError:
                logger.warning("No Flask app context; agents not triggered")
                return

        # Broadcast new event to frontend via Socket.IO
        try:
            from app.core.app import socketio
            socketio.emit('event_created', event.to_dict(), namespace='/events')
            
            # If critical or emergency, broadcast emergency_trigger to graph
            if event.severity == 'critical' or 'emergency' in event.event_type:
                evt = AgentEventEmitter.format_event(
                    event_type="emergency_trigger",
                    from_agent="System",
                    to_agent="All Agents",
                    message={
                        "summary": f"Emergency Triggered: {event.event_type}",
                        "recommendations": [f"Respond to {event.id}"]
                    },
                    state_snapshot=event.to_dict()
                )
                broadcast_graph_event(evt)
        except Exception as e:
            logger.warning(f"Socket.IO broadcast failed: {e}")

        # Run agent pipeline in background thread
        thread = threading.Thread(
            target=_run_agent_pipeline,
            args=(app, event.id),
            daemon=True,
            name=f"agent-pipeline-event-{event.id}",
        )
        thread.start()
        logger.info(f"Agent pipeline started for event {event.id} ({event.event_type})")
