"""Base Agent — shared functionality for all RailMind agents."""
import logging
from datetime import datetime
from app.config.database import db
from app.llm.openrouter_client import OpenRouterClient
from app.llm.model_router import ModelRouter
from agent_event_emitter import AgentEventEmitter
from event_streamer import broadcast_graph_event

logger = logging.getLogger(__name__)


class BaseAgent:
    """Abstract base class for all RailMind AI agents."""

    agent_type: str = 'base'
    description: str = 'Base agent'

    def __init__(self, agent_db_id: int = None, name: str = None):
        self.agent_db_id = agent_db_id
        self.name = name or self.__class__.__name__
        self._llm = OpenRouterClient()
        self._model = ModelRouter.get_model(self.agent_type)
        self._temperature = ModelRouter.get_temperature(self.agent_type)

    def _query_llm(self, prompt: str, max_tokens: int = 400) -> dict:
        """Send a prompt to the LLM, stream chunks via WS, and return the final result."""
        full_response = ""
        try:
            for chunk_data in self._llm.query_stream(
                prompt=prompt,
                model=self._model,
                temperature=self._temperature,
                max_tokens=max_tokens,
            ):
                if "error" in chunk_data:
                    logger.error(f"LLM Stream error: {chunk_data['error']}")
                    if not full_response:
                        return {"response": None, "error": chunk_data["error"]}
                    break
                
                chunk = chunk_data.get("chunk", "")
                if chunk:
                    full_response += chunk
                    # Emit stream chunk to the frontend
                    self._emit_stream_chunk(chunk)
            
            return {"response": full_response, "error": None}
        except Exception as e:
            logger.error(f"Error in _query_llm: {e}")
            return {"response": full_response if full_response else None, "error": str(e)}

    def _emit_stream_chunk(self, chunk: str):
        """Emit a stream chunk to the /agent_graph namespace."""
        try:
            evt = AgentEventEmitter.format_event(
                event_type="agent_stream_chunk",
                from_agent=self.name,
                to_agent="",
                message={"chunk": chunk}
            )
            broadcast_graph_event(evt)
        except Exception as e:
            logger.warning(f"Failed to emit stream chunk: {e}")

    def _fallback_response(self, event) -> str:
        """Deterministic fallback when LLM is unavailable."""
        severity_actions = {
            'critical': f'CRITICAL ALERT: Immediate intervention required for {event.event_type}. '
                        f'Deploy emergency response team. Affected passengers: {event.affected_passengers:,}. '
                        f'Estimated delay: {event.estimated_delay_minutes} min.',
            'high':     f'HIGH PRIORITY: {event.event_type.replace("_", " ").title()} detected. '
                        f'Dispatch maintenance crew. {event.affected_passengers:,} passengers affected.',
            'medium':   f'MEDIUM alert: {event.event_type.replace("_", " ").title()} — '
                        f'Monitor and escalate if unresolved within 30 min.',
            'low':      f'LOW priority notice: {event.event_type.replace("_", " ").title()} logged. '
                        f'Schedule routine inspection.',
        }
        return severity_actions.get(event.severity, f'Event {event.event_type} acknowledged by {self.name}.')

    def _build_event_context(self, event, prior_analyses: list = None) -> str:
        """Build a context string describing the event for LLM prompts."""
        ctx = (
            f"Event ID: {event.id}\n"
            f"Type: {event.event_type}\n"
            f"Severity: {event.severity}\n"
            f"Status: {event.status}\n"
            f"Description: {event.description or 'N/A'}\n"
            f"Affected passengers: {event.affected_passengers:,}\n"
            f"Estimated delay: {event.estimated_delay_minutes} minutes\n"
            f"Created at: {event.created_at.isoformat() if event.created_at else 'N/A'}\n"
        )
        if prior_analyses:
            ctx += "\n--- Prior Agent Analyses ---\n"
            for analysis in prior_analyses[-3:]:  # last 3 to keep context short
                ctx += f"[{analysis.get('agent', 'agent')}]: {analysis.get('summary', '')}\n"
        return ctx

    def process_event(self, event, prior_analyses: list = None) -> dict:
        """Override in subclasses to implement agent-specific logic."""
        raise NotImplementedError(f"{self.__class__.__name__} must implement process_event()")

    def _save_message(self, event_id: int, content: str,
                      reasoning: str = None, confidence: float = 0.8):
        """Persist an AgentMessage to the database."""
        try:
            from app.models import AgentMessage
            if self.agent_db_id:
                message = AgentMessage(
                    agent_id=self.agent_db_id,
                    event_id=event_id,
                    message_type=self.agent_type,
                    content=content,
                    reasoning=reasoning,
                    confidence=confidence,
                )
                db.session.add(message)
                db.session.commit()
                return message
        except Exception as e:
            logger.warning(f"Failed to save agent message: {e}")
            try:
                db.session.rollback()
            except:
                pass
        return None

    def _update_agent_stats(self, confidence: float):
        """Update total_decisions and avg_confidence in the DB agent record."""
        try:
            from app.models import Agent
            if self.agent_db_id:
                agent = Agent.query.get(self.agent_db_id)
                if agent:
                    agent.total_decisions = (agent.total_decisions or 0) + 1
                    # Running average
                    n = agent.total_decisions
                    prev_avg = agent.avg_confidence or 0.0
                    agent.avg_confidence = round(prev_avg + (confidence - prev_avg) / n, 4)
                    agent.success_rate = min(1.0, round(agent.avg_confidence * 1.05, 4))
                    agent.status = 'idle'
                    agent.updated_at = datetime.utcnow()
                    db.session.commit()
                    
                    # Emit agent end event to graph
                    evt = AgentEventEmitter.format_event(
                        event_type="agent_completed",
                        from_agent=self.name,
                        to_agent="",
                        message={}
                    )
                    broadcast_graph_event(evt)
                    
                    # Broadcast status to /agents for dashboard
                    try:
                        from app.core.app import socketio
                        socketio.emit('agent_status', {'id': self.agent_db_id, 'status': 'idle'}, namespace='/agents')
                    except Exception as e:
                        logger.warning(f"Failed to broadcast agent_status: {e}")
        except Exception as e:
            logger.warning(f"Failed to update agent stats: {e}")
            try:
                db.session.rollback()
            except:
                pass

    def _set_agent_status(self, status: str):
        """Update agent status in the DB."""
        try:
            from app.models import Agent
            if self.agent_db_id:
                agent = Agent.query.get(self.agent_db_id)
                if agent:
                    agent.status = status
                    agent.updated_at = datetime.utcnow()
                    db.session.commit()
                    
                    # Emit agent start if processing
                    if status == 'processing':
                        evt = AgentEventEmitter.format_event(
                            event_type="agent_started",
                            from_agent=self.name,
                            to_agent="",
                            message={}
                        )
                        broadcast_graph_event(evt)
                        
                    # Broadcast status to /agents for dashboard
                    try:
                        from app.core.app import socketio
                        socketio.emit('agent_status', {'id': self.agent_db_id, 'status': status}, namespace='/agents')
                    except Exception as e:
                        logger.warning(f"Failed to broadcast agent_status: {e}")
        except Exception as e:
            logger.warning(f"Failed to update agent status: {e}")
            try:
                db.session.rollback()
            except:
                pass

    def _broadcast(self, event_id: int, content: str, confidence: float):
        """Emit agent message to Socket.IO /agents namespace."""
        try:
            from app.core.app import socketio
            socketio.emit('agent_message', {
                'agent_id': self.agent_db_id,
                'agent_name': self.name,
                'agent_type': self.agent_type,
                'event_id': event_id,
                'message_type': self.agent_type,
                'content': content,
                'confidence': confidence,
                'created_at': datetime.utcnow().isoformat(),
            }, namespace='/agents')

            # Emit structured graph event
            import json
            reasoning_data = {}
            try:
                # Often content contains JSON if generated by LLM structure
                # Let's try to extract structured info or just pass it as summary
                # Since the actual implementation of specific agents might pass raw text or json string
                if content.strip().startswith('{') or content.strip().startswith('['):
                    parsed = json.loads(content)
                    if isinstance(parsed, dict):
                        reasoning_data = parsed
            except:
                pass
            
            if not reasoning_data:
                reasoning_data = {"summary": content, "confidence": confidence}
            
            evt = AgentEventEmitter.format_event(
                event_type="agent_message_sent",
                from_agent=self.name,
                to_agent="System", # Could be dynamic if extracted from context
                message=reasoning_data
            )
            broadcast_graph_event(evt)
        except Exception as e:
            logger.warning(f"Failed to broadcast agent message: {e}")
