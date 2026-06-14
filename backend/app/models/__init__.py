from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, Boolean,
    ForeignKey, Text, JSON, Index, Numeric
)
from sqlalchemy.orm import relationship
from app.config.database import db


class Station(db.Model):
    """Railway Station Model"""
    __tablename__ = 'stations'

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False, unique=True, index=True)
    code = Column(String(10), nullable=False, unique=True, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    state = Column(String(100))
    region = Column(String(100))
    zone = Column(String(100))
    platform_count = Column(Integer, default=1)
    max_capacity = Column(Integer)
    current_crowd = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    platforms = relationship('Platform', back_populates='station', cascade='all, delete-orphan')
    tracks = relationship('Track', back_populates='station')
    events = relationship('Event', back_populates='station')

    __table_args__ = (
        Index('idx_station_location', 'latitude', 'longitude'),
        Index('idx_station_zone', 'zone'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'code': self.code,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'state': self.state,
            'region': self.region,
            'zone': self.zone,
            'platform_count': self.platform_count,
            'max_capacity': self.max_capacity,
            'current_crowd': self.current_crowd,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Platform(db.Model):
    """Railway Platform Model"""
    __tablename__ = 'platforms'

    id = Column(Integer, primary_key=True)
    station_id = Column(Integer, ForeignKey('stations.id'), nullable=False)
    platform_number = Column(String(10), nullable=False)
    length = Column(Float)
    max_capacity = Column(Integer)
    current_passengers = Column(Integer, default=0)
    status = Column(String(50), default='operational')
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    station = relationship('Station', back_populates='platforms')

    __table_args__ = (
        Index('idx_platform_station', 'station_id'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'station_id': self.station_id,
            'platform_number': self.platform_number,
            'length': self.length,
            'max_capacity': self.max_capacity,
            'current_passengers': self.current_passengers,
            'status': self.status,
        }


class Track(db.Model):
    """Railway Track Model"""
    __tablename__ = 'tracks'

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False, unique=True)
    station_id = Column(Integer, ForeignKey('stations.id'))
    start_station_id = Column(Integer)
    end_station_id = Column(Integer)
    length_km = Column(Float)
    gauge = Column(String(20), default='1676mm')
    electrified = Column(Boolean, default=False)
    max_speed = Column(Float)
    health_score = Column(Float, default=1.0)
    status = Column(String(50), default='operational')
    defect_count = Column(Integer, default=0)
    last_maintenance = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    station = relationship('Station', back_populates='tracks', foreign_keys=[station_id])
    events = relationship('Event', back_populates='track')

    __table_args__ = (
        Index('idx_track_status', 'status'),
        Index('idx_track_health', 'health_score'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'length_km': self.length_km,
            'gauge': self.gauge,
            'electrified': self.electrified,
            'health_score': self.health_score,
            'status': self.status,
            'defect_count': self.defect_count,
        }


class Train(db.Model):
    """Train Model"""
    __tablename__ = 'trains'

    id = Column(Integer, primary_key=True)
    train_number = Column(String(20), nullable=False, unique=True, index=True)
    train_name = Column(String(100))
    train_type = Column(String(50))
    route_id = Column(Integer, ForeignKey('routes.id'))
    current_station_id = Column(Integer, ForeignKey('stations.id'))
    current_platform_id = Column(Integer, ForeignKey('platforms.id'))
    latitude = Column(Float)
    longitude = Column(Float)
    current_speed = Column(Float, default=0)
    max_capacity = Column(Integer)
    current_passengers = Column(Integer, default=0)
    health_score = Column(Float, default=1.0)
    status = Column(String(50), default='running')
    delay_minutes = Column(Integer, default=0)
    last_location_update = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    route = relationship('Route', back_populates='trains')
    events = relationship('Event', back_populates='train')

    __table_args__ = (
        Index('idx_train_status', 'status'),
        Index('idx_train_location', 'latitude', 'longitude'),
        Index('idx_train_delay', 'delay_minutes'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'train_number': self.train_number,
            'train_name': self.train_name,
            'train_type': self.train_type,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'current_speed': self.current_speed,
            'current_passengers': self.current_passengers,
            'health_score': self.health_score,
            'status': self.status,
            'delay_minutes': self.delay_minutes,
        }


class Route(db.Model):
    """Railway Route Model"""
    __tablename__ = 'routes'

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False, unique=True)
    source_station_id = Column(Integer, ForeignKey('stations.id'), nullable=False)
    destination_station_id = Column(Integer, ForeignKey('stations.id'), nullable=False)
    distance_km = Column(Float)
    estimated_time_hours = Column(Float)
    status = Column(String(50), default='operational')
    congestion_level = Column(String(20), default='low')
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    trains = relationship('Train', back_populates='route')

    __table_args__ = (
        Index('idx_route_status', 'status'),
        Index('idx_route_congestion', 'congestion_level'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'distance_km': self.distance_km,
            'estimated_time_hours': self.estimated_time_hours,
            'status': self.status,
            'congestion_level': self.congestion_level,
        }


class Asset(db.Model):
    """Railway Asset Model (Signals, Bridges, OHE, etc)"""
    __tablename__ = 'assets'

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    asset_type = Column(String(50), nullable=False)
    location_latitude = Column(Float)
    location_longitude = Column(Float)
    health_score = Column(Float, default=1.0)
    status = Column(String(50), default='operational')
    last_inspection = Column(DateTime)
    next_maintenance = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index('idx_asset_type', 'asset_type'),
        Index('idx_asset_status', 'status'),
        Index('idx_asset_health', 'health_score'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'asset_type': self.asset_type,
            'health_score': self.health_score,
            'status': self.status,
        }


class Event(db.Model):
    """Railway Event Model"""
    __tablename__ = 'events'

    id = Column(Integer, primary_key=True)
    event_type = Column(String(50), nullable=False, index=True)
    severity = Column(String(20), default='medium')
    priority = Column(Integer, default=5)
    status = Column(String(50), default='open')
    description = Column(Text)
    station_id = Column(Integer, ForeignKey('stations.id'))
    track_id = Column(Integer, ForeignKey('tracks.id'))
    train_id = Column(Integer, ForeignKey('trains.id'))
    affected_passengers = Column(Integer, default=0)
    estimated_delay_minutes = Column(Integer, default=0)
    event_metadata = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    resolved_at = Column(DateTime)

    station = relationship('Station', back_populates='events')
    track = relationship('Track', back_populates='events')
    train = relationship('Train', back_populates='events')
    related_events = relationship(
        'EventRelationship',
        back_populates='source_event',
        foreign_keys='EventRelationship.source_event_id'
    )

    __table_args__ = (
        Index('idx_event_type', 'event_type'),
        Index('idx_event_severity', 'severity'),
        Index('idx_event_status', 'status'),
        Index('idx_event_created', 'created_at'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'event_type': self.event_type,
            'severity': self.severity,
            'priority': self.priority,
            'status': self.status,
            'description': self.description,
            'station_id': self.station_id,
            'track_id': self.track_id,
            'train_id': self.train_id,
            'affected_passengers': self.affected_passengers,
            'estimated_delay_minutes': self.estimated_delay_minutes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'resolved_at': self.resolved_at.isoformat() if self.resolved_at else None,
        }


class EventRelationship(db.Model):
    """Relationships between events"""
    __tablename__ = 'event_relationships'

    id = Column(Integer, primary_key=True)
    source_event_id = Column(Integer, ForeignKey('events.id'), nullable=False)
    related_event_id = Column(Integer, ForeignKey('events.id'), nullable=False)
    relationship_type = Column(String(50), default='causes')
    confidence = Column(Float, default=0.5)
    created_at = Column(DateTime, default=datetime.utcnow)

    source_event = relationship(
        'Event',
        back_populates='related_events',
        foreign_keys=[source_event_id]
    )
    related_event = relationship(
        'Event',
        foreign_keys=[related_event_id]
    )

    __table_args__ = (
        Index('idx_event_rel_source', 'source_event_id'),
    )


class Agent(db.Model):
    """AI Agent Model"""
    __tablename__ = 'agents'

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False, unique=True, index=True)
    agent_type = Column(String(50), nullable=False)
    status = Column(String(50), default='idle')
    total_decisions = Column(Integer, default=0)
    success_rate = Column(Float, default=0.0)
    avg_confidence = Column(Float, default=0.0)
    event_metadata = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    messages = relationship('AgentMessage', back_populates='agent', cascade='all, delete-orphan')
    decisions = relationship('AgentDecision', back_populates='agent', cascade='all, delete-orphan')

    __table_args__ = (
        Index('idx_agent_type', 'agent_type'),
        Index('idx_agent_status', 'status'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'agent_type': self.agent_type,
            'status': self.status,
            'total_decisions': self.total_decisions,
            'success_rate': self.success_rate,
            'avg_confidence': self.avg_confidence,
        }


class AgentMessage(db.Model):
    """Agent Communication Message"""
    __tablename__ = 'agent_messages'

    id = Column(Integer, primary_key=True)
    agent_id = Column(Integer, ForeignKey('agents.id'), nullable=False)
    event_id = Column(Integer, ForeignKey('events.id'))
    message_type = Column(String(50), default='observation')
    content = Column(Text, nullable=False)
    reasoning = Column(Text)
    confidence = Column(Float, default=0.0)
    event_metadata = Column(JSON)
    workflow_context = Column(JSON)
    reasoning_context = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    agent = relationship('Agent', back_populates='messages')

    __table_args__ = (
        Index('idx_agent_msg_agent', 'agent_id'),
        Index('idx_agent_msg_event', 'event_id'),
        Index('idx_agent_msg_created', 'created_at'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'agent_id': self.agent_id,
            'event_id': self.event_id,
            'message_type': self.message_type,
            'content': self.content,
            'reasoning': self.reasoning,
            'confidence': self.confidence,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class AgentDecision(db.Model):
    """Agent Decision Log"""
    __tablename__ = 'agent_decisions'

    id = Column(Integer, primary_key=True)
    agent_id = Column(Integer, ForeignKey('agents.id'), nullable=False)
    event_id = Column(Integer, ForeignKey('events.id'), nullable=False)
    decision = Column(Text, nullable=False)
    reasoning = Column(Text)
    confidence = Column(Float, default=0.0)
    recommendations = Column(JSON)
    action_plan = Column(JSON)
    outcome = Column(String(50), default='pending')
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    resolved_at = Column(DateTime)

    agent = relationship('Agent', back_populates='decisions')

    __table_args__ = (
        Index('idx_agent_dec_agent', 'agent_id'),
        Index('idx_agent_dec_event', 'event_id'),
        Index('idx_agent_dec_created', 'created_at'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'agent_id': self.agent_id,
            'event_id': self.event_id,
            'decision': self.decision,
            'confidence': self.confidence,
            'outcome': self.outcome,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Task(db.Model):
    """Operation Task"""
    __tablename__ = 'tasks'

    id = Column(Integer, primary_key=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    task_type = Column(String(50), nullable=False)
    status = Column(String(50), default='pending')
    priority = Column(Integer, default=5)
    assigned_to = Column(String(100))
    event_id = Column(Integer, ForeignKey('events.id'))
    event_metadata = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    due_date = Column(DateTime)
    completed_at = Column(DateTime)

    __table_args__ = (
        Index('idx_task_status', 'status'),
        Index('idx_task_type', 'task_type'),
        Index('idx_task_priority', 'priority'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'task_type': self.task_type,
            'status': self.status,
            'priority': self.priority,
            'assigned_to': self.assigned_to,
        }


class Workflow(db.Model):
    """Workflow for multi-step operations"""
    __tablename__ = 'workflows'

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    workflow_type = Column(String(50), nullable=False)
    status = Column(String(50), default='pending')
    steps = Column(JSON)
    current_step = Column(Integer, default=0)
    event_id = Column(Integer, ForeignKey('events.id'))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Simulation(db.Model):
    """Digital Twin Simulation"""
    __tablename__ = 'simulations'

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    simulation_type = Column(String(50), nullable=False)
    scenario = Column(String(100), nullable=False)
    status = Column(String(50), default='pending')
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    duration_seconds = Column(Integer)
    results = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    __table_args__ = (
        Index('idx_sim_type', 'simulation_type'),
        Index('idx_sim_scenario', 'scenario'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'simulation_type': self.simulation_type,
            'scenario': self.scenario,
            'status': self.status,
            'results': self.results,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class DigitalTwinState(db.Model):
    """Digital Twin State Snapshot"""
    __tablename__ = 'digital_twin_states'

    id = Column(Integer, primary_key=True)
    state_type = Column(String(50), nullable=False)
    state_mode = Column(String(50), default='current')
    timestamp = Column(DateTime, default=datetime.utcnow)
    state_data = Column(JSON, nullable=False)
    event_metadata = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    __table_args__ = (
        Index('idx_twin_state_type', 'state_type'),
        Index('idx_twin_state_mode', 'state_mode'),
    )


class RiskAssessment(db.Model):
    """Risk Assessment Report"""
    __tablename__ = 'risk_assessments'

    id = Column(Integer, primary_key=True)
    event_id = Column(Integer, ForeignKey('events.id'), nullable=False)
    risk_score = Column(Float, default=0.0)
    risk_level = Column(String(20), default='low')
    affected_systems = Column(JSON)
    mitigation_strategies = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class ImpactAssessment(db.Model):
    """Impact Assessment Report"""
    __tablename__ = 'impact_assessments'

    id = Column(Integer, primary_key=True)
    event_id = Column(Integer, ForeignKey('events.id'), nullable=False)
    impact_score = Column(Float, default=0.0)
    affected_trains = Column(JSON)
    affected_passengers = Column(Integer, default=0)
    estimated_delay = Column(Integer, default=0)
    cascading_effects = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class Incident(db.Model):
    """Incident Report"""
    __tablename__ = 'incidents'

    id = Column(Integer, primary_key=True)
    incident_number = Column(String(50), unique=True, nullable=False)
    incident_type = Column(String(100), nullable=False)
    severity = Column(String(20), default='medium')
    description = Column(Text)
    root_cause = Column(Text)
    resolution = Column(Text)
    events = Column(JSON)
    status = Column(String(50), default='open')
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    resolved_at = Column(DateTime)
    duration_minutes = Column(Integer)


class SOP(db.Model):
    """Standard Operating Procedure"""
    __tablename__ = 'sops'

    id = Column(Integer, primary_key=True)
    title = Column(String(255), nullable=False)
    procedure_type = Column(String(100), nullable=False)
    content = Column(Text, nullable=False)
    version = Column(String(20), default='1.0')
    applicable_scenarios = Column(JSON)
    last_updated = Column(DateTime, default=datetime.utcnow)


class Manual(db.Model):
    """Railway Manual/Documentation"""
    __tablename__ = 'manuals'

    id = Column(Integer, primary_key=True)
    title = Column(String(255), nullable=False)
    manual_type = Column(String(100), nullable=False)
    content = Column(Text, nullable=False)
    tags = Column(JSON)
    version = Column(String(20), default='1.0')
    created_at = Column(DateTime, default=datetime.utcnow)


class PulseEvent(db.Model):
    """Pulse Event Tracking"""
    __tablename__ = 'pulse_events'

    id = Column(Integer, primary_key=True)
    event_id = Column(Integer, ForeignKey('events.id'), nullable=False)
    intensity = Column(Float, default=1.0)
    radius_km = Column(Float, default=50)
    propagation_status = Column(String(50), default='active')
    affected_zones = Column(JSON)
    timestamp = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class NotificationLog(db.Model):
    """Notification Log"""
    __tablename__ = 'notification_logs'

    id = Column(Integer, primary_key=True)
    event_id = Column(Integer, ForeignKey('events.id'))
    recipient = Column(String(255))
    notification_type = Column(String(50))
    message = Column(Text)
    status = Column(String(50), default='pending')
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    sent_at = Column(DateTime)


class UserSession(db.Model):
    """User Session Tracking"""
    __tablename__ = 'user_sessions'

    id = Column(Integer, primary_key=True)
    user_id = Column(String(100))
    session_token = Column(String(255), unique=True)
    activity_log = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_activity = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime)


class AgentExecutionTrace(db.Model):
    """Execution Trace for LangGraph Agents"""
    __tablename__ = 'agent_execution_traces'

    id = Column(Integer, primary_key=True)
    execution_id = Column(String(100), unique=True, index=True)
    workflow_id = Column(String(100), index=True)
    event_id = Column(Integer, ForeignKey('events.id'))
    agent_name = Column(String(100), nullable=False)
    start_time = Column(DateTime, default=datetime.utcnow)
    end_time = Column(DateTime)
    duration_ms = Column(Integer)
    input_state = Column(JSON)
    output_state = Column(JSON)
    model_used = Column(String(100))
    token_usage = Column(Integer, default=0)
    confidence = Column(Float, default=0.0)
    recommendations = Column(JSON)
    action_plan = Column(JSON)
    future_predictions = Column(JSON)


class AgentMemory(db.Model):
    """Memory Engine for Agents"""
    __tablename__ = 'agent_memories'

    id = Column(Integer, primary_key=True)
    agent_id = Column(Integer, ForeignKey('agents.id'), nullable=False)
    short_term_memory = Column(JSON)
    working_memory = Column(JSON)
    historical_memory = Column(JSON)
    retrieved_knowledge = Column(JSON)
    decision_history = Column(JSON)
    confidence_history = Column(JSON)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    agent = relationship('Agent', foreign_keys=[agent_id])


class FutureScenario(db.Model):
    """Scenario Cloning Engine"""
    __tablename__ = 'future_scenarios'

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    parent_incident_id = Column(Integer, ForeignKey('incidents.id'))
    base_snapshot_id = Column(Integer, ForeignKey('digital_twin_states.id'))
    parameters = Column(JSON)
    projected_outcome = Column(JSON)
    status = Column(String(50), default='simulating')
    created_at = Column(DateTime, default=datetime.utcnow)
