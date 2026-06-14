"""
sensor_stream.py — Real-time sensor data generator for RailMind AI.

Runs as a standalone script alongside the Flask backend.
Every 5 seconds it generates realistic sensor readings for Indian Railway trains/stations
and POSTs them to the backend. Critical readings auto-create Events.

Usage:
    python sensor_stream.py
"""
import sys
import os
import time
import random
import math
import json
import requests
import logging
from datetime import datetime

# ─── Config ─────────────────────────────────────────────────────────────────
API_BASE = "http://localhost:5000/api"
STREAM_INTERVAL = 5   # seconds between sensor pulses
LOG_LEVEL = logging.INFO

logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s [SENSOR] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("sensor_stream")

# ─── Station data ────────────────────────────────────────────────────────────
STATIONS = [
    {"id": 1, "name": "New Delhi",       "lat": 28.6448, "lng": 77.2167, "zone": "NR",  "state": "Delhi"},
    {"id": 2, "name": "Mumbai Central",  "lat": 18.9691, "lng": 72.8194, "zone": "WR",  "state": "Maharashtra"},
    {"id": 3, "name": "Chennai Central", "lat": 13.0827, "lng": 80.2707, "zone": "SR",  "state": "Tamil Nadu"},
    {"id": 4, "name": "Kolkata",         "lat": 22.5726, "lng": 88.3639, "zone": "ER",  "state": "West Bengal"},
    {"id": 5, "name": "Bengaluru City",  "lat": 12.9769, "lng": 77.5714, "zone": "SWR", "state": "Karnataka"},
    {"id": 6, "name": "Hyderabad Deccan","lat": 17.3850, "lng": 78.4867, "zone": "SCR", "state": "Telangana"},
    {"id": 7, "name": "Ahmedabad",       "lat": 23.0225, "lng": 72.5714, "zone": "WR",  "state": "Gujarat"},
    {"id": 8, "name": "Pune Junction",   "lat": 18.5204, "lng": 73.8567, "zone": "CR",  "state": "Maharashtra"},
    {"id": 9, "name": "Jaipur Junction", "lat": 26.9124, "lng": 75.7873, "zone": "NWR", "state": "Rajasthan"},
    {"id": 10, "name": "Lucknow",        "lat": 26.8467, "lng": 80.9462, "zone": "NER", "state": "Uttar Pradesh"},
    {"id": 11, "name": "Bhopal Junction","lat": 23.2599, "lng": 77.4126, "zone": "WCR", "state": "Madhya Pradesh"},
    {"id": 12, "name": "Nagpur Junction","lat": 21.1458, "lng": 79.0882, "zone": "CR",  "state": "Maharashtra"},
    {"id": 13, "name": "Patna Junction", "lat": 25.5941, "lng": 85.1376, "zone": "ECR", "state": "Bihar"},
    {"id": 14, "name": "Bhubaneswar",    "lat": 20.2961, "lng": 85.8195, "zone": "ECoR","state": "Odisha"},
    {"id": 15, "name": "Kochi",          "lat": 9.9312,  "lng": 76.2673, "zone": "SR",  "state": "Kerala"},
    {"id": 16, "name": "Surat",          "lat": 21.1702, "lng": 72.8311, "zone": "WR",  "state": "Gujarat"},
    {"id": 17, "name": "Varanasi",       "lat": 25.3176, "lng": 82.9739, "zone": "NER", "state": "Uttar Pradesh"},
    {"id": 18, "name": "Agra Cantonment","lat": 27.1767, "lng": 78.0081, "zone": "NCR", "state": "Uttar Pradesh"},
    {"id": 19, "name": "Vijayawada",     "lat": 16.5062, "lng": 80.6480, "zone": "SCR", "state": "Andhra Pradesh"},
    {"id": 20, "name": "Guwahati",       "lat": 26.1445, "lng": 91.7362, "zone": "NFR", "state": "Assam"},
    {"id": 21, "name": "Kanpur Central", "lat": 26.4499, "lng": 80.3319, "zone": "NCR", "state": "Uttar Pradesh"},
    {"id": 22, "name": "Prayagraj",      "lat": 25.4358, "lng": 81.8463, "zone": "NCR", "state": "Uttar Pradesh"},
    {"id": 23, "name": "Itarsi Junction","lat": 22.6105, "lng": 77.7601, "zone": "WCR", "state": "Madhya Pradesh"},
    {"id": 24, "name": "Gwalior",        "lat": 26.2124, "lng": 78.1772, "zone": "NCR", "state": "Madhya Pradesh"},
    {"id": 25, "name": "Visakhapatnam",  "lat": 17.6868, "lng": 83.2185, "zone": "ECoR","state": "Andhra Pradesh"},
    {"id": 26, "name": "Indore",         "lat": 22.7196, "lng": 75.8577, "zone": "WR",  "state": "Madhya Pradesh"},
    {"id": 27, "name": "Thiruvananthapuram","lat": 8.5241,"lng": 76.9366, "zone": "SR",  "state": "Kerala"},
    {"id": 28, "name": "Ranchi",         "lat": 23.3441, "lng": 85.3096, "zone": "SER", "state": "Jharkhand"},
    {"id": 29, "name": "Raipur",         "lat": 21.2514, "lng": 81.6296, "zone": "SECR","state": "Chhattisgarh"},
    {"id": 30, "name": "Vadodara",       "lat": 22.3072, "lng": 73.1812, "zone": "WR",  "state": "Gujarat"},
]

