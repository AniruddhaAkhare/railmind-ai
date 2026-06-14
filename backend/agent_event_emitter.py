import json
from datetime import datetime

class AgentEventEmitter:
    @staticmethod
    def format_event(event_type: str, from_agent: str, to_agent: str, message: dict, state_snapshot: dict = None) -> dict:
        """
        Formats an agent event into the strict JSON schema required by the React Flow frontend.
        """
        return {
            "event_type": event_type,  # 'agent_start' | 'agent_message' | 'agent_end' | 'emergency_trigger'
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "from_agent": from_agent,
            "to_agent": to_agent,
            "state_snapshot": state_snapshot or {},
            "message": {
                "reasoning": message.get("reasoning", ""),
                "summary": message.get("summary", ""),
                "confidence": message.get("confidence", 0.0),
                "recommendations": message.get("recommendations", []),
                "action_plan": message.get("action_plan", []),
                "stakeholder_impact": message.get("stakeholder_impact", ""),
                "future_predictions": message.get("future_predictions", "")
            }
        }
