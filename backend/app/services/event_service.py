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
        """Create a new event and persist it."""
        event = Event(
            event_type=event_data.get('event_type'),
            severity=event_data.get('severity', 'medium'),
            priority=event_data.get('priority', 5),
            description=event_data.get('description'),
            station_id=event_data.get('station_id'),
            track_id=event_data.get('track_id'),
            train_id=event_data.get('train_id'),
            affected_passengers=event_data.get('affected_passengers', 0),
            estimated_delay_minutes=event_data.get('estimated_delay_minutes', 0),
            event_metadata=event_data.get('event_metadata', {}),
        )
        db.session.add(event)
        db.session.commit()
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
