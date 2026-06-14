class PulseGenerator:
    """Generates pulse waves from events"""
    
    def generate_pulse(self, event):
        """Generate pulse"""
        severity_intensity = {
            "low": 0.2,
            "medium": 0.5,
            "high": 0.8,
            "critical": 1.0
        }
        
        return {
            "event_id": event.id if hasattr(event, 'id') else 0,
            "event_type": event.event_type if hasattr(event, 'event_type') else "",
            "severity": event.severity if hasattr(event, 'severity') else "",
            "intensity": severity_intensity.get(getattr(event, 'severity', 'medium'), 0.5),
            "radius_km": 50,
            "timestamp": str(__import__('datetime').datetime.utcnow()),
            "propagation_velocity": "Real-time"
        }
