from flask import Flask, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO
from datetime import datetime
from app.config.settings import get_config
from app.config.database import db
from app.utils.logger import setup_logger
from app.utils.constants import AGENT_TYPES

socketio = SocketIO(cors_allowed_origins="*", async_mode='threading', logger=False)


def create_app(config=None):
    """Application factory"""
    app = Flask(__name__)
    if config is None:
        config = get_config()
    app.config.from_object(config)

    setup_logger(app)
    db.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    socketio.init_app(app)

    with app.app_context():
        try:
            # Import all models inside app context so SQLAlchemy discovers them
            from app.models import (  # noqa: F401
                Station, Platform, Track, Train, Route, Asset,
                Event, EventRelationship, Agent, AgentMessage, AgentDecision,
                Task, Workflow, Simulation, DigitalTwinState,
                RiskAssessment, ImpactAssessment, Incident, SOP, Manual,
                PulseEvent, NotificationLog, UserSession,
                AgentExecutionTrace, AgentMemory, FutureScenario,
            )
            db.create_all()
            app.logger.info("✅ Database initialized")
            _seed_agents_if_empty(app)
            _seed_data_if_empty(app)
        except Exception as e:
            app.logger.error(f"❌ Database init failed: {e}")

    register_blueprints(app)
    register_error_handlers(app)
    register_socketio_namespaces(app)

    # Start sensor stream and event streamer in a background thread
    import threading
    import os
    if os.environ.get('WERKZEUG_RUN_MAIN') == 'true' or not app.debug:
        from sensor_stream import run as run_sensor_stream
        from event_streamer import event_streamer
        
        threading.Thread(target=run_sensor_stream, daemon=True, name="sensor-stream").start()
        app.logger.info("✅ Started background sensor stream")
        
        event_streamer.start()
        app.logger.info("✅ Started event streamer daemon")

    @app.route('/health', methods=['GET'])
    def health_check():
        return jsonify({
            'status': 'healthy',
            'timestamp': datetime.utcnow().isoformat(),
            'app': app.config['APP_NAME'],
            'version': app.config['APP_VERSION'],
        }), 200

    return app


def _seed_agents_if_empty(app):
    """Seed the agents table if it is empty."""
    try:
        from app.models import Agent
        from app.config.database import db

        if Agent.query.count() == 0:
            agent_configs = [
                ('Observation Agent', 'observation'),
                ('Understanding Agent', 'understanding'),
                ('Prediction Agent', 'prediction'),
                ('Risk Assessment Agent', 'risk'),
                ('Impact Analysis Agent', 'impact'),
                ('Simulation Agent', 'simulation'),
                ('Decision Agent', 'decision'),
                ('Coordination Agent', 'coordination'),
                ('Communication Agent', 'communication'),
                ('Knowledge Agent', 'knowledge'),
                ('Safety Agent', 'safety'),
                ('Maintenance Agent', 'maintenance'),
                ('Operations Agent', 'operations'),
                ('Passenger Services Agent', 'passenger'),
                ('Emergency Response Agent', 'emergency'),
            ]
            for name, agent_type in agent_configs:
                agent = Agent(
                    name=name,
                    agent_type=agent_type,
                    status='idle',
                    total_decisions=0,
                    success_rate=0.0,
                    avg_confidence=0.0,
                )
                db.session.add(agent)
            db.session.commit()
            app.logger.info(f"✅ Seeded {len(agent_configs)} agents")
    except Exception as e:
        db.session.rollback()
        app.logger.warning(f"⚠️ Agent seeding failed: {e}")


def _seed_data_if_empty(app):
    """Seed stations, trains, routes, and events if the database is empty."""
    try:
        from app.models import Station
        if Station.query.count() == 0:
            from app.database.seed import seed_all
            seed_all(app)
    except Exception as e:
        app.logger.warning(f"⚠️ Data seeding failed: {e}")


def register_blueprints(app):
    """Register all blueprints"""
    from app.api.routes.events import events_bp
    from app.api.routes.stations import stations_bp
    from app.api.routes.trains import trains_bp
    from app.api.routes.routes import routes_bp
    from app.api.routes.simulations import simulations_bp
    from app.api.routes.agents import agents_bp
    from app.api.routes.digital_twin import digital_twin_bp
    from app.api.routes.sensors import sensors_bp

    blueprints = [
        (events_bp, '/events'),
        (stations_bp, '/stations'),
        (trains_bp, '/trains'),
        (routes_bp, '/routes'),
        (simulations_bp, '/simulations'),
        (agents_bp, '/agents'),
        (digital_twin_bp, '/digital-twin'),
        (sensors_bp, '/sensors'),
    ]

    for bp, url_prefix in blueprints:
        app.register_blueprint(bp, url_prefix=f"{app.config['API_PREFIX']}{url_prefix}")

    app.logger.info(f"✅ Registered {len(blueprints)} blueprints")


def register_error_handlers(app):
    """Register error handlers"""
    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({'error': 'Bad request', 'details': str(error)}), 400

    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': 'Not found'}), 404

    @app.errorhandler(405)
    def method_not_allowed(error):
        return jsonify({'error': 'Method not allowed'}), 405

    @app.errorhandler(500)
    def internal_error(error):
        app.logger.error(f"Internal error: {error}")
        return jsonify({'error': 'Internal server error'}), 500


def register_socketio_namespaces(app):
    """Register Socket.IO namespaces"""
    try:
        from app.sockets.namespaces import (
            events_ns,
            agents_ns,
            simulations_ns,
            pulse_ns,
            alerts_ns,
            replay_ns,
        )
        from ws_gateway import agent_graph_gateway
        
        socketio.on_namespace(events_ns)
        socketio.on_namespace(agents_ns)
        socketio.on_namespace(simulations_ns)
        socketio.on_namespace(pulse_ns)
        socketio.on_namespace(alerts_ns)
        socketio.on_namespace(replay_ns)
        socketio.on_namespace(agent_graph_gateway)
        app.logger.info("✅ Registered 7 Socket.IO namespaces")
    except Exception as e:
        app.logger.warning(f"⚠️ Socket.IO namespace registration failed: {e}")