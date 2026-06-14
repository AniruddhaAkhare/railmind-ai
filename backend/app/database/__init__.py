"""Database package — re-exports the shared db instance."""
from app.config.database import db

__all__ = ["db"]
