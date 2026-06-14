from app.config.database import db
from app.models import Simulation, DigitalTwinState
from datetime import datetime
import random


class SimulationService:
    """Service for digital twin simulation operations."""

    @staticmethod
    def create_simulation(sim_data: dict) -> Simulation:
        """Create a new simulation record."""
        simulation = Simulation(
            name=sim_data['name'],
            simulation_type=sim_data['simulation_type'],
            scenario=sim_data['scenario'],
            status='pending',
        )
        db.session.add(simulation)
        db.session.commit()
        return simulation

    @staticmethod
    def run_simulation(simulation_id: int) -> Simulation:
        """Execute a simulation and compute results."""
        simulation = Simulation.query.get(simulation_id)
        if not simulation:
            return None

        simulation.status = 'running'
        simulation.start_time = datetime.utcnow()
        db.session.commit()

        try:
            results = SimulationService._compute_results(simulation)
            simulation.status = 'completed'
            simulation.end_time = datetime.utcnow()
            simulation.duration_seconds = int(
                (simulation.end_time - simulation.start_time).total_seconds()
            )
            simulation.results = results

            # Snapshot state
            state = DigitalTwinState(
                state_type=simulation.simulation_type,
                state_mode='simulated',
                state_data=results,
            )
            db.session.add(state)
        except Exception as e:
            simulation.status = 'failed'
            simulation.results = {'error': str(e)}

        db.session.commit()
        return simulation

    @staticmethod
    def _compute_results(simulation: Simulation) -> dict:
        """Generate simulation results based on scenario type."""
        scenario = simulation.scenario
        base = {
            'scenario': scenario,
            'simulation_type': simulation.simulation_type,
            'computed_at': datetime.utcnow().isoformat(),
        }

        if simulation.simulation_type == 'impact':
            base.update({
                'impact_score': round(random.uniform(0.3, 0.95), 3),
                'affected_trains': random.randint(1, 15),
                'affected_passengers': random.randint(500, 50000),
                'estimated_delay_minutes': random.randint(10, 180),
                'cascading_risk': round(random.uniform(0.1, 0.8), 3),
            })
        elif simulation.simulation_type == 'risk':
            base.update({
                'risk_score': round(random.uniform(0.2, 0.9), 3),
                'risk_level': random.choice(['low', 'medium', 'high', 'critical']),
                'mitigation_cost_estimate': random.randint(100000, 5000000),
                'time_to_resolve_hours': random.randint(1, 48),
            })
        elif simulation.simulation_type == 'capacity':
            base.update({
                'utilisation_percent': round(random.uniform(60, 110), 1),
                'bottleneck_stations': [f'Station_{i}' for i in random.sample(range(1, 20), 3)],
                'recommended_frequency_increase': random.randint(0, 5),
            })
        else:
            base.update({
                'status': 'executed',
                'events_simulated': random.randint(5, 50),
                'resolution_rate': round(random.uniform(0.7, 1.0), 3),
            })

        return base

    @staticmethod
    def get_simulation(simulation_id: int) -> Simulation:
        """Get a simulation by ID."""
        return Simulation.query.get(simulation_id)

    @staticmethod
    def list_simulations(page: int = 1, per_page: int = 50):
        """List simulations with pagination."""
        return Simulation.query.order_by(
            Simulation.created_at.desc()
        ).paginate(page=page, per_page=per_page, error_out=False)
