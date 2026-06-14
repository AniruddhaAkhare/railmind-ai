"""Synthetic station data generator for Indian Railway scenarios."""
import random
from app.synthetic_data.generators.event_generator import EventGenerator


class StationGenerator:
    """Generates synthetic station and platform data."""

    @staticmethod
    def generate_stations() -> list:
        """Return a list of station dicts for seeding the database."""
        stations = []
        for name, code, lat, lon, state, region, zone in EventGenerator.STATIONS:
            platform_count = random.randint(2, 24)
            stations.append({
                'name': name,
                'code': code,
                'latitude': lat,
                'longitude': lon,
                'state': state,
                'region': region,
                'zone': zone,
                'platform_count': platform_count,
                'max_capacity': platform_count * random.randint(500, 2000),
                'current_crowd': random.randint(0, platform_count * 500),
                'is_active': True,
            })
        return stations

    @staticmethod
    def generate_platforms(station_id: int, count: int) -> list:
        """Generate platform records for a station."""
        platforms = []
        statuses = ['operational', 'operational', 'operational', 'maintenance']
        for i in range(1, count + 1):
            max_cap = random.randint(500, 2000)
            platforms.append({
                'station_id': station_id,
                'platform_number': str(i),
                'length': round(random.uniform(150, 700), 1),
                'max_capacity': max_cap,
                'current_passengers': random.randint(0, max_cap // 2),
                'status': random.choice(statuses),
            })
        return platforms

    @staticmethod
    def generate_trains(count: int = 20) -> list:
        """Generate synthetic train records."""
        train_types = ['Express', 'Superfast', 'Mail', 'Passenger', 'Rajdhani',
                       'Shatabdi', 'Jan Shatabdi', 'Duronto', 'Humsafar', 'Tejas']
        statuses = ['running', 'running', 'running', 'delayed', 'stopped']
        trains = []
        used_numbers = set()

        for _ in range(count):
            while True:
                number = str(random.randint(10000, 99999))
                if number not in used_numbers:
                    used_numbers.add(number)
                    break

            train_type = random.choice(train_types)
            trains.append({
                'train_number': number,
                'train_name': f"{random.choice(['Rajdhani', 'Shatabdi', 'Express', 'Mail', 'Duronto'])} "
                              f"{random.randint(100, 999)}",
                'train_type': train_type,
                'max_capacity': random.choice([700, 1000, 1200, 1500, 2000]),
                'current_passengers': random.randint(100, 1800),
                'current_speed': random.uniform(0, 130),
                'health_score': round(random.uniform(0.7, 1.0), 3),
                'status': random.choice(statuses),
                'delay_minutes': random.randint(0, 60) if random.random() < 0.3 else 0,
            })
        return trains
