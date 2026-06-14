"""Sensors API — receives and serves real-time sensor telemetry."""
from flask import Blueprint, request, jsonify
from datetime import datetime
from collections import deque

sensors_bp = Blueprint('sensors', __name__)

# In-memory ring buffers (no DB schema change needed)
_sensor_readings: deque = deque(maxlen=500)   # last 500 sensor readings
_weather_data: dict = {}                       # {station_id: latest weather}
_train_positions: dict = {}                    # {train_no: latest position}


@sensors_bp.route('/bulk', methods=['POST'])
def receive_bulk():
    """Receive bulk sensor readings from sensor_stream.py."""
    data = request.get_json(force=True, silent=True) or {}
    readings = data.get('readings', [])
    ts = data.get('timestamp', datetime.utcnow().isoformat())

    for r in readings:
        r['server_received'] = ts
        _sensor_readings.appendleft(r)

    # Broadcast to Socket.IO clients
    try:
        from app.core.app import socketio
        socketio.emit('sensor_update', {
            'readings': readings[:10],  # last 10 for efficiency
            'timestamp': ts,
        }, namespace='/pulse')
    except Exception:
        pass

    return jsonify({'status': 'ok', 'received': len(readings)}), 200


@sensors_bp.route('/weather', methods=['POST'])
def receive_weather():
    """Receive weather data for a station."""
    data = request.get_json(force=True, silent=True) or {}
    station_id = data.get('station_id')
    if station_id:
        _weather_data[station_id] = data

    # Broadcast
    try:
        from app.core.app import socketio
        socketio.emit('weather_update', data, namespace='/pulse')
    except Exception:
        pass

    return jsonify({'status': 'ok'}), 200


@sensors_bp.route('/train_position', methods=['POST'])
def receive_train_position():
    """Receive a train's current position."""
    data = request.get_json(force=True, silent=True) or {}
    train_no = data.get('train_no')
    if train_no:
        _train_positions[train_no] = data

    # Broadcast
    try:
        from app.core.app import socketio
        socketio.emit('train_position', data, namespace='/pulse')
    except Exception:
        pass

    return jsonify({'status': 'ok'}), 200


@sensors_bp.route('/latest', methods=['GET'])
def get_latest():
    """Return the most recent sensor readings."""
    limit = min(int(request.args.get('limit', 50)), 200)
    return jsonify({
        'readings': list(_sensor_readings)[:limit],
        'count': len(_sensor_readings),
    }), 200


@sensors_bp.route('/weather', methods=['GET'])
def get_weather():
    """Return current weather for all stations."""
    return jsonify({
        'weather': list(_weather_data.values()),
    }), 200


@sensors_bp.route('/trains', methods=['GET'])
def get_train_positions():
    """Return current positions of all tracked trains."""
    return jsonify({
        'trains': list(_train_positions.values()),
    }), 200


@sensors_bp.route('/station-health', methods=['GET'])
def get_station_health():
    """Aggregate the latest sensor readings per station into a health score object."""
    # Find the most recent reading for each sensor type per station
    health_by_station = {}
    
    # Process from newest to oldest since it's an appendleft deque
    for reading in list(_sensor_readings):
        st_id = reading.get("station_id")
        if not st_id:
            continue
            
        if st_id not in health_by_station:
            health_by_station[st_id] = {
                "station_id": st_id,
                "station_name": reading.get("station_name"),
                "track": 100,
                "signal": 100,
                "ohe": 100,
                "crowd": 0,
                "_seen": set() # track which sensor types we've seen for this station
            }
            
        st_data = health_by_station[st_id]
        s_type = reading.get("type")
        
        # Only take the newest reading of each type
        if s_type in st_data["_seen"]:
            continue
            
        st_data["_seen"].add(s_type)
        
        if s_type == "track_health":
            st_data["track"] = reading.get("health_score", 100)
        elif s_type == "signal_health":
            st_data["signal"] = 100 if reading.get("faults_detected", 0) == 0 else 50
        elif s_type == "ohe_power":
            volt = reading.get("voltage_kv", 25)
            # score decreases as voltage deviates from 25
            deviation = abs(volt - 25)
            st_data["ohe"] = max(0, 100 - (deviation * 20))
        elif s_type == "platform_crowd":
            st_data["crowd"] = reading.get("occupancy_pct", 0)

    # Clean up _seen and calculate overall health
    for st_id, data in health_by_station.items():
        del data["_seen"]
        # Overall health is min of infrastructure, minus crowd penalty
        infra = min(data["track"], data["signal"], data["ohe"])
        crowd_penalty = max(0, (data["crowd"] - 80) / 2) # Penalty starts after 80%
        
        overall = infra - crowd_penalty
        
        if overall >= 85:
            data["status"] = "good"
        elif overall >= 65:
            data["status"] = "warning"
        else:
            data["status"] = "critical"
            
        data["overall"] = round(max(0, overall), 1)

    return jsonify({
        'health': list(health_by_station.values()),
    }), 200
