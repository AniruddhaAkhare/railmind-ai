"""ImportService — parse CSV/JSON uploads, validate, preview, and suggest next steps."""
import csv
import io
import json
import logging
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
    return {
        'event_type': (raw.get('event_type') or raw.get('type') or 'maintenance_alert').strip().lower().replace(' ', '_'),
        'severity': (raw.get('severity') or 'medium').strip().lower(),
        'priority': int(raw.get('priority', 5)),
        'status': (raw.get('status') or 'open').strip().lower(),
        'description': raw.get('description', ''),
        'station_id': _safe_int(raw.get('station_id')),
        'track_id': _safe_int(raw.get('track_id')),
        'train_id': _safe_int(raw.get('train_id')),
        'affected_passengers': int(raw.get('affected_passengers', 0) or 0),
        'estimated_delay_minutes': int(raw.get('estimated_delay_minutes', 0) or 0),
        'event_metadata': {},
        '_row_index': index,
    }


def _safe_int(val) -> Optional[int]:
    if val is None or val == '':
        return None
    try:
        return int(val)
    except (ValueError, TypeError):
        return None


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

    return {
        'filename': filename,
        'total_records': len(events),
        'valid_records': len(events) - len([e for e in all_errors if 'Row' in e]),
        'errors': all_errors,
        'has_errors': len(all_errors) > 0,
        'events': events,
        'summary': {
            'by_severity': severity_counts,
            'by_type': type_counts,
            'total_affected_passengers': total_passengers,
            'total_estimated_delay_minutes': total_delay,
        },
    }


def confirm_import(events: List[Dict[str, Any]], trigger_agents: bool = True) -> Dict[str, Any]:
    """Persist validated events to DB and optionally trigger agent pipeline."""
    created = []
    errors = []

    for event_data in events:
        try:
            event = Event(
                event_type=event_data['event_type'],
                severity=event_data['severity'],
                priority=event_data['priority'],
                status=event_data['status'],
                description=event_data.get('description', ''),
                station_id=event_data.get('station_id'),
                track_id=event_data.get('track_id'),
                train_id=event_data.get('train_id'),
                affected_passengers=event_data.get('affected_passengers', 0),
                estimated_delay_minutes=event_data.get('estimated_delay_minutes', 0),
                event_metadata=event_data.get('event_metadata', {}),
            )
            db.session.add(event)
            db.session.flush()  # get the ID
            created.append(event)
        except Exception as e:
            errors.append(f"Failed to create event: {e}")

    db.session.commit()

    # Optionally trigger agent pipeline for each imported event
    if trigger_agents:
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

    # Sort by confidence descending
    suggestions.sort(key=lambda s: s['confidence'], reverse=True)

    return suggestions
