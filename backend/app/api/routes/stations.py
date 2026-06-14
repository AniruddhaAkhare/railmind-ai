from flask import Blueprint, request, jsonify
from app.config.database import db
from app.models import Station
from app.utils.validators import validate_station_data

stations_bp = Blueprint('stations', __name__)


@stations_bp.route('', methods=['GET'])
def list_stations():
    """List stations with optional zone filtering and pagination."""
    page = request.args.get('page', 1, type=int)
    limit = min(request.args.get('limit', 50, type=int), 200)
    zone = request.args.get('zone')
    is_active = request.args.get('is_active')

    query = Station.query
    if zone:
        query = query.filter_by(zone=zone)
    if is_active is not None:
        query = query.filter_by(is_active=is_active.lower() == 'true')

    pagination = query.order_by(Station.name).paginate(
        page=page, per_page=limit, error_out=False
    )
    return jsonify({
        'total': pagination.total,
        'pages': pagination.pages,
        'page': page,
        'stations': [s.to_dict() for s in pagination.items],
    }), 200


@stations_bp.route('/<int:station_id>', methods=['GET'])
def get_station(station_id):
    """Get a single station by ID."""
    station = Station.query.get(station_id)
    if not station:
        return jsonify({'error': 'Station not found'}), 404
    return jsonify(station.to_dict()), 200


@stations_bp.route('', methods=['POST'])
def create_station():
    """Create a new station."""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Invalid JSON body'}), 400
    try:
        validate_station_data(data)
        station = Station(
            name=data['name'],
            code=data['code'],
            latitude=data['latitude'],
            longitude=data['longitude'],
            state=data.get('state'),
            region=data.get('region'),
            zone=data.get('zone'),
            platform_count=data.get('platform_count', 1),
            max_capacity=data.get('max_capacity'),
        )
        db.session.add(station)
        db.session.commit()
        return jsonify(station.to_dict()), 201
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception:
        db.session.rollback()
        return jsonify({'error': 'Internal error creating station'}), 500


@stations_bp.route('/<int:station_id>', methods=['PUT'])
def update_station(station_id):
    """Update an existing station."""
    station = Station.query.get(station_id)
    if not station:
        return jsonify({'error': 'Station not found'}), 404

    data = request.get_json(silent=True) or {}
    allowed = {'name', 'current_crowd', 'is_active', 'platform_count', 'max_capacity'}
    for key in allowed:
        if key in data:
            setattr(station, key, data[key])

    db.session.commit()
    return jsonify(station.to_dict()), 200


@stations_bp.route('/<int:station_id>', methods=['DELETE'])
def delete_station(station_id):
    """Delete a station."""
    station = Station.query.get(station_id)
    if not station:
        return jsonify({'error': 'Station not found'}), 404
    db.session.delete(station)
    db.session.commit()
    return jsonify({'message': 'Station deleted'}), 200
