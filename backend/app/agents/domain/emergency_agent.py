"""Emergency Agent — handles critical emergencies and disaster response."""
from app.agents.core.base_agent import BaseAgent


class EmergencyAgent(BaseAgent):
    agent_type = 'emergency'
    description = 'Coordinates disaster response and emergency operations'

    def process_event(self, event, prior_analyses=None) -> dict:
        context = self._build_event_context(event, prior_analyses)
        prompt = (
            f"You are the Emergency Response Coordinator for Indian Railways.\n"
            f"Coordinate emergency response:\n\n{context}\n"
            f"State: emergency teams to deploy, external agencies to notify "
            f"(NDRF/Police/Fire/Hospital), ARMV requirements, and ART deployment. "
            f"Be decisive."
        )
        self._set_agent_status('processing')
        result = self._query_llm(prompt)
        content = result.get('response') or (
            f"EMERGENCY ACTIVATED: Deploy ARMV from nearest base. "
            f"Notify DRM divisional controller immediately. "
            f"Alert district administration. Site controller to take charge."
        )
        confidence = 0.95 if result.get('response') else 0.7
        self._save_message(event.id, content, confidence=confidence)
        self._update_agent_stats(confidence)
        self._broadcast(event.id, content, confidence)
        return {'agent': self.agent_type, 'emergency_response': content, 'event_id': event.id, 'escalated': True, 'response': content}
