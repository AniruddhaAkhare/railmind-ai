from flask import Blueprint, request, jsonify
from app.config.database import db
from app.models import Agent, AgentMessage, AgentDecision
from datetime import datetime

agents_bp = Blueprint('agents', __name__)


@agents_bp.route('', methods=['GET'])
def list_agents():
    """List all agents."""
    agents = Agent.query.order_by(Agent.name).all()
    return jsonify({
        'count': len(agents),
        'agents': [a.to_dict() for a in agents],
    }), 200


@agents_bp.route('/<int:agent_id>', methods=['GET'])
def get_agent(agent_id):
    """Get a single agent by ID."""
    agent = Agent.query.get(agent_id)
    if not agent:
        return jsonify({'error': 'Agent not found'}), 404
    return jsonify(agent.to_dict()), 200


@agents_bp.route('/<int:agent_id>/messages', methods=['GET'])
def get_agent_messages(agent_id):
    """Get messages for an agent."""
    page = request.args.get('page', 1, type=int)
    limit = min(request.args.get('limit', 50, type=int), 200)

    pagination = AgentMessage.query.filter_by(agent_id=agent_id).order_by(
        AgentMessage.created_at.desc()
    ).paginate(page=page, per_page=limit, error_out=False)

    return jsonify({
        'total': pagination.total,
        'messages': [m.to_dict() for m in pagination.items],
    }), 200


@agents_bp.route('/<int:agent_id>/decisions', methods=['GET'])
def get_agent_decisions(agent_id):
    """Get decisions made by an agent."""
    page = request.args.get('page', 1, type=int)
    limit = min(request.args.get('limit', 50, type=int), 200)

    pagination = AgentDecision.query.filter_by(agent_id=agent_id).order_by(
        AgentDecision.created_at.desc()
    ).paginate(page=page, per_page=limit, error_out=False)

    return jsonify({
        'total': pagination.total,
        'decisions': [d.to_dict() for d in pagination.items],
    }), 200


@agents_bp.route('/<int:agent_id>/status', methods=['PUT'])
def update_agent_status(agent_id):
    """Update an agent's status."""
    agent = Agent.query.get(agent_id)
    if not agent:
        return jsonify({'error': 'Agent not found'}), 404

    data = request.get_json(silent=True) or {}
    status = data.get('status')
    valid_statuses = ['idle', 'active', 'processing', 'error', 'offline']
    if status and status not in valid_statuses:
        return jsonify({'error': f'Invalid status. Must be one of: {valid_statuses}'}), 400

    if status:
        agent.status = status
    agent.updated_at = datetime.utcnow()
    db.session.commit()
    return jsonify(agent.to_dict()), 200


@agents_bp.route('/<int:agent_id>/memory', methods=['GET'])
def get_agent_memory(agent_id):
    """Get agent memory: recent observations, decisions, confidence evolution."""
    agent = Agent.query.get(agent_id)
    if not agent:
        return jsonify({'error': 'Agent not found'}), 404

    limit = min(request.args.get('limit', 15, type=int), 50)

    # Recent messages (observations / reasoning)
    messages = AgentMessage.query.filter_by(agent_id=agent_id).order_by(
        AgentMessage.created_at.desc()
    ).limit(limit).all()

    # Recent decisions
    decisions = AgentDecision.query.filter_by(agent_id=agent_id).order_by(
        AgentDecision.created_at.desc()
    ).limit(limit).all()

    # Confidence evolution (last N messages with confidence > 0)
    confidence_history = [
        {
            'timestamp': m.created_at.isoformat() if m.created_at else None,
            'confidence': m.confidence,
            'message_type': m.message_type,
        }
        for m in messages if m.confidence and m.confidence > 0
    ]

    return jsonify({
        'agent': agent.to_dict(),
        'messages': [m.to_dict() for m in messages],
        'decisions': [d.to_dict() for d in decisions],
        'confidence_history': confidence_history,
        'total_messages': AgentMessage.query.filter_by(agent_id=agent_id).count(),
        'total_decisions': AgentDecision.query.filter_by(agent_id=agent_id).count(),
    }), 200

