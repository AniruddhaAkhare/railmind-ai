"""Synthetic event generator for Indian Railway scenarios."""
import random
from datetime import datetime
from app.utils.constants import EVENT_TYPES, SEVERITY_LEVELS


class EventGenerator:
    """Generates realistic synthetic railway event data for testing."""

    # Major Indian Railway stations with coordinates
    STATIONS = [
        ('Mumbai CST', 'CSTM', 18.9398, 72.8354, 'Maharashtra', 'Western', 'CR'),
        ('New Delhi', 'NDLS', 28.6420, 77.2197, 'Delhi', 'Northern', 'NR'),
        ('Howrah', 'HWH', 22.5833, 88.3422, 'West Bengal', 'Eastern', 'ER'),
        ('Chennai Central', 'MAS', 13.0827, 80.2707, 'Tamil Nadu', 'Southern', 'SR'),
        ('Bengaluru City', 'SBC', 12.9784, 77.5733, 'Karnataka', 'South Western', 'SWR'),
        ('Secunderabad', 'SC', 17.4399, 78.4983, 'Telangana', 'South Central', 'SCR'),
        ('Ahmedabad', 'ADI', 23.0225, 72.5714, 'Gujarat', 'Western', 'WR'),
        ('Pune', 'PUNE', 18.5204, 73.8567, 'Maharashtra', 'Central', 'CR'),
        ('Jaipur', 'JP', 26.9124, 75.7873, 'Rajasthan', 'Northern', 'NWR'),
        ('Lucknow', 'LKO', 26.8467, 80.9462, 'Uttar Pradesh', 'Northern', 'NR'),
        ('Patna', 'PNBE', 25.6093, 85.1376, 'Bihar', 'Eastern', 'ECR'),
        ('Bhopal', 'BPL', 23.2599, 77.4126, 'Madhya Pradesh', 'West Central', 'WCR'),
        ('Nagpur', 'NGP', 21.0921, 79.0777, 'Maharashtra', 'Central', 'CR'),
        ('Vijayawada', 'BZA', 16.5193, 80.6305, 'Andhra Pradesh', 'South Central', 'SCR'),
        ('Kanpur Central', 'CNB', 26.4499, 80.3319, 'Uttar Pradesh', 'Northern', 'NCR'),
    ]

    EVENT_DESCRIPTIONS = {
        'track_defect': [
            'Deep groove detected on running rail at km marker',
            'Fish-plate joint crack observed during patrol',
            'Rail fracture detected by ultrasonic testing',
            'Defective sleeper replacement required',
            'Rail creep exceeding permissible limit',
        ],
        'signal_failure': [
            'Colour light signal showing wrong aspect',
            'Point machine failure at trailing point',
            'Track circuit failure causing signal obstruction',
            'Signal cable cut by miscreants',
            'Power supply failure to signal box',
        ],
        'fire': [
            'Fire reported in coach of passenger train',
            'Vegetation fire near track causing visibility issues',
            'Electrical short circuit in traction motor',
            'Fire in station building — evacuation in progress',
        ],
        'flood': [
            'Flash flood across track reported by train crew',
            'Waterlogging on track due to heavy rainfall',
            'Bridge pier scouring reported by watchman',
            'Road-Rail overpass submerged due to flooding',
        ],
        'congestion': [
            'Heavy passenger rush on platform — overcrowding',
            'Train held at station for platform clearance',
            'Multiple trains running late causing bunching',
        ],
        'train_delay': [
            'Engine failure causing train detention',
            'Loco pilot on duty hours — relief loco pilot required',
            'Technical examination delay at originating station',
        ],
        'emergency_incident': [
            'Passenger reported serious medical emergency on train',
            'Unattended object found in coach — security concern',
            'Passenger fallen on track — emergency brake applied',
        ],
    }

    @staticmethod
    def generate_event(station_id: int = None, event_type: str = None) -> dict:
        """Generate a single synthetic event."""
        if event_type is None:
            event_type = random.choice(EVENT_TYPES)

        severity = random.choices(
            SEVERITY_LEVELS,
            weights=[40, 35, 20, 5],  # low, medium, high, critical
            k=1
        )[0]

        descriptions = EventGenerator.EVENT_DESCRIPTIONS.get(
            event_type,
            [f'{event_type.replace("_", " ").title()} incident detected']
        )

        severity_passengers = {
            'low': (0, 100),
            'medium': (100, 1000),
            'high': (1000, 10000),
            'critical': (10000, 100000),
        }
        min_p, max_p = severity_passengers[severity]

        severity_delay = {
            'low': (5, 30),
            'medium': (30, 120),
            'high': (60, 300),
            'critical': (120, 600),
        }
        min_d, max_d = severity_delay[severity]

        return {
            'event_type': event_type,
            'severity': severity,
            'description': random.choice(descriptions),
            'station_id': station_id,
            'affected_passengers': random.randint(min_p, max_p),
            'estimated_delay_minutes': random.randint(min_d, max_d),
            'event_metadata': {
                'source': 'synthetic_generator',
                'generated_at': datetime.utcnow().isoformat(),
            },
        }

    @staticmethod
    def generate_batch(count: int = 10) -> list:
        """Generate a batch of synthetic events."""
        return [EventGenerator.generate_event() for _ in range(count)]
