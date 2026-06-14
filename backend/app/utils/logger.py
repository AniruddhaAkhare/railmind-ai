import logging
import os
import sys
from logging.handlers import RotatingFileHandler


def setup_logger(app):
    """Setup application logging — compatible with both Windows and Unix."""
    log_file = app.config.get('LOG_FILE', 'railmind.log')

    # Ensure we never try to write to a system path on Windows
    if log_file.startswith('/tmp/') or log_file.startswith('/var/'):
        log_file = os.path.basename(log_file)

    # Create logs directory next to the working directory if needed
    if not os.path.isabs(log_file):
        log_dir = 'logs'
        os.makedirs(log_dir, exist_ok=True)
        log_file = os.path.join(log_dir, log_file)

    formatter = logging.Formatter(
        '%(asctime)s %(levelname)s [%(name)s]: %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S',
    )

    # Stream handler — always present
    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(formatter)
    stream_handler.setLevel(logging.DEBUG if app.debug else logging.INFO)
    app.logger.addHandler(stream_handler)

    # Rotating file handler
    try:
        file_handler = RotatingFileHandler(
            log_file,
            maxBytes=10 * 1024 * 1024,  # 10 MB
            backupCount=5,
            encoding='utf-8',
        )
        file_handler.setFormatter(formatter)
        file_handler.setLevel(logging.INFO)
        app.logger.addHandler(file_handler)
    except Exception as e:
        app.logger.warning(f"Could not create file logger at {log_file}: {e}")

    log_level = getattr(logging, app.config.get('LOG_LEVEL', 'INFO').upper(), logging.INFO)
    app.logger.setLevel(log_level)
    app.logger.propagate = False
    app.logger.info('RailMind AI startup complete')
