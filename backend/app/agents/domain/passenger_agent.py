"""Passenger Agent — handles passenger welfare, information, and logistics."""
from app.agents.core.base_agent import BaseAgent


class PassengerAgent(BaseAgent):
    agent_type = 'passenger'
    description = 'Manages passenger welfare, crowd control, and advisories'

    def process_event(self, event, prior_analyses=None) -> dict:
        context = self._build_event_context(event, prior_analyses)
        prompt = (
            f"You are a Passenger Service Manager for Indian Railways.\n"
            f"Manage passenger welfare:\n\n{context}\n"
            f"State: immediate safety actions, refund/rebooking policy, "
            f"accommodation needs, and crowd management plan. Be compassionate and clear."
        )
        self._set_agent_status('processing')
        result = self._query_llm(prompt)
        content = result.get('response') or (
            f"Passenger actions: Deploy staff for crowd management at affected platforms. "
            f"Issue full refund for cancelled trains via IRCTC. "
            f"Arrange drinking water and seating for waiting passengers. "
            f"PA announcement every 15 minutes with updates."
        )
        confidence = 0.86 if result.get('response') else 0.65
        self._save_message(event.id, content, confidence=confidence)
        self._update_agent_stats(confidence)
        self._broadcast(event.id, content, confidence)
        return {'agent': self.agent_type, 'passenger_plan': content, 'event_id': event.id, 'response': content}
