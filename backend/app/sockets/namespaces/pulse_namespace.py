from flask import request
from flask_socketio import Namespace, emit

class PulseNamespace(Namespace):
    """Socket.IO pulse namespace"""

    def on_connect(self, auth=None):
        print(f"Pulse client connected: {request.sid}")
        emit('connect_response', {'data': 'Connected to pulse'})

    def on_disconnect(self):
        print(f"Pulse client disconnected: {request.sid}")

    def on_pulse_wave(self, data):
        emit('pulse_wave_update', data, broadcast=True)

pulse_ns = PulseNamespace('/pulse')