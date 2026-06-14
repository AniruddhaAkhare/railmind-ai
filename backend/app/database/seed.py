"""
Seed the database with realistic Indian Railway synthetic data.
Called once at app startup when the tables are empty.
"""
import random
from datetime import datetime, timedelta
from app.config.database import db
from app.utils.constants import EVENT_TYPES, SEVERITY_LEVELS


# ---------------------------------------------------------------------------
# Station / geography data
# ---------------------------------------------------------------------------
STATION_DATA = [
    ('Mumbai CST',       'CSTM', 18.9398, 72.8354, 'Maharashtra',    'Western',     'CR'),
    ('New Delhi',        'NDLS', 28.6420, 77.2197, 'Delhi',           'Northern',    'NR'),
    ('Howrah',           'HWH',  22.5833, 88.3422, 'West Bengal',     'Eastern',     'ER'),
    ('Chennai Central',  'MAS',  13.0827, 80.2707, 'Tamil Nadu',      'Southern',    'SR'),
    ('Bengaluru City',   'SBC',  12.9784, 77.5733, 'Karnataka',       'South Western','SWR'),
    ('Secunderabad',     'SC',   17.4399, 78.4983, 'Telangana',       'South Central','SCR'),
    ('Ahmedabad',        'ADI',  23.0225, 72.5714, 'Gujarat',         'Western',     'WR'),
    ('Pune Junction',    'PUNE', 18.5204, 73.8567, 'Maharashtra',     'Central',     'CR'),
    ('Jaipur Junction',  'JP',   26.9124, 75.7873, 'Rajasthan',       'Northern',    'NWR'),
    ('Lucknow',          'LKO',  26.8467, 80.9462, 'Uttar Pradesh',   'Northern',    'NR'),
    ('Patna Junction',   'PNBE', 25.6093, 85.1376, 'Bihar',           'Eastern',     'ECR'),
    ('Bhopal Junction',  'BPL',  23.2599, 77.4126, 'Madhya Pradesh',  'West Central','WCR'),
    ('Nagpur Junction',  'NGP',  21.0921, 79.0777, 'Maharashtra',     'Central',     'CR'),
    ('Vijayawada',       'BZA',  16.5193, 80.6305, 'Andhra Pradesh',  'South Central','SCR'),
    ('Kanpur Central',   'CNB',  26.4499, 80.3319, 'Uttar Pradesh',   'Northern',    'NCR'),
]

# ---------------------------------------------------------------------------
# Event description templates
# ---------------------------------------------------------------------------
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
    'platform_overcrowding': [
        'Platform 1 overcrowded — crowd control deployed',
        'Passengers spilling onto tracks at peak-hour rush',
    ],
    'maintenance_alert': [
        'Scheduled maintenance overdue for signal relay room',
        'Overhead traction equipment inspection pending',
    ],
    'ohe_failure': [
        'Overhead equipment wire broken — block section closed',
        'Pantograph damage reported by loco pilot',
    ],
    'level_crossing_violation': [
        'Vehicle stuck on level crossing — gate failure',
        'Unmanned LC violation by heavy vehicle',
    ],
    'trespassing': [
        'Trespasser on railway track near station yard',
        'Unauthorised persons on track — patrolling dispatched',
    ],
    'bridge_risk': [
        'Bridge inspection shows cracks in girder',
        'Flood sensor alert near bridge foundation',
    ],
}

STATUS_WEIGHTS = ['open', 'open', 'open', 'acknowledged', 'in_progress', 'resolved']


def _rand_event_desc(event_type: str) -> str:
    descs = EVENT_DESCRIPTIONS.get(
        event_type,
        [f'{event_type.replace("_", " ").title()} incident detected']
    )
    return random.choice(descs)


