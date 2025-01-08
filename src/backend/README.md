# Provocative Cloud Backend Services

## Project Overview

Provocative Cloud is a GPU rental platform with integrated carbon capture technology, providing high-performance computing resources while contributing to environmental sustainability. The backend services are built using Python 3.10+ with FastAPI, featuring comprehensive GPU management, real-time monitoring, and carbon capture integration.

### Key Features
- GPU resource management and provisioning
- Real-time metrics collection and monitoring
- Integrated carbon capture system tracking
- Secure authentication and authorization
- Automated scaling and failover
- Comprehensive API documentation

## Prerequisites

### System Requirements
- Python 3.10+ with development headers
- Poetry 1.4+ package manager
- Docker 24.0+ and Docker Compose v2
- NVIDIA drivers 525+ and CUDA toolkit 12.0+
- PostgreSQL 15+ with TimescaleDB extension
- Redis 7.0+ for caching and real-time updates
- Node.js 18+ for development tools

### Development Tools
- VSCode with Python extension
- Docker Desktop
- PostgreSQL client
- Redis CLI
- NVIDIA Container Toolkit

## Installation

### Clone Repository
```bash
git clone https://github.com/provocative-cloud/backend.git
cd backend
```

### Setup Environment
```bash
# Install dependencies using Poetry
poetry install

# Activate virtual environment
poetry shell

# Copy environment configuration
cp .env.example .env

# Initialize database
poetry run alembic upgrade head
```

### Configure Environment Variables
```bash
# Database connection
DATABASE_URL=postgresql://user:password@localhost:5432/provocative_cloud

# Redis connection
REDIS_URL=redis://localhost:6379/0

# Security
SECRET_KEY=your-secret-key-here

# Payment processing
STRIPE_API_KEY=sk_test_...

# GPU configuration
NVIDIA_VISIBLE_DEVICES=all

# Carbon capture integration
CARBON_CAPTURE_API_KEY=cc_api_key_...
```

## Development Setup

### Local Development Server
```bash
# Start development server
poetry run uvicorn api.main:app --reload --host 0.0.0.0 --port 8000 --workers 4

# Start with Docker Compose
docker-compose up -d
```

### Project Structure
```
src/backend/
├── api/                 # FastAPI application code
├── db/                 # Database models and migrations
├── gpu_manager/        # GPU resource management
├── carbon_capture/     # Carbon capture integration
├── infrastructure/     # Deployment configurations
├── tests/             # Test suites
└── scripts/           # Utility scripts
```

## Testing

### Running Tests
```bash
# Run all tests
poetry run pytest

# Run with coverage report
poetry run pytest --cov=api --cov-report=html

# Generate coverage XML
poetry run pytest --cov=api --cov-report=xml
```

### Test Categories
- Unit tests: `tests/unit/`
- Integration tests: `tests/integration/`
- Performance tests: `tests/performance/`
- GPU simulation tests: `tests/gpu/`

## API Documentation

### OpenAPI Documentation
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
- OpenAPI JSON: `http://localhost:8000/openapi.json`

### Authentication
- OAuth 2.0 with JWT tokens
- Role-based access control (RBAC)
- API key authentication for services

## Deployment

### Production Deployment
```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Deploy services
docker-compose -f docker-compose.prod.yml up -d

# Check logs
docker-compose -f docker-compose.prod.yml logs -f
```

### Kubernetes Deployment
- Helm charts in `infrastructure/helm/`
- Deployment manifests in `infrastructure/k8s/`
- GPU operator configuration
- Monitoring stack setup

## Monitoring

### Metrics Collection
- Prometheus metrics at `/metrics`
- GPU utilization metrics
- Carbon capture system metrics
- Application performance metrics

### Monitoring Stack
- Prometheus for metrics collection
- Grafana for visualization
- AlertManager for notifications
- ELK Stack for log aggregation

## Security

### Security Features
- JWT-based authentication
- Role-based authorization
- Data encryption at rest
- TLS/SSL encryption
- Rate limiting
- Input validation
- SQL injection protection

### Compliance
- GDPR compliance
- CCPA compliance
- SOC 2 compliance
- PCI DSS compliance

## Contributing

### Development Guidelines
1. Fork the repository
2. Create a feature branch
3. Implement changes with tests
4. Submit pull request
5. Pass CI/CD checks

### Code Style
- Black code formatter
- isort for import sorting
- flake8 for linting
- mypy for type checking

## License

Copyright © 2023 Provocative Cloud. All rights reserved.

## Support

For technical support:
- Email: support@provocative-cloud.com
- Documentation: https://docs.provocative-cloud.com
- Issue Tracker: https://github.com/provocative-cloud/backend/issues