from app.utils.constants import EVENT_TYPES, SEVERITY_LEVELS


def validate_event_data(data: dict) -> bool:
    """Validate incoming event data."""
    if not data:
        raise ValueError("Request body is empty")

    required = ['event_type', 'severity']
    for field in required:
        if field not in data:
            raise ValueError(f"Missing required field: {field}")

    if data['event_type'] not in EVENT_TYPES:
        raise ValueError(
            f"Invalid event_type '{data['event_type']}'. "
            f"Must be one of: {EVENT_TYPES}"
        )

    if data['severity'] not in SEVERITY_LEVELS:
        raise ValueError(
            f"Invalid severity '{data['severity']}'. "
            f"Must be one of: {SEVERITY_LEVELS}"
        )

    priority = data.get('priority')
    if priority is not None and not (1 <= int(priority) <= 10):
        raise ValueError("priority must be an integer between 1 and 10")

    return True


def validate_station_data(data: dict) -> bool:
    """Validate incoming station data."""
    if not data:
        raise ValueError("Request body is empty")

    required = ['name', 'code', 'latitude', 'longitude']
    for field in required:
        if field not in data:
            raise ValueError(f"Missing required field: {field}")

    if not (-90 <= float(data['latitude']) <= 90):
        raise ValueError(f"Invalid latitude: {data['latitude']}")

    if not (-180 <= float(data['longitude']) <= 180):
        raise ValueError(f"Invalid longitude: {data['longitude']}")

    if len(str(data['code'])) > 10:
        raise ValueError("Station code must be 10 characters or fewer")

    return True


def validate_train_data(data: dict) -> bool:
    """Validate incoming train data."""
    if not data:
        raise ValueError("Request body is empty")

    required = ['train_number']
    for field in required:
        if field not in data:
            raise ValueError(f"Missing required field: {field}")

    if len(str(data['train_number'])) > 20:
        raise ValueError("train_number must be 20 characters or fewer")

    return True
