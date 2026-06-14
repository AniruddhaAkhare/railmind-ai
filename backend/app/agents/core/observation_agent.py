"""Observation Agent — detects and classifies railway events."""
from app.agents.core.base_agent import BaseAgent


class ObservationAgent(BaseAgent):
    agent_type = 'observation'
    description = 'Monitors sensors and classifies incoming events'

    def process_event(self, event, prior_analyses=None) -> dict:
        context = self._build_event_context(event, prior_analyses)
        prompt = (
            f"You are an expert railway observation agent for Indian Railways.\n"
            f"Analyze the following event and classify it:\n\n{context}\n"
            f"Respond concisely (3-4 sentences): event classification, severity assessment, "
            f"and immediate observations. Be direct and professional."
        )
        self._set_agent_status('processing')
        result = self._query_llm(prompt)
        content = result.get('response') or self._fallback_response(event)
        confidence = 0.85 if result.get('response') else 0.6
        self._save_message(event.id, content, confidence=confidence)
        self._update_agent_stats(confidence)
        self._broadcast(event.id, content, confidence)
        return {'agent': self.agent_type, 'observation': content, 'event_id': event.id, 'response': content}