TRAIN_NUMBERS = [
    {"no": "12301", "name": "Howrah Rajdhani",    "type": "Rajdhani"},
    {"no": "12951", "name": "Mumbai Rajdhani",     "type": "Rajdhani"},
    {"no": "22691", "name": "Rajdhani Express",    "type": "Rajdhani"},
    {"no": "12259", "name": "Sealdah Duronto",     "type": "Duronto"},
    {"no": "12622", "name": "Tamil Nadu Express",  "type": "Express"},
    {"no": "12001", "name": "Bhopal Shatabdi",     "type": "Shatabdi"},
    {"no": "12050", "name": "Gatimaan Express",    "type": "Gatimaan"},
    {"no": "19031", "name": "Mumbai Haridwar Exp", "type": "Express"},
    {"no": "11057", "name": "Amritsar Express",    "type": "Express"},
    {"no": "12841", "name": "Coromandel Express",  "type": "Superfast"},
]

EVENT_TYPES = [
    "track_defect", "signal_failure", "ohe_failure", "train_delay",
    "platform_overcrowding", "emergency_incident", "trespassing",
    "bridge_risk", "maintenance_alert", "level_crossing_violation",
    "fire", "flood",
]

# ─── Weather patterns per season/state ──────────────────────────────────────
def _get_weather(station: dict) -> dict:
    """Generate realistic weather for a station based on its state."""
    month = datetime.now().month
    state = station.get("state", "")

    # Monsoon zone (Jun-Sep)
    is_monsoon = 6 <= month <= 9
    is_winter = month in (12, 1, 2)

    # Base temp by region
    base_temps = {
        "Delhi": 32, "Rajasthan": 36, "Gujarat": 33,
        "Maharashtra": 30, "Karnataka": 27, "Tamil Nadu": 29,
        "Telangana": 31, "West Bengal": 30, "Odisha": 29,
        "Uttar Pradesh": 31, "Bihar": 30, "Madhya Pradesh": 32,
        "Kerala": 28,
    }
    base_t = base_temps.get(state, 30)

    if is_monsoon:
        temp = base_t - random.uniform(4, 10)
        humidity = random.uniform(75, 95)
        rainfall = random.uniform(0, 25) if random.random() < 0.6 else 0
        condition = "rainy" if rainfall > 0 else "cloudy"
        visibility = random.uniform(3, 8) if rainfall > 0 else random.uniform(8, 15)
        wind = random.uniform(20, 60)
    elif is_winter:
        temp = base_t - random.uniform(8, 16)
        humidity = random.uniform(45, 70)
        rainfall = 0
        fog = random.random() < 0.4
        condition = "foggy" if fog else "clear"
        visibility = random.uniform(0.5, 3) if fog else random.uniform(8, 15)
        wind = random.uniform(5, 25)
    else:
        temp = base_t + random.uniform(-2, 4)
        humidity = random.uniform(30, 55)
        rainfall = 0
        condition = "sunny" if random.random() < 0.7 else "partly_cloudy"
        visibility = random.uniform(10, 25)
        wind = random.uniform(10, 35)

    return {
        "station_id": station["id"],
        "station_name": station["name"],
        "temperature_c": round(temp, 1),
        "humidity_pct": round(humidity, 1),
        "rainfall_mm": round(rainfall, 2),
        "wind_kmh": round(wind, 1),
        "visibility_km": round(visibility, 1),
        "condition": condition,
    }


