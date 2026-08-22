"""ImportService — parse CSV/JSON uploads, validate, preview, and suggest next steps."""
import csv
import io
import json
import logging
import zlib
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime

from app.config.database import db
from app.models import Event, Station, Train, Track

logger = logging.getLogger(__name__)

# Allowed event types in the system
VALID_EVENT_TYPES = {
    'track_defect', 'signal_failure', 'ohe_failure', 'bridge_risk',
    'train_delay', 'congestion', 'platform_overcrowding',
    'fire', 'flood', 'emergency_incident',
    'trespassing', 'level_crossing_violation', 'maintenance_alert',
}

VALID_SEVERITIES = {'low', 'medium', 'high', 'critical'}
VALID_STATUSES = {'open', 'in_progress', 'resolved', 'closed'}


def _parse_csv(file_content: str) -> List[Dict[str, Any]]:
    """Parse CSV string into list of dicts."""
    reader = csv.DictReader(io.StringIO(file_content))
    return [row for row in reader]


def _parse_json(file_content: str) -> Any:
    """Parse JSON string."""
    data = json.loads(file_content)
    if isinstance(data, dict):
        # Could be { "events": [...] } or a single object
        if 'events' in data:
            return data['events']
        return [data]
    if isinstance(data, list):
        return data
    raise ValueError("JSON must be an array of objects or { 'events': [...] }")


def _normalize_event(raw: Dict[str, Any], index: int) -> Dict[str, Any]:
    """Normalize raw event data into our event schema."""
    if not isinstance(raw, dict):
        raise ValueError(f"Row {index}: Each record must be a JSON object or CSV row.")

    # Parse optional 3D / inspection fields safely
    asset_id = _safe_str(raw.get('asset_id'))
    asset_type = _safe_str(raw.get('asset_type'))
    chainage_m = _safe_float(raw.get('chainage_m'))
    latitude = _safe_float(raw.get('latitude'))
    longitude = _safe_float(raw.get('longitude'))
    defect_type = _safe_str(raw.get('defect_type'))
    confidence = _safe_float(raw.get('confidence'))
    sensor_source = _safe_str(raw.get('sensor_source'))
    inspection_timestamp = _safe_str(raw.get('inspection_timestamp'))
    evidence = raw.get('evidence')
    if evidence and not isinstance(evidence, dict):
        evidence = {'raw': str(evidence)}

    return {
        'event_type': (_safe_str(raw.get('event_type') or raw.get('type')) or 'maintenance_alert').lower().replace(' ', '_'),
        'severity': (_safe_str(raw.get('severity')) or 'medium').lower(),
        'priority': _safe_int(raw.get('priority')) or 5,
        'status': (_safe_str(raw.get('status')) or 'open').lower(),
        'description': _safe_str(raw.get('description')) or '',
        'station_id': _safe_int(raw.get('station_id')),
        'track_id': _safe_int(raw.get('track_id')),
        'train_id': _safe_int(raw.get('train_id')),
        'affected_passengers': _safe_int(raw.get('affected_passengers')) or 0,
        'estimated_delay_minutes': _safe_int(raw.get('estimated_delay_minutes')) or 0,
        'event_metadata': {},
        # 3D inspection fields (all optional, backward-compatible)
        'asset_id': asset_id,
        'asset_type': asset_type,
        'chainage_m': chainage_m,
        'latitude': latitude,
        'longitude': longitude,
        'defect_type': defect_type,
        'confidence': confidence,
        'sensor_source': sensor_source,
        'inspection_timestamp': inspection_timestamp,
        'evidence': evidence or {},
        '_row_index': index,
    }


def _safe_int(val) -> Optional[int]:
    if val is None or val == '':
        return None
    try:
        return int(val)
    except (ValueError, TypeError):
        return None


def _safe_str(val) -> Optional[str]:
    """Safely convert a value to string, returning None for empty/missing."""
    if val is None:
        return None
    s = str(val).strip()
    return s if s else None


def _safe_float(val) -> Optional[float]:
    """Safely convert a value to float, returning None for empty/missing."""
    if val is None or val == '':
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


