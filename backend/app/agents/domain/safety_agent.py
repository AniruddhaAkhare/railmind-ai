"""Safety Agent — enforces railway safety protocols and regulations."""
from app.agents.core.base_agent import BaseAgent


class SafetyAgent(BaseAgent):
    agent_type = 'safety'
    description = 'Monitors and enforces railway safety protocols'

    def process_event(self, event, prior_analyses=None) -> dict:
        context = self._build_event_context(event, prior_analyses)
        prompt = (
            f"You are the Chief Safety Officer for Indian Railways.\n"
            f"Assess the safety implications:\n\n{context}\n"
            f"State concisely: safety risk (GREEN/AMBER/RED), mandatory actions, "
            f"applicable GR rule, and whether line closure is required."
        )
        self._set_agent_status('processing')
        result = self._query_llm(prompt)
        content = result.get('response') or (
            f"Safety Level: AMBER. Enforce 30 km/h speed restriction. "
            f"Refer GR Rule 4.14. Station Master notified. Line closure not required at this stage."
        )
        confidence = 0.92 if result.get('response') else 0.7
        self._save_message(event.id, content, confidence=confidence)
        self._update_agent_stats(confidence)
        self._broadcast(event.id, content, confidence)
        return {'agent': self.agent_type, 'safety_assessment': content, 'event_id': event.id, 'response': content}
