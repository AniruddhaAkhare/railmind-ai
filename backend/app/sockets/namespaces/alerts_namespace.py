from flask import request
from flask_socketio import Namespace, emit

class AlertsNamespace(Namespace):
    """Socket.IO alerts namespace"""

    def on_connect(self, auth=None):
        print(f"Alert client connected: {request.sid}")
        emit('connect_response', {'data': 'Connected to alerts'})

    def on_disconnect(self):
        print(f"Alert client disconnected: {request.sid}")

    def on_alert(self, data):
        emit('alert_received', data, broadcast=True)

alerts_ns = AlertsNamespace('/alerts')