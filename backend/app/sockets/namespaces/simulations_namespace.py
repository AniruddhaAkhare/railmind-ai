from flask import request
from flask_socketio import Namespace, emit

class SimulationsNamespace(Namespace):
    """Socket.IO simulations namespace"""

    def on_connect(self, auth=None):
        print(f"Simulation client connected: {request.sid}")
        emit('connect_response', {'data': 'Connected to simulations'})

    def on_disconnect(self):
        print(f"Simulation client disconnected: {request.sid}")

    def on_simulation_update(self, data):
        emit('simulation_updated', data, broadcast=True)

simulations_ns = SimulationsNamespace('/simulations')