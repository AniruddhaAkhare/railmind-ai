import os
import sys

# Force UTF-8 output so emoji log messages don't crash on Windows CP1252 terminals
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if sys.stderr.encoding != 'utf-8':
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# Load .env BEFORE any app imports so Config class reads the correct values
from dotenv import load_dotenv
load_dotenv(override=True)

from app.core.app import create_app, socketio

app = create_app()

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_ENV') == 'development'
    socketio.run(
        app,
        host='0.0.0.0',
        port=port,
        debug=debug,
        allow_unsafe_werkzeug=True
    )