from app.config.database import db
from app.models import Station, Train, Event, Agent


class BaseRepository:
    """Base repository for all models with standard CRUD operations."""
    model = None

    @classmethod
    def create(cls, **kwargs):
        """Create and persist a new instance."""
        obj = cls.model(**kwargs)
        db.session.add(obj)
        db.session.commit()
        return obj

    @classmethod
    def get_by_id(cls, obj_id):
        """Get a record by primary key."""
        return cls.model.query.get(obj_id)

    @classmethod
    def get_all(cls, page: int = 1, per_page: int = 50):
        """Return a paginated result set."""
        return cls.model.query.paginate(
            page=page, per_page=per_page, error_out=False
        )

    @classmethod
    def update(cls, obj_id, **kwargs):
        """Update fields on a record."""
        obj = cls.get_by_id(obj_id)
        if obj:
            for key, value in kwargs.items():
                if hasattr(obj, key):
                    setattr(obj, key, value)
            db.session.commit()
        return obj

    @classmethod
    def delete(cls, obj_id) -> bool:
        """Delete a record by primary key."""
        obj = cls.get_by_id(obj_id)
        if obj:
            db.session.delete(obj)
            db.session.commit()
            return True
        return False

    @classmethod
    def count(cls) -> int:
        """Return total count of records."""
        return cls.model.query.count()


class StationRepository(BaseRepository):
    """Station repository."""
    model = Station

    @classmethod
    def get_by_code(cls, code: str):
        """Get station by station code."""
        return Station.query.filter_by(code=code).first()

    @classmethod
    def get_by_zone(cls, zone: str, page: int = 1, per_page: int = 50):
        """Get stations filtered by zone."""
        return Station.query.filter_by(zone=zone).paginate(
            page=page, per_page=per_page, error_out=False
        )


class TrainRepository(BaseRepository):
    """Train repository."""
    model = Train

    @classmethod
    def get_by_number(cls, train_number: str):
        """Get train by train number."""
        return Train.query.filter_by(train_number=train_number).first()

    @classmethod
    def get_delayed_trains(cls, min_delay: int = 0):
        """Get trains with delay > min_delay minutes."""
        return Train.query.filter(Train.delay_minutes > min_delay).all()


class EventRepository(BaseRepository):
    """Event repository."""
    model = Event

    @classmethod
    def get_by_type(cls, event_type: str):
        """Get all events of a specific type."""
        return Event.query.filter_by(event_type=event_type).all()

    @classmethod
    def get_open_events(cls, page: int = 1, per_page: int = 50):
        """Get all open events."""
        return Event.query.filter_by(status='open').order_by(
            Event.created_at.desc()
        ).paginate(page=page, per_page=per_page, error_out=False)

    @classmethod
    def get_critical_events(cls):
        """Get all unresolved critical events."""
        return Event.query.filter(
            Event.severity == 'critical',
            Event.status != 'resolved'
        ).all()


class AgentRepository(BaseRepository):
    """Agent repository."""
    model = Agent

    @classmethod
    def get_by_name(cls, name: str):
        """Get agent by name."""
        return Agent.query.filter_by(name=name).first()

    @classmethod
    def get_by_type(cls, agent_type: str):
        """Get all agents of a given type."""
        return Agent.query.filter_by(agent_type=agent_type).all()

    @classmethod
    def get_active_agents(cls):
        """Get all agents that are currently active."""
        return Agent.query.filter_by(status='active').all()
