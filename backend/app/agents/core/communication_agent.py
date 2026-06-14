"""Communication Agent — drafts official communications."""
from app.agents.core.base_agent import BaseAgent


class CommunicationAgent(BaseAgent):
    agent_type = 'communication'
    description = 'Drafts passenger and official communications'

    def process_event(self, event, prior_analyses=None) -> dict:
        context = self._build_event_context(event, prior_analyses)
        content = (
            f"Communication drafted: 'Dear passengers, we regret to inform you that due to "
            f"a {event.event_type.replace('_', ' ')} incident, trains are experiencing delays. "
            f"Affected passengers may claim refunds at booking counters. "
            f"We apologize for the inconvenience and are working to restore services promptly.'"
        )
        self._set_agent_status('processing')
        confidence = 0.88
        self._save_message(event.id, content, confidence=confidence)
        self._update_agent_stats(confidence)
        self._broadcast(event.id, content, confidence)
        return {'agent': self.agent_type, 'communication': content, 'event_id': event.id, 'response': content}
