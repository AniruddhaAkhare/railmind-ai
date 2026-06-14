from datetime import datetime

class StateManager:
    """Manages digital twin states"""
    
    def __init__(self):
        self.states = {}
        self.current_state = None
    
    def create_snapshot(self, state_data):
        """Create state snapshot"""
        snapshot = {
            "timestamp": datetime.utcnow().isoformat(),
            "state_data": state_data,
            "trains": state_data.get("trains", []),
            "stations": state_data.get("stations", []),
            "routes": state_data.get("routes", [])
        }
        return snapshot
    
    def get_current_state(self):
        """Get current state"""
        return self.current_state
    
    def update_state(self, state_data):
        """Update state"""
        self.current_state = self.create_snapshot(state_data)
        return self.current_state
    
    def save_historical_state(self, state_id, state_data):
        """Save historical state"""
        self.states[state_id] = self.create_snapshot(state_data)
        return state_id