# ─── Train position simulation ───────────────────────────────────────────────
_train_positions: dict = {}

def _get_train_position(train: dict, from_station: dict, to_station: dict) -> dict:
    key = train["no"]
    if key not in _train_positions:
        _train_positions[key] = random.uniform(0, 1)

    # Move 2-8% of route per tick
    _train_positions[key] = (_train_positions[key] + random.uniform(0.02, 0.08)) % 1.0
    progress = _train_positions[key]

    lat = from_station["lat"] + (to_station["lat"] - from_station["lat"]) * progress
    lng = from_station["lng"] + (to_station["lng"] - from_station["lng"]) * progress
    speed = random.uniform(60, 140)
    delay = max(0, random.normalvariate(5, 15))

    return {
        "train_no": train["no"],
        "train_name": train["name"],
        "train_type": train["type"],
        "lat": round(lat, 5),
        "lng": round(lng, 5),
        "speed_kmh": round(speed, 1),
        "delay_min": round(delay, 0),
        "from_station": from_station["name"],
        "to_station": to_station["name"],
        "progress_pct": round(progress * 100, 1),
        "occupancy_pct": round(random.uniform(40, 110), 1),
    }


# ─── Sensor data generators ──────────────────────────────────────────────────
def _generate_track_sensor(station: dict) -> dict:
    """Track health sensor at a station."""
    health = random.uniform(60, 100)
    return {
        "type": "track_health",
        "station_id": station["id"],
        "station_name": station["name"],
        "rail_temp_c": round(random.uniform(30, 65), 1),
        "track_stress_mpa": round(random.uniform(80, 180), 1),
        "health_score": round(health, 1),
        "fishplate_ok": random.random() > 0.05,
        "rail_fracture_risk": health < 70,
    }


def _generate_platform_sensor(station: dict) -> dict:
    """Platform occupancy sensor."""
    hour = datetime.now().hour
    # Peak hours: 7-10am, 5-8pm
    is_peak = (7 <= hour <= 10) or (17 <= hour <= 20)
    crowd_base = random.uniform(50, 80) if is_peak else random.uniform(10, 50)
    return {
        "type": "platform_crowd",
        "station_id": station["id"],
        "station_name": station["name"],
        "platform_no": random.randint(1, 6),
        "occupancy_pct": round(min(120, crowd_base + random.uniform(-10, 20)), 1),
        "waiting_passengers": random.randint(50, 3000),
        "gates_open": random.randint(2, 6),
    }


def _generate_signal_sensor(station: dict) -> dict:
    """Signal & interlocking health sensor."""
    fault = random.random() < 0.03  # 3% chance of signal fault
    return {
        "type": "signal_health",
        "station_id": station["id"],
        "station_name": station["name"],
        "signals_monitored": random.randint(12, 40),
        "faults_detected": 1 if fault else 0,
        "interlocking_ok": not fault,
        "battery_backup_ok": random.random() > 0.02,
        "power_supply_ok": random.random() > 0.01,
    }


def _generate_ohe_sensor(station: dict) -> dict:
    """OHE (Overhead Equipment) power sensor."""
    voltage = random.normalvariate(25, 0.5)  # 25kV nominal
    return {
        "type": "ohe_power",
        "station_id": station["id"],
        "station_name": station["name"],
        "voltage_kv": round(voltage, 2),
        "current_a": round(random.uniform(200, 800), 1),
        "stagger_deviation_mm": round(random.uniform(0, 25), 1),
        "dropper_intact": random.random() > 0.02,
        "pantograph_wear_pct": round(random.uniform(5, 80), 1),
    }


