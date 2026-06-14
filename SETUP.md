# Installation & Setup Guide

## Prerequisites

- Python 3.9+
- Node.js 16+
- Docker & Docker Compose
- PostgreSQL 12+ (if not using Docker)
- Redis 6+ (if not using Docker)

## Installation Methods

### Method 1: Docker Compose (Recommended)

1. Extract ZIP
```bash
unzip railmind-ai-complete.zip
cd railmind-ai
```

2. Configure environment
```bash
cp backend/.env.example backend/.env
# Edit backend/.env - add OPENROUTER_API_KEY
```

3. Start services
```bash
docker-compose up -d
```

4. Verify services
```bash
docker-compose ps
# All should show "Up"
```

5. Access application
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- Database: postgres://railmind:railmind@localhost:5432/railmind_ai
- Redis: localhost:6379

### Method 2: Manual Installation

#### Backend

1. Setup Python
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

2. Configure environment
```bash
cp .env.example .env
# Edit .env - set database and OpenRouter settings
```

3. Setup PostgreSQL
```bash
createdb railmind_ai
createuser railmind password 'railmind'
```

4. Run backend
```bash
python run.py
```

Backend runs on http://localhost:5000

#### Frontend

1. Setup Node
```bash
cd frontend
npm install
```

2. Run frontend
```bash
npm run dev
```

Frontend runs on http://localhost:3000

## Database Initialization

The database initializes automatically on first run:
- Creates all 25 tables
- Sets up relationships
- Creates indexes
- Seeds basic data (optional)

## Verification

### Health Check
```bash
curl http://localhost:5000/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-06-13T...",
  "app": "RailMind AI"
}
```

### API Test
```bash
curl http://localhost:5000/api/events
```

### WebSocket Test
```javascript
const socket = io('http://localhost:5000');
socket.on('connect', () => console.log('Connected'));
socket.on('event_updated', (data) => console.log('Event:', data));
```

## Configuration

### Backend .env Variables

```env
# Flask
FLASK_ENV=development              # or production
FLASK_DEBUG=True

# Database
DATABASE_URL=postgresql://...

# Redis
REDIS_URL=redis://localhost:6379/0

# OpenRouter LLM (Required)
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=meta-llama/llama-2-7b-chat

# Application
APP_NAME=RailMind AI
APP_VERSION=1.0.0

# Features
ENABLE_SYNTHETIC_DATA=True
ENABLE_SIMULATION=True
ENABLE_AGENTS=True

# Logging
LOG_LEVEL=INFO
LOG_FILE=/tmp/railmind.log
```

### Frontend Environment

Create `frontend/.env`:
```
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

## Troubleshooting

### PostgreSQL Connection Error

```
Error: could not connect to database server
```

**Solution**:
1. Verify PostgreSQL is running: `psql --version`
2. Check DATABASE_URL in .env
3. Verify credentials: `psql -U railmind -d railmind_ai`
4. Create database if missing: `createdb railmind_ai`

### Redis Connection Error

```
Error: Connection refused - connecting to 127.0.0.1:6379
```

**Solution**:
1. Start Redis: `redis-server` or `docker run redis`
2. Test connection: `redis-cli ping` (should return PONG)
3. Verify REDIS_URL in .env

### OpenRouter API Error

```
Error: OpenRouter API error
```

**Solution**:
1. Verify OPENROUTER_API_KEY is set in .env
2. Check API key is valid at openrouter.ai
3. Verify account has balance
4. Check internet connection

### Port Already in Use

```
Address already in use
```

**Solution**:
```bash
# Find process
lsof -i :5000   # Backend
lsof -i :3000   # Frontend
lsof -i :5432   # PostgreSQL
lsof -i :6379   # Redis

# Kill process
kill -9 <PID>
```

### Module Not Found Error

```
ModuleNotFoundError: No module named 'flask'
```

**Solution**:
```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
```

### Database Migration Error

```
Alembic error
```

**Solution**:
```bash
cd backend
alembic upgrade head
```

## Data Management

### Generate Synthetic Data

```python
from app.synthetic_data.generators import station_generator, event_generator
from app.config.database import db
from app.core.app import create_app

app = create_app()
with app.app_context():
    stations = station_generator.StationGenerator.generate(100)
    events = event_generator.EventGenerator.generate(500)
    # Save to database
```

### Database Backup

```bash
# Backup
pg_dump railmind_ai > backup.sql

# Restore
psql railmind_ai < backup.sql
```

### Reset Database

```bash
cd backend
python -c "from app.config.database import db; from app.core.app import create_app; app = create_app(); db.drop_all(); db.create_all()"
```

## Performance Tuning

### Database Optimization

```sql
-- Analyze tables
ANALYZE stations;
ANALYZE events;
ANALYZE trains;

-- Vacuum
VACUUM ANALYZE;
```

### Connection Pooling

Edit `backend/app/config/settings.py`:
```python
SQLALCHEMY_ENGINE_OPTIONS = {
    'pool_size': 20,
    'pool_recycle': 3600,
    'pool_pre_ping': True,
    'max_overflow': 10
}
```

### Redis Caching

```python
# Set cache TTL
REDIS_CACHE_TTL = 3600  # 1 hour
```

## Logging

### View Logs

```bash
# Backend logs
tail -f /tmp/railmind.log

# Docker logs
docker-compose logs -f flask-app

# Frontend logs
# Check browser console (F12)
```

### Log Levels

```env
LOG_LEVEL=DEBUG     # Very verbose
LOG_LEVEL=INFO      # Standard
LOG_LEVEL=WARNING   # Warnings only
LOG_LEVEL=ERROR     # Errors only
```

## Development

### Code Style

```bash
cd backend

# Format
black app/

# Lint
flake8 app/

# Type check
mypy app/
```

### Frontend Linting

```bash
cd frontend

npm run lint
npm run type-check
```

### Running Tests

```bash
cd backend
pytest

cd frontend
npm test
```

## Production Deployment

### Environment

```env
FLASK_ENV=production
DEBUG=False
SQLALCHEMY_ECHO=False
SESSION_COOKIE_SECURE=True
ENABLE_SYNTHETIC_DATA=False
```

### Docker Build

```bash
docker build -t railmind-api ./backend
docker build -t railmind-frontend ./frontend
```

### Kubernetes Deployment

```bash
kubectl apply -f k8s/
```

### Monitoring

Monitor services:
- CPU usage
- Memory usage
- Database connections
- Redis memory
- API response times

## Support

For issues:
1. Check logs
2. Review error messages
3. Consult troubleshooting section
4. Check documentation

---

Happy deploying! 🚀
