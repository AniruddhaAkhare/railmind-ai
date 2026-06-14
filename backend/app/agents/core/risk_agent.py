"""Risk Agent — assesses risk levels and mitigation strategies."""
from app.agents.core.base_agent import BaseAgent


class RiskAgent(BaseAgent):
    agent_type = 'risk'
    description = 'Evaluates risk probability and mitigation options'

    def process_event(self, event, prior_analyses=None) -> dict:
        context = self._build_event_context(event, prior_analyses)
        prompt = (
            f"You are a risk assessment expert for Indian Railways.\n"
            f"Evaluate the risk:\n\n{context}\n"
            f"Concisely state: risk score (0.0-1.0), risk level, "
            f"top 2 mitigation actions, and escalation recommendation."
        )
        self._set_agent_status('processing')
        result = self._query_llm(prompt)
        severity_map = {'low': 0.2, 'medium': 0.5, 'high': 0.75, 'critical': 0.95}
        default_score = severity_map.get(event.severity, 0.5)
        content = result.get('response') or (
            f"Risk score: {default_score}. Level: {event.severity.upper()}. "
            f"Action: Notify divisional controller immediately."
        )
        confidence = 0.82 if result.get('response') else 0.6
        self._save_message(event.id, content, confidence=confidence)
        self._update_agent_stats(confidence)
        self._broadcast(event.id, content, confidence)
        return {'agent': self.agent_type, 'risk_assessment': content, 'risk_score': default_score, 'event_id': event.id, 'response': content}
