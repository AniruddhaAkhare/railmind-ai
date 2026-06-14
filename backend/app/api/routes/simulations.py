from flask import Blueprint, request, jsonify
from app.config.database import db
from app.models import Simulation
from app.services.simulation_service import SimulationService

simulations_bp = Blueprint('simulations', __name__)


@simulations_bp.route('', methods=['GET'])
def list_simulations():
    """List all simulations with pagination."""
    page = request.args.get('page', 1, type=int)
    limit = min(request.args.get('limit', 50, type=int), 200)

    pagination = SimulationService.list_simulations(page, limit)
    return jsonify({
        'total': pagination.total,
        'pages': pagination.pages,
        'page': page,
        'simulations': [s.to_dict() for s in pagination.items],
    }), 200


@simulations_bp.route('/<int:sim_id>', methods=['GET'])
def get_simulation(sim_id):
    """Get a single simulation by ID."""
    sim = SimulationService.get_simulation(sim_id)
    if not sim:
        return jsonify({'error': 'Simulation not found'}), 404
    return jsonify(sim.to_dict()), 200


@simulations_bp.route('', methods=['POST'])
def create_simulation():
    """Create a new simulation."""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'Invalid JSON body'}), 400
    required = ['name', 'simulation_type', 'scenario']
    for field in required:
        if not data.get(field):
            return jsonify({'error': f'{field} is required'}), 400

    sim = SimulationService.create_simulation(data)
    return jsonify(sim.to_dict()), 201


@simulations_bp.route('/<int:sim_id>/run', methods=['POST'])
def run_simulation(sim_id):
    """Execute a simulation."""
    sim = SimulationService.run_simulation(sim_id)
    if not sim:
        return jsonify({'error': 'Simulation not found'}), 404
    return jsonify(sim.to_dict()), 200


@simulations_bp.route('/<int:sim_id>', methods=['DELETE'])
def delete_simulation(sim_id):
    """Delete a simulation."""
    sim = Simulation.query.get(sim_id)
    if not sim:
        return jsonify({'error': 'Simulation not found'}), 404
    db.session.delete(sim)
    db.session.commit()
    return jsonify({'message': 'Simulation deleted'}), 200
