import threading
import time
import logging

logger = logging.getLogger(__name__)

class EventStreamer:
    """
    Standalone background daemon responsible for streaming real-time visualization events.
    It doesn't interfere with the main Flask/SocketIO event loop or LangGraph execution.
    """
    def __init__(self):
        self._running = False
        self._thread = None

    def start(self):
        if not self._running:
            self._running = True
            self._thread = threading.Thread(target=self._stream_loop, daemon=True, name="event-streamer-daemon")
            self._thread.start()
            logger.info("EventStreamer daemon started.")

    def stop(self):
        self._running = False
        if self._thread:
            self._thread.join(timeout=2)

    def _stream_loop(self):
        """
        Background loop for handling delayed/batched real-time emissions if needed.
        Currently acts as a placeholder to keep the streaming architecture decoupled.
        """
        while self._running:
            time.sleep(1)

event_streamer = EventStreamer()

def broadcast_graph_event(event_data: dict):
    """
    Helper function to broadcast events to the frontend visualization via the gateway.
    Uses socketio.emit() directly from the app instance for thread-safe broadcasting.
    """
    try:
        from app.core.app import socketio
        socketio.emit('graph_event', event_data, namespace='/agent_graph')
    except Exception as e:
        logger.error(f"Failed to broadcast graph event: {e}")