# Asset types that are visualizable in the 3D viewer
VISUALIZABLE_ASSET_TYPES = {
    'track', 'signal', 'train', 'platform', 'ohe', 'bridge',
}

# Mapping of event types to probable asset types for auto-detection
_EVENT_TYPE_TO_ASSET_TYPE = {
    'track_defect': 'track',
    'signal_failure': 'signal',
    'ohe_failure': 'ohe',
    'bridge_risk': 'bridge',
    'train_delay': 'train',
    'congestion': 'platform',
    'platform_overcrowding': 'platform',
}

# Severity color mapping for 3D markers
SEVERITY_MARKER_COLOR = {
    'critical': '#ef4444',
    'high': '#f59e0b',
    'medium': '#3b82f6',
    'low': '#6b7280',
}


def _derive_asset_type(event: Dict[str, Any]) -> Optional[str]:
    """Derive asset type from explicit field or event type."""
    explicit = event.get('asset_type')
    if explicit and explicit.lower() in VISUALIZABLE_ASSET_TYPES:
        return explicit.lower()
    return _EVENT_TYPE_TO_ASSET_TYPE.get(event.get('event_type'))


def _derive_asset_id(event: Dict[str, Any]) -> str:
    """Derive an asset ID string from explicit field or composite key."""
    if event.get('asset_id'):
        return event['asset_id']
    asset_type = _derive_asset_type(event) or 'asset'
    prefix_map = {'track': 'TRK', 'signal': 'SIG', 'train': 'TRN', 'platform': 'PLT', 'ohe': 'OHE', 'bridge': 'BRG'}
    prefix = prefix_map.get(asset_type, 'AST')
    # Use a deterministic suffix from track_id or station_id
    suffix = event.get('track_id') or event.get('station_id') or event.get('train_id') or 0
    return f"{prefix}-{suffix}"


