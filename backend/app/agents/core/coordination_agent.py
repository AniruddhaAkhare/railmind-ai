"""Coordination Agent — coordinates inter-agent communication and workflow."""
from app.agents.core.base_agent import BaseAgent


class CoordinationAgent(BaseAgent):
    agent_type = 'coordination'
    description = 'Orchestrates agent workflows and inter-team coordination'

    def process_event(self, event, prior_analyses=None) -> dict:
        context = self._build_event_context(event, prior_analyses)
        prompt = (
            f"You are the Coordination Agent for Indian Railway multi-agent systems.\n"
            f"Based on all prior analyses:\n\n{context}\n"
            f"State: which teams must be notified, coordination sequence, "
            f"and handoff protocol. Be concise."
        )
        self._set_agent_status('processing')
        result = self._query_llm(prompt)
        content = result.get('response') or (
            f"Coordination: Notify maintenance and operations simultaneously. "
            f"Safety team on standby. Passenger services to issue advisory after 15 min."
        )
        confidence = 0.83 if result.get('response') else 0.65
        self._save_message(event.id, content, confidence=confidence)
        self._update_agent_stats(confidence)
        self._broadcast(event.id, content, confidence)
        return {'agent': self.agent_type, 'coordination_plan': content, 'event_id': event.id, 'response': content}
