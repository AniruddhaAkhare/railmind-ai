"""Simulation Agent — runs scenario simulations."""
from app.agents.core.base_agent import BaseAgent


class SimulationAgent(BaseAgent):
    agent_type = 'simulation'
    description = 'Runs what-if simulations for incident scenarios'

    def process_event(self, event, prior_analyses=None) -> dict:
        context = self._build_event_context(event, prior_analyses)
        content = (
            f"Simulation: Running 3 response scenarios for {event.event_type}. "
            f"Scenario A (fast response): Recovery in 2h, 40% delay reduction. "
            f"Scenario B (standard): Recovery in 4h, standard delays. "
            f"Scenario C (escalation): Full line block 6h, major disruption."
        )
        self._set_agent_status('processing')
        confidence = 0.72
        self._save_message(event.id, content, confidence=confidence)
        self._update_agent_stats(confidence)
        self._broadcast(event.id, content, confidence)
        return {'agent': self.agent_type, 'simulation_result': content, 'event_id': event.id, 'response': content}
