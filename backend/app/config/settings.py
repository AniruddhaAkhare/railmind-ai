import os
from datetime import timedelta


def _build_engine_options(db_url: str) -> dict:
    """Build SQLAlchemy engine options — SQLite doesn't support pool_size."""
    if db_url.startswith('sqlite'):
        return {'pool_pre_ping': True}
    return {
        'pool_size': 20,
        'pool_recycle': 3600,
        'pool_pre_ping': True,
    }


class Config:
    """Base configuration"""
    FLASK_ENV = os.getenv('FLASK_ENV', 'development')
    DEBUG = False
    TESTING = False

    # Database — defaults to SQLite for zero-config local dev
    SQLALCHEMY_DATABASE_URI = os.getenv(
        'DATABASE_URL',
        'sqlite:///railmind.db'
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ECHO = os.getenv('SQLALCHEMY_ECHO', 'False') == 'True'
    SQLALCHEMY_ENGINE_OPTIONS = _build_engine_options(
        os.getenv('DATABASE_URL', 'sqlite:///railmind.db')
    )

    # Redis
    REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
    REDIS_CACHE_TTL = int(os.getenv('REDIS_CACHE_TTL', 3600))

    # OpenRouter LLM
    OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY', '')
    OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
    OPENROUTER_DEFAULT_MODEL = os.getenv(
        'OPENROUTER_MODEL',
        'meta-llama/llama-2-7b-chat'
    )

    # Socket.IO
    SOCKETIO_MESSAGE_QUEUE = os.getenv('SOCKETIO_MESSAGE_QUEUE', None)
    SOCKETIO_CORS_ALLOWED_ORIGINS = ['*']

    # Security
    SECRET_KEY = os.getenv('SECRET_KEY', 'railmind-dev-secret-change-in-production')
    SESSION_COOKIE_SECURE = False  # disable for dev; override in production
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    PERMANENT_SESSION_LIFETIME = timedelta(days=7)

    # CORS
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', '*').split(',')

    # Logging
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    LOG_FILE = os.getenv('LOG_FILE', 'railmind.log')

    # Feature Flags
    ENABLE_SYNTHETIC_DATA = os.getenv('ENABLE_SYNTHETIC_DATA', 'True') == 'True'
    ENABLE_SIMULATION = os.getenv('ENABLE_SIMULATION', 'True') == 'True'
    ENABLE_AGENTS = os.getenv('ENABLE_AGENTS', 'True') == 'True'

    # Application
    APP_NAME = 'RailMind AI'
    APP_VERSION = '1.0.0'
    API_PREFIX = '/api'


class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    TESTING = False
    SQLALCHEMY_ECHO = False  # reduce noise; set True to debug queries


class TestingConfig(Config):
    """Testing configuration"""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'


class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    TESTING = False
    SESSION_COOKIE_SECURE = True


def get_config():
    """Get configuration based on FLASK_ENV environment variable."""
    env = os.getenv('FLASK_ENV', 'development')

    if env == 'testing':
        return TestingConfig()
    elif env == 'production':
        return ProductionConfig()
    else:
        return DevelopmentConfig()
