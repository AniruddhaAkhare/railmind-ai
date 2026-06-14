# Event types
EVENT_TYPES = [
    'track_defect',
    'signal_failure',
    'level_crossing_violation',
    'trespassing',
    'fire',
    'flood',
    'congestion',
    'platform_overcrowding',
    'bridge_risk',
    'ohe_failure',
    'train_delay',
    'maintenance_alert',
    'emergency_incident'
]

# Severity levels
SEVERITY_LEVELS = ['low', 'medium', 'high', 'critical']

# Status values
STATUS_VALUES = ['open', 'acknowledged', 'in_progress', 'resolved', 'closed']

# Agent types
AGENT_TYPES = [
    'observation',
    'understanding',
    'prediction',
    'risk',
    'impact',
    'simulation',
    'decision',
    'coordination',
    'communication',
    'knowledge',
    'safety',
    'maintenance',
    'operations',
    'passenger',
    'emergency'
]

# Train statuses
TRAIN_STATUSES = ['running', 'stopped', 'delayed', 'cancelled', 'maintenance']

# Route statuses
ROUTE_STATUSES = ['operational', 'under_maintenance', 'closed', 'restricted']

# Asset types
ASSET_TYPES = ['signal', 'bridge', 'ohe', 'level_crossing', 'switch', 'platform']

# Default pagination
DEFAULT_PAGE = 1
DEFAULT_PER_PAGE = 50
MAX_PER_PAGE = 200

# Cache TTLs (in seconds)
CACHE_TTL_SHORT = 60
CACHE_TTL_MEDIUM = 300
CACHE_TTL_LONG = 3600