# ─── Auto-create critical events ─────────────────────────────────────────────
def _maybe_create_event(sensor_data: dict) -> bool:
    """POST a new event if the sensor reading is critical."""
    event_map = {
        "track_health": {
            "check": lambda d: d.get("health_score", 100) < 70,
            "event_type": "track_defect",
            "severity": lambda d: "critical" if d["health_score"] < 60 else "high",
            "desc": lambda d: f"Track health degraded at {d['station_name']}: score {d['health_score']}/100. Rail fracture risk: {d['rail_fracture_risk']}",
        },
        "signal_health": {
            "check": lambda d: d.get("faults_detected", 0) > 0,
            "event_type": "signal_failure",
            "severity": lambda d: "high",
            "desc": lambda d: f"Signal fault detected at {d['station_name']}. Interlocking status: {'OK' if d['interlocking_ok'] else 'FAULT'}",
        },
        "platform_crowd": {
            "check": lambda d: d.get("occupancy_pct", 0) > 90,
            "event_type": "platform_overcrowding",
            "severity": lambda d: "critical" if d["occupancy_pct"] > 110 else "high",
            "desc": lambda d: f"Platform {d['platform_no']} at {d['station_name']} is {d['occupancy_pct']}% full. {d['waiting_passengers']:,} passengers waiting.",
        },
        "ohe_power": {
            "check": lambda d: abs(d.get("voltage_kv", 25) - 25) > 1.5 or not d.get("dropper_intact"),
            "event_type": "ohe_failure",
            "severity": lambda d: "critical" if abs(d.get("voltage_kv", 25) - 25) > 2 else "high",
            "desc": lambda d: f"OHE anomaly at {d['station_name']}: {d['voltage_kv']}kV (nominal 25kV). Dropper intact: {d['dropper_intact']}",
        },
    }
    sensor_type = sensor_data.get("type")
    rule = event_map.get(sensor_type)
    if rule and rule["check"](sensor_data):
        station_id = sensor_data.get("station_id")
        severity = rule["severity"](sensor_data)
        affected = random.randint(100, 5000)
        delay = random.randint(10, 120)
        payload = {
            "event_type": rule["event_type"],
            "severity": severity,
            "priority": 9 if severity == "critical" else 7,
            "description": rule["desc"](sensor_data),
            "station_id": station_id,
            "affected_passengers": affected,
            "estimated_delay_minutes": delay,
            "event_metadata": {"sensor_triggered": True, "raw": sensor_data},
        }
        try:
            r = requests.post(f"{API_BASE}/events", json=payload, timeout=5)
            if r.status_code in (200, 201):
                logger.info(f"  --> AUTO EVENT: {rule['event_type']} ({severity}) at {sensor_data.get('station_name')}")
                return True
        except Exception as e:
            logger.warning(f"  --> Failed to create event: {e}")
    return False


# ─── Main loop ───────────────────────────────────────────────────────────────
def run():
    logger.info("RailMind Sensor Stream started. Emitting every 5 seconds...")
    logger.info(f"Target API: {API_BASE}")

    tick = 0
    while True:
        tick += 1
        ts = datetime.utcnow().isoformat()
        logger.info(f"--- Tick {tick} [{datetime.now().strftime('%H:%M:%S')}] ---")

        # Pick random stations for this tick
        sampled_stations = random.sample(STATIONS, k=min(4, len(STATIONS)))

        all_sensor_data = []

        for station in sampled_stations:
            # Generate each sensor type
            sensors = [
                _generate_track_sensor(station),
                _generate_platform_sensor(station),
                _generate_signal_sensor(station),
                _generate_ohe_sensor(station),
            ]
            weather = _get_weather(station)

            for s in sensors:
                all_sensor_data.append({**s, "timestamp": ts})
                _maybe_create_event(s)

            # Post weather data
            try:
                requests.post(f"{API_BASE}/sensors/weather", json={
                    "station_id": station["id"],
                    "station_name": station["name"],
                    "timestamp": ts,
                    **weather,
                }, timeout=3)
            except Exception:
                pass

        # Train positions
        for train in random.sample(TRAIN_NUMBERS, k=5):
            from_s, to_s = random.sample(STATIONS, 2)
            pos = _get_train_position(train, from_s, to_s)
            pos["timestamp"] = ts
            try:
                requests.post(f"{API_BASE}/sensors/train_position", json=pos, timeout=3)
            except Exception:
                pass

        # Post bulk sensor readings
        try:
            requests.post(f"{API_BASE}/sensors/bulk", json={
                "readings": all_sensor_data,
                "timestamp": ts,
            }, timeout=5)
            logger.info(f"  Posted {len(all_sensor_data)} sensor readings")
        except Exception as e:
            logger.warning(f"  Sensor bulk post failed: {e}")

        time.sleep(STREAM_INTERVAL)


if __name__ == "__main__":
    run()
