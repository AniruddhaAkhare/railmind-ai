from datetime import datetime

def get_current_timestamp():
    """Get current timestamp"""
    return datetime.utcnow()

def calculate_delay(event_time, expected_time):
    """Calculate delay in minutes"""
    if not event_time or not expected_time:
        return 0
    return int((event_time - expected_time).total_seconds() / 60)

def format_datetime(dt):
    """Format datetime to ISO"""
    return dt.isoformat() if dt else None

def calculate_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two coordinates"""
    import math
    R = 6371  # Earth's radius in km
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    return R * c

def paginate_query(query, page=1, per_page=50):
    """Paginate query results"""
    return query.paginate(page=page, per_page=per_page, error_out=False)
