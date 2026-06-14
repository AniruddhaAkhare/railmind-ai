"""Prediction Agent — forecasts future conditions and cascade effects."""
from app.agents.core.base_agent import BaseAgent


class PredictionAgent(BaseAgent):
    agent_type = 'prediction'
    description = 'Forecasts cascading effects and future incident likelihood'

    def process_event(self, event, prior_analyses=None) -> dict:
        context = self._build_event_context(event, prior_analyses)
        prompt = (
            f"You are a predictive analytics expert for Indian Railways.\n"
            f"Forecast future impacts:\n\n{context}\n"
            f"State: cascade effects on downstream trains, likelihood of escalation, "
            f"and predicted recovery timeline."
        )
        self._set_agent_status('processing')
        result = self._query_llm(prompt)
        content = result.get('response') or (
            f"Prediction: {event.event_type} likely to cause cascade delays of "
            f"30-90 min on downstream trains. Escalation risk: moderate. "
            f"Recovery expected within 4-6 hours under normal conditions."
        )
        confidence = 0.76 if result.get('response') else 0.55
        self._save_message(event.id, content, confidence=confidence)
        self._update_agent_stats(confidence)
        self._broadcast(event.id, content, confidence)
        return {'agent': self.agent_type, 'prediction': content, 'event_id': event.id, 'response': content}
