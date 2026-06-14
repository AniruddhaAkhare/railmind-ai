"""Impact Agent — quantifies operational and passenger impact."""
from app.agents.core.base_agent import BaseAgent


class ImpactAgent(BaseAgent):
    agent_type = 'impact'
    description = 'Quantifies impact across operations, passengers, and financials'

    def process_event(self, event, prior_analyses=None) -> dict:
        context = self._build_event_context(event, prior_analyses)
        prompt = (
            f"You are an operations impact analyst for Indian Railways.\n"
            f"Quantify the impact of this event:\n\n{context}\n"
            f"State concisely: passenger impact, operational disruption (0-10), "
            f"estimated delay propagation, and affected zone."
        )
        self._set_agent_status('processing')
        result = self._query_llm(prompt)
        content = result.get('response') or (
            f"Impact: {event.affected_passengers:,} passengers affected. "
            f"Operational disruption score: 7/10. Delay propagation: ~{event.estimated_delay_minutes} min downstream."
        )
        confidence = 0.78 if result.get('response') else 0.6
        self._save_message(event.id, content, confidence=confidence)
        self._update_agent_stats(confidence)
        self._broadcast(event.id, content, confidence)
        return {'agent': self.agent_type, 'impact_assessment': content, 'event_id': event.id, 'response': content}