def build_visualization_payload(event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Generate a 3D visualization payload for a visualizable event.

    Returns None if the event cannot be visualized (no asset type detected).
    Uses chainage_m for a demo 3D position when GIS coordinates are unavailable.
    """
    asset_type = _derive_asset_type(event)
    if not asset_type:
        return None

    asset_id = _derive_asset_id(event)
    severity = event.get('severity', 'medium')
    defect_type = event.get('defect_type') or event.get('event_type', 'unknown')
    confidence = event.get('confidence') or 0.5
    description = event.get('description', '')
    chainage_m = event.get('chainage_m')
    latitude = event.get('latitude')
    longitude = event.get('longitude')
    sensor_source = event.get('sensor_source') or 'unknown'

    # --- Deterministic 3D position ---
    # If lat/lon are provided, convert to a simple local x/z; otherwise use chainage.
    position_accuracy = 'precise'
    if latitude is not None and longitude is not None:
        # Simple projection: scale lon to x, lat to z (demo only)
        x = round((longitude - 80.0) * 10, 2)  # offset from ~central India
        y = 0.25  # slightly above ground
        z = round((latitude - 22.0) * 10, 2)
    elif chainage_m is not None:
        # Use chainage as x-axis distance along a demo track
        x = round(chainage_m / 1000.0, 2)  # scale: 1 unit = 1 km
        y = 0.25
        z = 0.0
        position_accuracy = 'estimated'
    else:
        # Stable fallback based on asset_id checksum (crc32 is deterministic
        # across processes, unlike builtin hash() which is randomized)
        h = zlib.crc32(asset_id.encode('utf-8')) % 100
        x = round(h / 10.0, 2)
        y = 0.25
        z = round((h % 10) / 5.0, 2)
        position_accuracy = 'estimated'

    # --- Defect label ---
    label = f"Probable {defect_type.replace('_', ' ')}"

    # --- Build evidence block ---
    evidence = {
        'description': description,
        'sensor_source': sensor_source,
        'position_accuracy': position_accuracy,
    }
    if chainage_m is not None:
        evidence['chainage_m'] = chainage_m
    if latitude is not None:
        evidence['latitude'] = latitude
    if longitude is not None:
        evidence['longitude'] = longitude
    # Merge any explicit evidence dict from the event
    if event.get('evidence') and isinstance(event['evidence'], dict):
        evidence.update(event['evidence'])

    viz_id = f"viz_{asset_id}_{event.get('_row_index', 0)}"

    return {
        'viz_id': viz_id,
        'asset_type': asset_type,
        'asset_id': asset_id,
        'defect': {
            'type': defect_type,
            'position': {'x': x, 'y': y, 'z': z},
            'confidence': confidence,
            'severity': severity,
            'label': label,
        },
        'evidence': evidence,
    }


def _validate_event(event: Dict[str, Any]) -> List[str]:
    """Validate a single event record. Returns list of error strings."""
    errors = []
    row = event.get('_row_index', '?')

    if event['event_type'] not in VALID_EVENT_TYPES:
        errors.append(f"Row {row}: Unknown event_type '{event['event_type']}'. Valid: {sorted(VALID_EVENT_TYPES)}")

    if event['severity'] not in VALID_SEVERITIES:
        errors.append(f"Row {row}: Invalid severity '{event['severity']}'. Valid: {sorted(VALID_SEVERITIES)}")

    if event['status'] not in VALID_STATUSES:
        errors.append(f"Row {row}: Invalid status '{event['status']}'. Valid: {sorted(VALID_STATUSES)}")

    if event['priority'] < 1 or event['priority'] > 10:
        errors.append(f"Row {row}: Priority must be 1-10, got {event['priority']}")

    if not event.get('description') and event['severity'] in ('critical', 'high'):
        errors.append(f"Row {row}: Description recommended for {event['severity']} events")

    return errors


def parse_upload(file_content: str, filename: str) -> Dict[str, Any]:
    """Parse uploaded file and return preview with validation."""
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''

    if ext == 'csv':
        raw_rows = _parse_csv(file_content)
    elif ext == 'json':
        raw_rows = _parse_json(file_content)
    else:
        raise ValueError(f"Unsupported file format '.{ext}'. Use CSV or JSON.")

    if not raw_rows:
        raise ValueError("File contains no records.")

    # Normalize and validate
    events = []
    all_errors = []
    for i, raw in enumerate(raw_rows):
        normalized = _normalize_event(raw, i + 1)
        errors = _validate_event(normalized)
        all_errors.extend(errors)
        events.append(normalized)

    # Compute summary stats
    severity_counts = {}
    type_counts = {}
    total_passengers = 0
    total_delay = 0
    for e in events:
        severity_counts[e['severity']] = severity_counts.get(e['severity'], 0) + 1
        type_counts[e['event_type']] = type_counts.get(e['event_type'], 0) + 1
        total_passengers += e['affected_passengers']
        total_delay += e['estimated_delay_minutes']

    # --- Build 3D visualization payloads for visualizable events ---
    visualizations = []
    for e in events:
        viz = build_visualization_payload(e)
        if viz:
            visualizations.append(viz)

    return {
        'filename': filename,
        'total_records': len(events),
        'valid_records': len(events) - len([e for e in all_errors if 'Row' in e]),
        'errors': all_errors,
        'has_errors': len(all_errors) > 0,
        'events': events,
        'visualizations': visualizations,
        'summary': {
            'by_severity': severity_counts,
            'by_type': type_counts,
            'total_affected_passengers': total_passengers,
            'total_estimated_delay_minutes': total_delay,
        },
    }


def _resolve_fk(model, record_id: Optional[int]):
    """Return record_id if it exists in the DB, else None."""
    if record_id is None:
        return None
    try:
        if db.session.get(model, record_id) is not None:
            return record_id
        return None
    except Exception:
        return None


def confirm_import(events: List[Dict[str, Any]], trigger_agents: bool = True) -> Dict[str, Any]:
    """Persist validated events to DB and optionally trigger agent pipeline.

    Uses savepoints (begin_nested) so a single event failure doesn't roll back
    previously flushed events.
    """
    created = []
    errors = []

    for event_data in events:
        # Use a savepoint so one bad event doesn't destroy previous work
        savepoint = db.session.begin_nested()
        try:
            # Validate FK references — set to None if the referenced row doesn't exist
            station_id = _resolve_fk(Station, event_data.get('station_id'))
            track_id = _resolve_fk(Track, event_data.get('track_id'))
            train_id = _resolve_fk(Train, event_data.get('train_id'))

            event = Event(
                event_type=event_data['event_type'],
                severity=event_data['severity'],
                priority=event_data['priority'],
                status=event_data['status'],
                description=event_data.get('description', ''),
                station_id=station_id,
                track_id=track_id,
                train_id=train_id,
                affected_passengers=event_data.get('affected_passengers', 0),
                estimated_delay_minutes=event_data.get('estimated_delay_minutes', 0),
                event_metadata=event_data.get('event_metadata', {}),
            )
            db.session.add(event)
            db.session.flush()  # get the ID
            created.append(event)
            savepoint.commit()  # release the savepoint on success
        except Exception as e:
            savepoint.rollback()  # only rolls back this one event
            errors.append(f"Failed to create event: {e}")

    # Commit all successfully flushed events
    try:
        if created:
            db.session.commit()
        else:
            db.session.rollback()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Database commit failed during import: {e}")
        errors.insert(0, f"Database error during import: {str(e)}")

    # Optionally trigger agent pipeline for each imported event
    if trigger_agents and created:
        try:
            from app.services.event_service import EventService
            from flask import current_app
            app = current_app._get_current_object()
            for event in created:
                EventService.trigger_agents(event, app)
        except Exception as e:
            logger.warning(f"Agent trigger failed for imported events: {e}")

    return {
        'imported_count': len(created),
        'error_count': len(errors),
        'errors': errors,
        'event_ids': [e.id for e in created],
    }


def generate_next_step_suggestions(
    preview_summary: Dict[str, Any],
    import_result: Dict[str, Any],
    visualizations: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    """Generate AI-powered next step suggestions based on imported data.

    Each suggestion has:
      - id: unique key
      - title: short action label
      - description: why this step is useful
      - category: 'analysis' | 'action' | 'export' | 'review'
      - confidence: 0-1 score of how relevant this is
      - action_type: what the frontend should do when user clicks
      - action_payload: params for the action
      - auto_triggered: whether it was already done
    """
    suggestions = []
    by_severity = preview_summary.get('by_severity', {})
    by_type = preview_summary.get('by_type', {})
    total = preview_summary.get('total_records', 0) or (
        import_result.get('imported_count', 0)
    )
    critical_count = by_severity.get('critical', 0)
    high_count = by_severity.get('high', 0)
    total_passengers = preview_summary.get('total_affected_passengers', 0)
    total_delay = preview_summary.get('total_estimated_delay_minutes', 0)

    # --- Always present: review imported events ---
    suggestions.append({
        'id': 'review_imported',
        'title': 'Review Imported Events',
        'description': f'View all {total} imported events in the event dashboard to verify correctness.',
        'category': 'review',
        'confidence': 1.0,
        'action_type': 'navigate',
        'action_payload': {'route': '/', 'filter': 'imported'},
        'auto_triggered': False,
    })

    # --- Critical events: immediate agent processing ---
    if critical_count > 0:
        suggestions.append({
            'id': 'process_critical',
            'title': 'Run Agent Pipeline on Critical Events',
            'description': (
                f'{critical_count} critical event(s) detected. '
                f'Trigger the full 15-agent AI pipeline for immediate analysis and response.'
            ),
            'category': 'action',
            'confidence': 0.98,
            'action_type': 'trigger_agents',
            'action_payload': {'severity': 'critical', 'count': critical_count},
            'auto_triggered': True,
        })

    # --- High severity ---
    if high_count > 0:
        suggestions.append({
            'id': 'assess_risk',
            'title': 'Run Risk Assessment on High-Severity Events',
            'description': (
                f'{high_count} high-severity event(s) need risk scoring. '
                f'The Risk + Impact agents will evaluate cascading effects.'
            ),
            'category': 'analysis',
            'confidence': 0.90,
            'action_type': 'trigger_agents',
            'action_payload': {'severity': 'high', 'count': high_count},
            'auto_triggered': True,
        })

    # --- Large passenger impact ---
    if total_passengers > 1000:
        suggestions.append({
            'id': 'passenger_impact',
            'title': 'Analyze Passenger Impact',
            'description': (
                f'{total_passengers:,} passengers potentially affected across '
                f'{total} events. Run the Passenger Services agent.'
            ),
            'category': 'analysis',
            'confidence': 0.85,
            'action_type': 'trigger_agents',
            'action_payload': {'agent': 'passenger'},
            'auto_triggered': True,
        })

    # --- Significant delays ---
    if total_delay > 60:
        suggestions.append({
            'id': 'simulate_delays',
            'title': 'Simulate Delay Scenarios',
            'description': (
                f'Total estimated delay: {total_delay} minutes. '
                f'Run a Digital Twin simulation to model cascading schedule impacts.'
            ),
            'category': 'analysis',
            'confidence': 0.80,
            'action_type': 'start_simulation',
            'action_payload': {'scenario': 'delay_cascade', 'delay_minutes': total_delay},
            'auto_triggered': False,
        })

    # --- Maintenance-heavy imports ---
    maint_types = {'track_defect', 'signal_failure', 'ohe_failure', 'bridge_risk', 'maintenance_alert'}
    maint_count = sum(by_type.get(t, 0) for t in maint_types)
    if maint_count > 2:
        suggestions.append({
            'id': 'maintenance_schedule',
            'title': 'Schedule Maintenance Review',
            'description': (
                f'{maint_count} maintenance-related event(s) imported. '
                f'The Maintenance agent can generate a prioritized repair schedule.'
            ),
            'category': 'action',
            'confidence': 0.82,
            'action_type': 'trigger_agents',
            'action_payload': {'agent': 'maintenance'},
            'auto_triggered': True,
        })

    # --- Emergency events ---
    emergency_types = {'fire', 'flood', 'emergency_incident', 'trespassing'}
    emergency_count = sum(by_type.get(t, 0) for t in emergency_types)
    if emergency_count > 0:
        suggestions.append({
            'id': 'emergency_response',
            'title': 'Activate Emergency Response Protocol',
            'description': (
                f'{emergency_count} emergency event(s) detected. '
                f'The Emergency Response agent should evaluate evacuation and containment plans.'
            ),
            'category': 'action',
            'confidence': 0.95,
            'action_type': 'trigger_agents',
            'action_payload': {'agent': 'emergency'},
            'auto_triggered': True,
        })

    # --- Export suggestion (always useful after import) ---
    suggestions.append({
        'id': 'export_report',
        'title': 'Export Event Report',
        'description': 'Download a CSV or JSON report of the imported events for offline review or sharing.',
        'category': 'export',
        'confidence': 0.70,
        'action_type': 'export',
        'action_payload': {'format': 'csv', 'scope': 'imported'},
        'auto_triggered': False,
    })

    # --- View on map ---
    if any(s.get('station_id') for s in (preview_summary.get('_events') or [])):
        suggestions.append({
            'id': 'view_map',
            'title': 'View Events on Railway Map',
            'description': 'See imported events geographically on the Railway Map page.',
            'category': 'review',
            'confidence': 0.65,
            'action_type': 'navigate',
            'action_payload': {'route': '/map'},
            'auto_triggered': False,
        })

    # --- 3D inspection for visualizable defects ---
    if visualizations:
        for viz in visualizations:
            suggestions.append({
                'id': f"open_3d_inspection_{viz['viz_id']}",
                'title': f"Open 3D Inspection: {viz['defect']['label']}",
                'description': (
                    f"Inspect the probable {viz['defect']['type'].replace('_', ' ')} "
                    f"on {viz['asset_id']} in 3D. "
                    f"Confidence: {round(viz['defect']['confidence'] * 100)}%. "
                    f"Evidence sourced from {viz['evidence'].get('sensor_source', 'unknown')}."
                ),
                'category': 'review',
                'confidence': round(viz['defect']['confidence'], 2),
                'action_type': 'open_3d_inspection',
                'action_payload': {
                    'viz_id': viz['viz_id'],
                    'asset_id': viz['asset_id'],
                    'asset_type': viz['asset_type'],
                    'confidence': viz['defect']['confidence'],
                },
                'auto_triggered': False,
            })

    # Sort by confidence descending
    suggestions.sort(key=lambda s: s['confidence'], reverse=True)

    return suggestions
