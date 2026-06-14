from flask import Blueprint, request, jsonify
from app.config.database import db
from app.models import Train

trains_bp = Blueprint('trains', __name__)


@trains_bp.route('', methods=['GET'])
def list_trains():
    """List trains with optional status filtering and pagination."""
    page = request.args.get('page', 1, type=int)
    limit = min(request.args.get('limit', 50, type=int), 200)
    status = request.args.get('status')

    query = Train.query
    if status:
        query = query.filter_by(status=status)

    pagination = query.order_by(Train.train_number).paginate(
        page=page, per_page=limit, error_out=False
    )
    return jsonify({
        'total': pagination.total,
        'pages': pagination.pages,
        'page': page,
        'trains': [t.to_dict() for t in pagination.items],
    }), 200


@trains_bp.route('/<int:train_id>', methods=['GET'])
def get_train(train_id):
    """Get a single train by ID."""
    train = Train.query.get(train_id)
    if not train:
        return jsonify({'error': 'Train not found'}), 404
    return jsonify(train.to_dict()), 200


@trains_bp.route('/<int:train_id>/location', methods=['PUT'])
def update_train_location(train_id):
    """Update a train's real-time location and telemetry."""
    train = Train.query.get(train_id)
    if not train:
        return jsonify({'error': 'Train not found'}), 404

    data = request.get_json(silent=True) or {}
    train.latitude = data.get('latitude', train.latitude)
    train.longitude = data.get('longitude', train.longitude)
    train.current_speed = data.get('current_speed', train.current_speed)
    train.current_passengers = data.get('current_passengers', train.current_passengers)
    train.delay_minutes = data.get('delay_minutes', train.delay_minutes)
    train.status = data.get('status', train.status)

    from datetime import datetime
    train.last_location_update = datetime.utcnow()

    db.session.commit()
    return jsonify(train.to_dict()), 200


@trains_bp.route('', methods=['POST'])
def create_train():
    """Create a new train."""
    data = request.get_json(silent=True)
    if not data or not data.get('train_number'):
        return jsonify({'error': 'train_number is required'}), 400

    existing = Train.query.filter_by(train_number=data['train_number']).first()
    if existing:
        return jsonify({'error': 'Train with this number already exists'}), 409

    train = Train(
        train_number=data['train_number'],
        train_name=data.get('train_name'),
        train_type=data.get('train_type'),
        max_capacity=data.get('max_capacity'),
        route_id=data.get('route_id'),
    )
    db.session.add(train)
    db.session.commit()
    return jsonify(train.to_dict()), 201


@trains_bp.route('/<int:train_id>', methods=['PUT'])
def update_train(train_id):
    """Update train details."""
    train = Train.query.get(train_id)
    if not train:
        return jsonify({'error': 'Train not found'}), 404

    data = request.get_json(silent=True) or {}
    allowed = {'train_name', 'train_type', 'status', 'max_capacity',
               'health_score', 'delay_minutes', 'route_id'}
    for key in allowed:
        if key in data:
            setattr(train, key, data[key])

    db.session.commit()
    return jsonify(train.to_dict()), 200


@trains_bp.route('/<int:train_id>', methods=['DELETE'])
def delete_train(train_id):
    """Delete a train."""
    train = Train.query.get(train_id)
    if not train:
        return jsonify({'error': 'Train not found'}), 404
    db.session.delete(train)
    db.session.commit()
    return jsonify({'message': 'Train deleted'}), 200
