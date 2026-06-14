class TimelineBuilder:
    """Builds incident timeline"""
    
    def build_timeline(self, incident_id):
        """Build timeline"""
        return {
            "incident_id": incident_id,
            "events": [],
            "decisions": [],
            "timeline": [],
            "status": "built"
        }
    
    def add_event(self, timeline, event):
        """Add event"""
        timeline["events"].append(event)
        return timeline
    
    def generate_narrative(self, timeline):
        """Generate narrative"""
        return f"Timeline with {len(timeline['events'])} events and {len(timeline['decisions'])} decisions"
