class ScenarioManager:
    """Manages simulation scenarios"""
    
    SCENARIOS = [
        'track_defect',
        'signal_failure',
        'flood',
        'fire',
        'congestion',
        'maintenance_shutdown',
        'bridge_failure',
        'ohe_failure',
        'crew_shortage'
    ]
    
    def __init__(self):
        self.active_scenarios = {}
    
    def create_scenario(self, scenario_type, parameters=None):
        """Create scenario"""
        if scenario_type not in self.SCENARIOS:
            raise ValueError(f"Unknown scenario: {scenario_type}")
        
        return {
            "type": scenario_type,
            "parameters": parameters or {},
            "status": "created",
            "created_at": str(__import__('datetime').datetime.utcnow())
        }
    
    def simulate(self, scenario):
        """Run simulation"""
        return {
            "scenario": scenario,
            "results": {
                "affected_trains": 3,
                "delay_estimate": 90,
                "impact_score": 0.75,
                "passenger_impact": 1500
            },
            "status": "completed"
        }
    
    def get_scenario(self, scenario_id):
        """Get scenario"""
        return self.active_scenarios.get(scenario_id)
