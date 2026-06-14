from flask_socketio import Namespace
import logging

logger = logging.getLogger(__name__)

class AgentGraphGateway(Namespace):
    """
    WebSocket gateway dedicated to streaming high-throughput React Flow agent events.
    This separates the agent network visualization traffic from the standard event/sensor traffic.
    """
    def on_connect(self):
        logger.info("Agent Graph Gateway connected.")
        pass

    def on_disconnect(self):
        logger.info("Agent Graph Gateway disconnected.")
        pass

# Instance to be imported and used by the streamer
agent_graph_gateway = AgentGraphGateway('/agent_graph')
