import logging
import time
from datetime import datetime
from typing import TypedDict, List, Dict, Any, Optional
from langgraph.graph import StateGraph, END
from app.models import Event, Agent
from app.config.database import db
from agent_event_emitter import AgentEventEmitter
from event_streamer import broadcast_graph_event

logger = logging.getLogger(__name__)

class AgentState(TypedDict):
    event_id: int
    prior_analyses: List[Dict[str, Any]]
    current_agent: str
    status: str
    domain_agents: List[str]

def create_agent_node(agent_type: str, AgentClass):
    """Creates a LangGraph node function for a specific agent."""
    def node(state: AgentState):
        db_agent = None
        try:
            # Get a fresh session for this thread to avoid thread-safety issues
            db.session.remove()
            
            db_agent = Agent.query.filter_by(agent_type=agent_type).first()
            if not db_agent:
                return state
            
            db_agent.status = 'processing'
            db.session.commit()
            
            agent_instance = AgentClass(
                agent_db_id=db_agent.id,
                name=db_agent.name,
            )
            
            start_time = datetime.utcnow()
            
            # process_event handles the streaming and emitting agent_started, agent_completed
            result = agent_instance.process_event(Event.query.get(state["event_id"]), state["prior_analyses"])
            
            end_time = datetime.utcnow()
            duration_ms = int((end_time - start_time).total_seconds() * 1000)
            
            from app.models import AgentExecutionTrace
            import uuid
            
            trace = AgentExecutionTrace(
                execution_id=str(uuid.uuid4()),
                workflow_id=f"wf_{state['event_id']}",
                event_id=state["event_id"],
                agent_name=agent_type,
                start_time=start_time,
                end_time=end_time,
                duration_ms=duration_ms,
                input_state={"prior_analyses": state["prior_analyses"]},
                output_state={"result": str(result)},
                confidence=result.get("confidence", 0.0)
            )
            db.session.add(trace)
            db.session.commit()
            
            summary = (result.get('response') or
                       result.get('safety_assessment') or
                       result.get('emergency_response') or
                       result.get('decision') or
                       str(result))[:300]
            
            state["prior_analyses"].append({'agent': agent_type, 'summary': summary})
            state["current_agent"] = agent_type
            
            # Emit state updated
            evt = AgentEventEmitter.format_event(
                event_type="state_updated",
                from_agent="System",
                to_agent="",
                message={"current_agent": agent_type, "status": "completed"}
            )
            broadcast_graph_event(evt)
            
        except Exception as e:
            logger.error(f"Agent {agent_type} failed: {e}")
            evt = AgentEventEmitter.format_event(
                event_type="agent_failed",
                from_agent=agent_type,
                to_agent="",
                message={"error": str(e)}
            )
            broadcast_graph_event(evt)
            
            try:
                db.session.rollback()
            except:
                pass
            
            if db_agent:
                try:
                    db.session.remove()
                    a = Agent.query.get(db_agent.id)
                    if a:
                        a.status = 'idle'
                        db.session.commit()
                except:
                    try:
                        db.session.rollback()
                    except:
                        pass
        
        return state
    return node

def create_orchestrator_graph(agent_classes: dict, domain_types: list = None):
    """Builds the LangGraph StateGraph with sequential domain agent routing."""
    workflow = StateGraph(AgentState)
    
    # Core nodes
    core_agents = [
        'observation', 'understanding', 'risk', 'impact', 
        'decision', 'coordination', 'communication'
    ]
    
    for atype in core_agents:
        if atype in agent_classes:
            workflow.add_node(atype, create_agent_node(atype, agent_classes[atype]))
            
    # Domain nodes — only add those in domain_types
    active_domain = [dt for dt in (domain_types or []) if dt in agent_classes]
    for atype in active_domain:
        workflow.add_node(atype, create_agent_node(atype, agent_classes[atype]))
            
    # Add sequential edges for core agents
    for i in range(len(core_agents) - 1):
        if core_agents[i] in agent_classes and core_agents[i+1] in agent_classes:
            workflow.add_edge(core_agents[i], core_agents[i+1])
            
    # Chain domain agents SEQUENTIALLY after communication
    if active_domain:
        # communication → first domain agent
        workflow.add_edge('communication', active_domain[0])
        
        # Chain domain agents sequentially: domain[0] → domain[1] → ... → END
        for i in range(len(active_domain) - 1):
            workflow.add_edge(active_domain[i], active_domain[i+1])
        
        # Last domain agent → END
        workflow.add_edge(active_domain[-1], END)
    else:
        # No domain agents: communication → END
        workflow.add_edge('communication', END)
            
    workflow.set_entry_point('observation')
    
    return workflow.compile()

def run_orchestrator(app, event_id: int, agent_classes: dict, domain_types: list):
    """Executes the graph."""
    with app.app_context():
        try:
            logger.info(f"Starting LangGraph orchestrator for event {event_id}")
            graph = create_orchestrator_graph(agent_classes, domain_types=domain_types)
            
            initial_state = {
                "event_id": event_id,
                "prior_analyses": [],
                "current_agent": "",
                "status": "started",
                "domain_agents": domain_types
            }
            
            # Execute graph synchronously
            graph.invoke(initial_state)
            
            # Emit workflow completed
            evt = AgentEventEmitter.format_event(
                event_type="workflow_completed",
                from_agent="System",
                to_agent="",
                message={"status": "completed"}
            )
            broadcast_graph_event(evt)
            logger.info(f"LangGraph orchestrator completed for event {event_id}")
            
        except Exception as e:
            logger.error(f"Orchestrator failed for event {event_id}: {e}")
