"""Decision Agent — generates actionable decisions and recommendations."""
from app.agents.core.base_agent import BaseAgent


class DecisionAgent(BaseAgent):
    agent_type = 'decision'
    description = 'Generates final decisions and action plans'

    def process_event(self, event, prior_analyses=None) -> dict:
        context = self._build_event_context(event, prior_analyses)
        prompt = (
            f"You are the Chief Decision Agent for Indian Railway operations.\n"
            f"Based on prior agent analyses, generate an action plan:\n\n{context}\n"
            f"State: IMMEDIATE actions (next 30 min), ESCALATION level, "
            f"and passenger communication message. Be decisive and specific."
        )
        self._set_agent_status('processing')
        result = self._query_llm(prompt)
        content = result.get('response') or (
            f"DECISION: Activate emergency protocol for {event.event_type}. "
            f"Notify divisional controller immediately. Prepare alternate route advisory. "
            f"Passenger announcement: Delays expected, alternative arrangements being made."
        )
        confidence = 0.88 if result.get('response') else 0.65
        self._save_message(event.id, content, confidence=confidence)
        self._update_agent_stats(confidence)
        self._broadcast(event.id, content, confidence)
        return {'agent': self.agent_type, 'decision': content, 'event_id': event.id, 'response': content}
