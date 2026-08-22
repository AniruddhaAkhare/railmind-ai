"""ExportService — export events, agent reports, and decisions as CSV/JSON."""
import csv
import io
import json
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

from app.models import Event, AgentDecision, AgentMessage, AgentExecutionTrace

logger = logging.getLogger(__name__)


def export_events(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    event_type: Optional[str] = None,
    format: str = 'json',
    limit: int = 1000,
) -> Dict[str, Any]:
    """Export events as JSON or CSV."""
    query = Event.query

    if status:
        query = query.filter_by(status=status)
    if severity:
        query = query.filter_by(severity=severity)
    if event_type:
        query = query.filter_by(event_type=event_type)

    events = query.order_by(Event.created_at.desc()).limit(limit).all()
    rows = [e.to_dict() for e in events]

    if format == 'csv':
        return {
            'content': _to_csv(rows),
            'content_type': 'text/csv',
            'filename': f'railmind_events_{datetime.utcnow().strftime("%Y%m%d_%H%M%S")}.csv',
            'count': len(rows),
        }

    return {
        'content': json.dumps({'events': rows, 'count': len(rows), 'exported_at': datetime.utcnow().isoformat()}, indent=2),
        'content_type': 'application/json',
        'filename': f'railmind_events_{datetime.utcnow().strftime("%Y%m%d_%H%M%S")}.json',
        'count': len(rows),
    }


def export_agent_report(format: str = 'json', limit: int = 500) -> Dict[str, Any]:
    """Export agent decisions and execution traces."""
    decisions = AgentDecision.query.order_by(AgentDecision.created_at.desc()).limit(limit).all()
    traces = AgentExecutionTrace.query.order_by(AgentExecutionTrace.start_time.desc()).limit(limit).all()

    report = {
        'decisions': [
            {
                'id': d.id,
                'agent_id': d.agent_id,
                'event_id': d.event_id,
                'decision': d.decision,
                'confidence': d.confidence,
                'outcome': d.outcome,
                'created_at': d.created_at.isoformat() if d.created_at else None,
            }
            for d in decisions
        ],
        'traces': [
            {
                'execution_id': t.execution_id,
                'agent_name': t.agent_name,
                'event_id': t.event_id,
                'duration_ms': t.duration_ms,
                'confidence': t.confidence,
                'model_used': t.model_used,
                'token_usage': t.token_usage,
                'start_time': t.start_time.isoformat() if t.start_time else None,
                'end_time': t.end_time.isoformat() if t.end_time else None,
            }
            for t in traces
        ],
        'summary': {
            'total_decisions': len(decisions),
            'total_traces': len(traces),
            'avg_confidence': (
                sum(d.confidence or 0 for d in decisions) / len(decisions)
                if decisions else 0
            ),
            'exported_at': datetime.utcnow().isoformat(),
        },
    }

    if format == 'csv':
        # Flatten decisions for CSV
        flat_rows = report['decisions']
        return {
            'content': _to_csv(flat_rows),
            'content_type': 'text/csv',
            'filename': f'railmind_agent_report_{datetime.utcnow().strftime("%Y%m%d_%H%M%S")}.csv',
            'count': len(flat_rows),
        }

    return {
        'content': json.dumps(report, indent=2),
        'content_type': 'application/json',
        'filename': f'railmind_agent_report_{datetime.utcnow().strftime("%Y%m%d_%H%M%S")}.json',
        'count': len(report['decisions']),
    }


def export_stations(format: str = 'json') -> Dict[str, Any]:
    """Export all stations."""
    from app.models import Station
    stations = Station.query.all()
    rows = [s.to_dict() for s in stations]

    if format == 'csv':
        return {
            'content': _to_csv(rows),
            'content_type': 'text/csv',
            'filename': f'railmind_stations_{datetime.utcnow().strftime("%Y%m%d_%H%M%S")}.csv',
            'count': len(rows),
        }

    return {
        'content': json.dumps({'stations': rows, 'count': len(rows)}, indent=2),
        'content_type': 'application/json',
        'filename': f'railmind_stations_{datetime.utcnow().strftime("%Y%m%d_%H%M%S")}.json',
        'count': len(rows),
    }


def _to_csv(rows: List[Dict[str, Any]]) -> str:
    """Convert list of dicts to CSV string."""
    if not rows:
        return ''
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=rows[0].keys())
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue()
