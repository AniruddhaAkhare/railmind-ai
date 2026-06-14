"""Operations Agent — manages real-time train operations and scheduling."""
from app.agents.core.base_agent import BaseAgent


class OperationsAgent(BaseAgent):
    agent_type = 'operations'
    description = 'Manages train operations, rescheduling, and traffic flow'

    def process_event(self, event, prior_analyses=None) -> dict:
        context = self._build_event_context(event, prior_analyses)
        prompt = (
            f"You are a Divisional Operations Manager for Indian Railways.\n"
            f"Manage operations:\n\n{context}\n"
            f"State: trains to hold/reroute/cancel, alternate route, "
            f"priority for express vs. passenger trains, and schedule recovery time."
        )
        self._set_agent_status('processing')
        result = self._query_llm(prompt)
        content = result.get('response') or (
            f"Operations: Hold Mail/Express trains at preceding station. "
            f"Passenger trains via alternate loop line. Recovery expected within 3 hours. "
            f"CRS to be informed if line closed >2 hours."
        )
        confidence = 0.84 if result.get('response') else 0.65
        self._save_message(event.id, content, confidence=confidence)
        self._update_agent_stats(confidence)
        self._broadcast(event.id, content, confidence)
        return {'agent': self.agent_type, 'operations_plan': content, 'event_id': event.id, 'response': content}
