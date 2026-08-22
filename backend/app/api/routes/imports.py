"""Import/Export API — upload data, preview, confirm, get suggestions, and export."""
from flask import Blueprint, request, jsonify, Response
from app.services.import_service import (
    parse_upload, confirm_import, generate_next_step_suggestions
)
from app.services.export_service import (
    export_events, export_agent_report, export_stations
)

imports_bp = Blueprint('imports', __name__)


@imports_bp.route('/preview', methods=['POST'])
def preview_import():
    """Upload a file and get a preview with validation + suggestions.

    Expects multipart/form-data with a 'file' field (CSV or JSON).
    Returns: parsed events, validation errors, summary stats, next-step suggestions.
    """
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided. Send as multipart form with key "file".'}), 400

    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'File has no name.'}), 400

    try:
        content = file.read().decode('utf-8')
    except UnicodeDecodeError:
        return jsonify({'error': 'File must be UTF-8 encoded text (CSV or JSON).'}), 400

    try:
        preview = parse_upload(content, file.filename)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

    # Generate suggestions based on preview (before import)
    suggestions = generate_next_step_suggestions(preview, {})

    return jsonify({
        'preview': {
            'filename': preview['filename'],
            'total_records': preview['total_records'],
            'valid_records': preview['valid_records'],
            'has_errors': preview['has_errors'],
            'errors': preview['errors'],
            'summary': preview['summary'],
            'events': preview['events'],  # first 50 for preview
        },
        'suggestions': suggestions,
    }), 200


@imports_bp.route('/confirm', methods=['POST'])
def confirm():
    """Confirm the import after user review.

    Expects JSON body:
      { "events": [...], "trigger_agents": true }
    Returns: import results + post-import suggestions.
    """
    data = request.get_json(silent=True)
    if not data or 'events' not in data:
        return jsonify({'error': 'Provide "events" array in JSON body.'}), 400

    events = data['events']
    trigger_agents = data.get('trigger_agents', True)

    if not isinstance(events, list) or len(events) == 0:
        return jsonify({'error': '"events" must be a non-empty array.'}), 400

    result = confirm_import(events, trigger_agents=trigger_agents)

    # Generate post-import suggestions
    summary = {
        'by_severity': {},
        'by_type': {},
        'total_affected_passengers': 0,
        'total_estimated_delay_minutes': 0,
        'total_records': result['imported_count'],
    }
    for e in events:
        sev = e.get('severity', 'medium')
        etype = e.get('event_type', 'unknown')
        summary['by_severity'][sev] = summary['by_severity'].get(sev, 0) + 1
        summary['by_type'][etype] = summary['by_type'].get(etype, 0) + 1
        summary['total_affected_passengers'] += e.get('affected_passengers', 0)
        summary['total_estimated_delay_minutes'] += e.get('estimated_delay_minutes', 0)

    suggestions = generate_next_step_suggestions(summary, result)

    return jsonify({
        'result': result,
        'suggestions': suggestions,
    }), 200


@imports_bp.route('/export/events', methods=['GET'])
def download_events():
    """Export events as CSV or JSON.

    Query params:
      format: 'csv' or 'json' (default: json)
      status: filter by status
      severity: filter by severity
      type: filter by event_type
      limit: max records (default: 1000)
    """
    fmt = request.args.get('format', 'json').lower()
    status = request.args.get('status')
    severity = request.args.get('severity')
    event_type = request.args.get('type')
    limit = request.args.get('limit', 1000, type=int)

    result = export_events(
        status=status,
        severity=severity,
        event_type=event_type,
        format=fmt,
        limit=limit,
    )

    return Response(
        result['content'],
        mimetype=result['content_type'],
        headers={
            'Content-Disposition': f'attachment; filename="{result["filename"]}"'
        },
    )


@imports_bp.route('/export/agents', methods=['GET'])
def download_agent_report():
    """Export agent decisions and execution traces."""
    fmt = request.args.get('format', 'json').lower()
    limit = request.args.get('limit', 500, type=int)

    result = export_agent_report(format=fmt, limit=limit)

    return Response(
        result['content'],
        mimetype=result['content_type'],
        headers={
            'Content-Disposition': f'attachment; filename="{result["filename"]}"'
        },
    )


@imports_bp.route('/export/stations', methods=['GET'])
def download_stations():
    """Export all stations."""
    fmt = request.args.get('format', 'json').lower()
    result = export_stations(format=fmt)

    return Response(
        result['content'],
        mimetype=result['content_type'],
        headers={
            'Content-Disposition': f'attachment; filename="{result["filename"]}"'
        },
    )


@imports_bp.route('/suggestions', methods=['POST'])
def get_suggestions():
    """Get next-step suggestions for already-imported data.

    Expects JSON: { "events": [...] } — array of event dicts.
    """
    data = request.get_json(silent=True)
    if not data or 'events' not in data:
        return jsonify({'error': 'Provide "events" array.'}), 400

    events = data['events']

    # Build summary from the provided events
    summary = {
        'by_severity': {},
        'by_type': {},
        'total_affected_passengers': 0,
        'total_estimated_delay_minutes': 0,
        'total_records': len(events),
    }
    for e in events:
        sev = e.get('severity', 'medium')
        etype = e.get('event_type', 'unknown')
        summary['by_severity'][sev] = summary['by_severity'].get(sev, 0) + 1
        summary['by_type'][etype] = summary['by_type'].get(etype, 0) + 1
        summary['total_affected_passengers'] += e.get('affected_passengers', 0)
        summary['total_estimated_delay_minutes'] += e.get('estimated_delay_minutes', 0)

    suggestions = generate_next_step_suggestions(summary, {})

    return jsonify({'suggestions': suggestions}), 200
