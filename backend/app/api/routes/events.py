from flask import Blueprint, request, jsonify
from app.config.database import db
from app.models import Event
from app.services.event_service import EventService
from app.utils.validators import validate_event_data

events_bp = Blueprint('events', __name__)


@events_bp.route('', methods=['GET'])
def list_events():
    """List events with optional filtering and pagination."""
    page = request.args.get('page', 1, type=int)
    limit = min(request.args.get('limit', 50, type=int), 200)
    status = request.args.get('status')
    severity = request.args.get('severity')

    query = Event.query
    if status:
        query = query.filter_by(status=status)
    if severity:
        query = query.filter_by(severity=severity)

    pagination = query.order_by(Event.created_at.desc()).paginate(
        page=page, per_page=limit, error_out=False
    )

    return jsonify({
        'total': pagination.total,
        'pages': pagination.pages,
        'page': page,
        'events': [e.to_dict() for e in pagination.items],
    }), 200


@events_bp.route('/stats', methods=['GET'])
def event_stats():
    """Return aggregate event statistics."""
    return jsonify(EventService.get_stats()), 200


@events_bp.route('/<int:event_id>', methods=['GET'])
def get_event(event_id):
    """Get a single event by ID."""
    event = EventService.get_event(event_id)
    if not event:
        return jsonify({'error': 'Event not found'}), 404
    return jsonify(event.to_dict()), 200


@events_bp.route('', methods=['POST'])
def create_event():
    """Create a new event and trigger agent processing."""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Invalid JSON body'}), 400
    try:
        validate_event_data(data)
        event = EventService.create_event(data)
        EventService.trigger_agents(event)
        return jsonify(event.to_dict()), 201
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        import traceback
        db.session.rollback()
        return jsonify({'error': 'Internal error creating event', 'details': str(e), 'trace': traceback.format_exc()}), 500


@events_bp.route('/<int:event_id>', methods=['PUT'])
def update_event(event_id):
    """Update an existing event."""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Invalid JSON body'}), 400
    event = EventService.update_event(event_id, data)
    if not event:
        return jsonify({'error': 'Event not found'}), 404
    return jsonify(event.to_dict()), 200


@events_bp.route('/<int:event_id>/resolve', methods=['POST'])
def resolve_event(event_id):
    """Mark an event as resolved."""
    event = EventService.resolve_event(event_id)
    if not event:
        return jsonify({'error': 'Event not found'}), 404
    return jsonify(event.to_dict()), 200


@events_bp.route('/<int:event_id>', methods=['DELETE'])
def delete_event(event_id):
    """Delete an event."""
    event = Event.query.get(event_id)
    if not event:
        return jsonify({'error': 'Event not found'}), 404
    db.session.delete(event)
    db.session.commit()
    return jsonify({'message': 'Event deleted'}), 200
