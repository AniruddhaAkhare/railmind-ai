"""Maintenance Agent — schedules and prioritises maintenance actions."""
from app.agents.core.base_agent import BaseAgent


class MaintenanceAgent(BaseAgent):
    agent_type = 'maintenance'
    description = 'Plans and prioritises infrastructure maintenance activities'

    def process_event(self, event, prior_analyses=None) -> dict:
        context = self._build_event_context(event, prior_analyses)
        prompt = (
            f"You are a Maintenance Engineer for Indian Railways.\n"
            f"Plan maintenance response:\n\n{context}\n"
            f"State: maintenance team to dispatch (PW/Signal/OHE/Mechanical), "
            f"tools required, estimated repair time, and whether line block is needed."
        )
        self._set_agent_status('processing')
        result = self._query_llm(prompt)
        content = result.get('response') or (
            f"Dispatch P-Way maintenance gang with ultrasonic testing equipment. "
            f"Estimated repair time: 4 hours. Line block required for 2 hours. "
            f"Speed restriction at 30 km/h until completion."
        )
        confidence = 0.87 if result.get('response') else 0.65
        self._save_message(event.id, content, confidence=confidence)
        self._update_agent_stats(confidence)
        self._broadcast(event.id, content, confidence)
        return {'agent': self.agent_type, 'maintenance_plan': content, 'event_id': event.id, 'response': content}
