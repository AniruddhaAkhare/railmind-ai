from flask import request
from flask_socketio import Namespace, emit, join_room, leave_room

class EventsNamespace(Namespace):
    """Socket.IO events namespace"""

    def on_connect(self, auth=None):
        print(f"Client connected: {request.sid}")
        emit('connect_response', {'data': 'Connected to events'})

    def on_disconnect(self):
        print(f"Client disconnected: {request.sid}")

    def on_subscribe_event(self, data):
        event_id = data.get('event_id')
        join_room(f"event_{event_id}")
        emit('subscribed', {'event_id': event_id})

    def on_unsubscribe_event(self, data):
        event_id = data.get('event_id')
        leave_room(f"event_{event_id}")
        emit('unsubscribed', {'event_id': event_id})

events_ns = EventsNamespace('/events')
