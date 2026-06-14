"""Understanding Agent — provides deep situational analysis of events."""
from app.agents.core.base_agent import BaseAgent


class UnderstandingAgent(BaseAgent):
    agent_type = 'understanding'
    description = 'Analyses root causes and situational context of events'

    def process_event(self, event, prior_analyses=None) -> dict:
        context = self._build_event_context(event, prior_analyses)
        prompt = (
            f"You are a railway operations expert for Indian Railways.\n"
            f"Analyze this event:\n\n{context}\n"
            f"Provide concisely (3-4 sentences): (1) probable root cause, "
            f"(2) contributing factors, (3) situational understanding."
        )
        self._set_agent_status('processing')
        result = self._query_llm(prompt)
        content = result.get('response') or self._fallback_response(event)
        confidence = 0.8 if result.get('response') else 0.6
        self._save_message(event.id, content, confidence=confidence)
        self._update_agent_stats(confidence)
        self._broadcast(event.id, content, confidence)
        return {'agent': self.agent_type, 'analysis': content, 'event_id': event.id, 'response': content}
