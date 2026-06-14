from flask import Blueprint, request, jsonify
from app.config.database import db
from app.models import DigitalTwinState
from datetime import datetime

digital_twin_bp = Blueprint('digital_twin', __name__)


@digital_twin_bp.route('/current-state', methods=['GET'])
def get_current_state():
    """Get the most recent current digital twin state."""
    state = DigitalTwinState.query.filter_by(
        state_mode='current'
    ).order_by(DigitalTwinState.created_at.desc()).first()

    if not state:
        return jsonify({'error': 'No current state found'}), 404

    return jsonify({
        'id': state.id,
        'state_type': state.state_type,
        'state_mode': state.state_mode,
        'state_data': state.state_data,
        'timestamp': state.timestamp.isoformat(),
    }), 200


@digital_twin_bp.route('/states', methods=['GET'])
def list_twin_states():
    """List all digital twin state snapshots."""
    page = request.args.get('page', 1, type=int)
    limit = min(request.args.get('limit', 50, type=int), 200)
    state_mode = request.args.get('state_mode')

    query = DigitalTwinState.query
    if state_mode:
        query = query.filter_by(state_mode=state_mode)

    pagination = query.order_by(
        DigitalTwinState.created_at.desc()
    ).paginate(page=page, per_page=limit, error_out=False)

    return jsonify({
        'total': pagination.total,
        'pages': pagination.pages,
        'page': page,
        'states': [{
            'id': s.id,
            'state_type': s.state_type,
            'state_mode': s.state_mode,
            'timestamp': s.timestamp.isoformat(),
        } for s in pagination.items],
    }), 200


@digital_twin_bp.route('/states', methods=['POST'])
def create_state():
    """Create a new state snapshot."""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Invalid JSON body'}), 400
    if not data.get('state_type') or not data.get('state_data'):
        return jsonify({'error': 'state_type and state_data are required'}), 400

    state = DigitalTwinState(
        state_type=data['state_type'],
        state_mode=data.get('state_mode', 'current'),
        state_data=data['state_data'],
        timestamp=datetime.utcnow(),
    )
    db.session.add(state)
    db.session.commit()
    return jsonify({'id': state.id, 'timestamp': state.timestamp.isoformat()}), 201


@digital_twin_bp.route('/states/<int:state_id>', methods=['GET'])
def get_state(state_id):
    """Get a specific state snapshot."""
    state = DigitalTwinState.query.get(state_id)
    if not state:
        return jsonify({'error': 'State not found'}), 404
    return jsonify({
        'id': state.id,
        'state_type': state.state_type,
        'state_mode': state.state_mode,
        'state_data': state.state_data,
        'timestamp': state.timestamp.isoformat(),
    }), 200


@digital_twin_bp.route('/blueprint/geometry', methods=['GET'])
def get_blueprint_geometry():
    """Blueprint Data Engine: Provides topology/geometry for 3D visualizations."""
    blueprint_type = request.args.get('type', 'track')
    
    geometry = {
        'type': blueprint_type,
        'nodes': [],
        'edges': []
    }
    
    if blueprint_type == 'track':
        geometry['nodes'] = [{'id': f'node_{i}', 'x': i*10, 'y': 0, 'z': i*2} for i in range(10)]
        geometry['edges'] = [{'source': f'node_{i}', 'target': f'node_{i+1}'} for i in range(9)]
    elif blueprint_type == 'station':
        geometry['nodes'] = [{'id': 'platform_1', 'width': 100, 'height': 20, 'depth': 5}]
    elif blueprint_type == 'train':
        geometry['nodes'] = [{'id': 'coach_1', 'type': 'engine'}, {'id': 'coach_2', 'type': 'passenger'}]
    
    return jsonify(geometry), 200
