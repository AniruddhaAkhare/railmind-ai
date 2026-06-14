from flask import Blueprint, request, jsonify
from app.config.database import db
from app.models import Route

routes_bp = Blueprint('routes', __name__)


@routes_bp.route('', methods=['GET'])
def list_routes():
    """List all routes with pagination."""
    page = request.args.get('page', 1, type=int)
    limit = min(request.args.get('limit', 50, type=int), 200)
    status = request.args.get('status')

    query = Route.query
    if status:
        query = query.filter_by(status=status)

    pagination = query.order_by(Route.name).paginate(
        page=page, per_page=limit, error_out=False
    )
    return jsonify({
        'total': pagination.total,
        'pages': pagination.pages,
        'page': page,
        'routes': [r.to_dict() for r in pagination.items],
    }), 200


@routes_bp.route('/<int:route_id>', methods=['GET'])
def get_route(route_id):
    """Get a single route by ID."""
    route = Route.query.get(route_id)
    if not route:
        return jsonify({'error': 'Route not found'}), 404
    return jsonify(route.to_dict()), 200


@routes_bp.route('', methods=['POST'])
def create_route():
    """Create a new route."""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Invalid JSON body'}), 400
    if not data.get('name') or not data.get('source_station_id') or not data.get('destination_station_id'):
        return jsonify({'error': 'name, source_station_id and destination_station_id are required'}), 400

    route = Route(
        name=data['name'],
        source_station_id=data['source_station_id'],
        destination_station_id=data['destination_station_id'],
        distance_km=data.get('distance_km'),
        estimated_time_hours=data.get('estimated_time_hours'),
    )
    db.session.add(route)
    db.session.commit()
    return jsonify(route.to_dict()), 201


@routes_bp.route('/<int:route_id>', methods=['PUT'])
def update_route(route_id):
    """Update a route."""
    route = Route.query.get(route_id)
    if not route:
        return jsonify({'error': 'Route not found'}), 404

    data = request.get_json(silent=True) or {}
    allowed = {'name', 'status', 'congestion_level', 'distance_km', 'estimated_time_hours'}
    for key in allowed:
        if key in data:
            setattr(route, key, data[key])

    db.session.commit()
    return jsonify(route.to_dict()), 200


@routes_bp.route('/<int:route_id>', methods=['DELETE'])
def delete_route(route_id):
    """Delete a route."""
    route = Route.query.get(route_id)
    if not route:
        return jsonify({'error': 'Route not found'}), 404
    db.session.delete(route)
    db.session.commit()
    return jsonify({'message': 'Route deleted'}), 200
