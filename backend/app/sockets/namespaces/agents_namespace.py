from flask import request
from flask_socketio import Namespace, emit

class AgentsNamespace(Namespace):
    """Socket.IO agents namespace"""

    def on_connect(self, auth=None):
        print(f"Agent client connected: {request.sid}")
        emit('connect_response', {'data': 'Connected to agents'})

    def on_disconnect(self):
        print(f"Agent client disconnected: {request.sid}")

    def on_agent_message(self, data):
        emit('agent_message', data, broadcast=True)

    def on_agent_decision(self, data):
        emit('agent_decision', data, broadcast=True)

agents_ns = AgentsNamespace('/agents')