class NetworkPropagation:
    """Propagates pulse through network"""
    
    def propagate(self, pulse, network=None):
        """Propagate pulse"""
        return {
            "pulse": pulse,
            "affected_nodes": {
                "trains": 3,
                "stations": 5,
                "routes": 2,
                "assets": 8
            },
            "propagation_time": 0.1,
            "wave_status": "active"
        }
    
    def calculate_affected_zones(self, pulse):
        """Calculate affected zones"""
        return {
            "primary_zone": f"{pulse.get('radius_km', 50)}km radius",
            "secondary_zone": f"{pulse.get('radius_km', 50) * 1.5}km radius",
            "affected_stations": 5,
            "total_impact": "Significant"
        }