def seed_all(app):
    """Seed all tables if they are empty. Safe to call multiple times."""
    with app.app_context():
        from app.models import Station, Platform, Train, Route, Event

        if Station.query.count() > 0:
            app.logger.info('Seed: data already present, skipping.')
            return

        app.logger.info('Seeding database with synthetic Indian Railway data...')

        # ----------------------------------------------------------------
        # 1. Stations + Platforms
        # ----------------------------------------------------------------
        station_objs = []
        for name, code, lat, lon, state, region, zone in STATION_DATA:
            plat_count = random.randint(4, 24)
            s = Station(
                name=name,
                code=code,
                latitude=lat,
                longitude=lon,
                state=state,
                region=region,
                zone=zone,
                platform_count=plat_count,
                max_capacity=plat_count * random.randint(800, 2000),
                current_crowd=random.randint(200, plat_count * 600),
                is_active=True,
            )
            db.session.add(s)
            station_objs.append((s, plat_count))

        db.session.flush()  # get IDs

        for s, plat_count in station_objs:
            for i in range(1, plat_count + 1):
                max_cap = random.randint(500, 2000)
                p = Platform(
                    station_id=s.id,
                    platform_number=str(i),
                    length=round(random.uniform(150, 700), 1),
                    max_capacity=max_cap,
                    current_passengers=random.randint(0, max_cap // 2),
                    status=random.choice(['operational', 'operational', 'operational', 'maintenance']),
                )
                db.session.add(p)

        # ----------------------------------------------------------------
        # 2. Routes (connect pairs of stations)
        # ----------------------------------------------------------------
        route_objs = []
        pairs = [
            (0, 1), (1, 2), (2, 3), (3, 4), (4, 5),
            (0, 7), (1, 9), (2, 10), (5, 13), (6, 1),
        ]
        station_ids = [s.id for s, _ in station_objs]
        station_names = [name for name, *_ in STATION_DATA]
        for src_idx, dst_idx in pairs:
            dist = round(random.uniform(200, 2000), 1)
            r = Route(
                name=f'{station_names[src_idx]} — {station_names[dst_idx]} Express',
                source_station_id=station_ids[src_idx],
                destination_station_id=station_ids[dst_idx],
                distance_km=dist,
                estimated_time_hours=round(dist / random.uniform(60, 110), 2),
                status=random.choice(['operational', 'operational', 'operational', 'under_maintenance']),
                congestion_level=random.choice(['low', 'low', 'medium', 'high']),
            )
            db.session.add(r)
            route_objs.append(r)

        db.session.flush()

        # ----------------------------------------------------------------
        # 3. Trains
        # ----------------------------------------------------------------
        train_types = ['Rajdhani', 'Shatabdi', 'Duronto', 'Express', 'Mail',
                       'Passenger', 'Humsafar', 'Tejas', 'Jan Shatabdi', 'Superfast']
        statuses = ['running', 'running', 'running', 'delayed', 'stopped', 'maintenance']
        used_numbers = set()
        route_ids = [r.id for r in route_objs]

        for _ in range(25):
            while True:
                num = str(random.randint(10001, 99999))
                if num not in used_numbers:
                    used_numbers.add(num)
                    break
            train_type = random.choice(train_types)
            status = random.choice(statuses)
            delay = random.randint(5, 90) if status == 'delayed' else 0
            st = random.choice(station_objs)[0]
            t = Train(
                train_number=num,
                train_name=f'{train_type} {random.randint(100, 999)}',
                train_type=train_type,
                route_id=random.choice(route_ids) if route_ids else None,
                current_station_id=st.id,
                latitude=st.latitude + random.uniform(-0.5, 0.5),
                longitude=st.longitude + random.uniform(-0.5, 0.5),
                current_speed=random.uniform(0, 130) if status == 'running' else 0,
                max_capacity=random.choice([700, 1000, 1200, 1500, 2000]),
                current_passengers=random.randint(100, 1800),
                health_score=round(random.uniform(0.65, 1.0), 3),
                status=status,
                delay_minutes=delay,
                last_location_update=datetime.utcnow() - timedelta(minutes=random.randint(1, 30)),
            )
            db.session.add(t)

        db.session.flush()

        # ----------------------------------------------------------------
        # 4. Events (mix of open, in_progress, resolved)
        # ----------------------------------------------------------------
        severity_passenger = {
            'low':      (0, 100),
            'medium':   (100, 1000),
            'high':     (1000, 10000),
            'critical': (10000, 100000),
        }
        severity_delay = {
            'low':      (5, 30),
            'medium':   (30, 120),
            'high':     (60, 300),
            'critical': (120, 600),
        }

        for i in range(40):
            etype = random.choice(EVENT_TYPES)
            severity = random.choices(
                SEVERITY_LEVELS,
                weights=[40, 35, 20, 5],
                k=1
            )[0]
            status = random.choice(STATUS_WEIGHTS)
            created_offset = timedelta(hours=random.randint(0, 72))
            created_at = datetime.utcnow() - created_offset
            resolved_at = None
            if status == 'resolved':
                resolved_at = created_at + timedelta(minutes=random.randint(30, 300))

            min_p, max_p = severity_passenger[severity]
            min_d, max_d = severity_delay[severity]

            e = Event(
                event_type=etype,
                severity=severity,
                priority=({'low': 8, 'medium': 5, 'high': 3, 'critical': 1}[severity]),
                status=status,
                description=_rand_event_desc(etype),
                station_id=random.choice(station_ids),
                affected_passengers=random.randint(min_p, max_p),
                estimated_delay_minutes=random.randint(min_d, max_d),
                event_metadata={'source': 'seed', 'generated_at': datetime.utcnow().isoformat()},
                created_at=created_at,
                resolved_at=resolved_at,
            )
            db.session.add(e)

        db.session.commit()
        app.logger.info(
            f'Seed complete: {len(STATION_DATA)} stations, 25 trains, {len(pairs)} routes, 40 events.'
        )
