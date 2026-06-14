from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import event
from sqlalchemy.pool import Pool

db = SQLAlchemy()

@event.listens_for(Pool, "connect")
def set_sqlite_pragma(dbapi_conn, connection_record):
    """Enable foreign keys for SQLite"""
    try:
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
    except Exception:
        pass

def init_db(app):
    """Initialize database"""
    db.init_app(app)
    
    with app.app_context():
        try:
            db.create_all()
            print("✅ Database initialized successfully")
        except Exception as e:
            print(f"❌ Database initialization failed: {e}")
            raise
