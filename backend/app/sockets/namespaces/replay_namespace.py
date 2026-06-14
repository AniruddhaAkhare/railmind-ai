from flask import request
from flask_socketio import Namespace, emit

class ReplayNamespace(Namespace):
    """Socket.IO replay namespace"""

    def on_connect(self, auth=None):
        print(f"Replay client connected: {request.sid}")
        emit('connect_response', {'data': 'Connected to replay'})

    def on_disconnect(self):
        print(f"Replay client disconnected: {request.sid}")

    def on_replay_start(self, data):
        emit('replay_started', data, broadcast=True)

    def on_replay_frame(self, data):
        emit('replay_frame_update', data, broadcast=True)

replay_ns = ReplayNamespace('/replay')