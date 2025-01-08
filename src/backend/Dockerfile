# Stage 1: Builder
FROM python:3.10-slim AS builder

# Build arguments
ARG PYTHON_VERSION=3.10
ARG POETRY_VERSION=1.6.1

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    POETRY_VERSION=${POETRY_VERSION} \
    POETRY_HOME="/opt/poetry" \
    POETRY_VIRTUALENVS_IN_PROJECT=true \
    POETRY_NO_INTERACTION=1

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN curl -sSL https://install.python-poetry.org | python3 - \
    && ln -s /opt/poetry/bin/poetry /usr/local/bin/poetry

# Set working directory
WORKDIR /app

# Copy dependency files
COPY pyproject.toml poetry.lock ./

# Install dependencies
RUN poetry install --no-dev --no-root \
    && poetry export -f requirements.txt --output requirements.txt

# Stage 2: Runtime
FROM nvidia/cuda:12.0.0-base-ubuntu20.04 AS runtime

# Build arguments
ARG APP_USER=appuser
ARG APP_GROUP=appgroup
ARG APP_UID=10001
ARG APP_GID=10001
ARG PORT=8000

# Set environment variables
ENV PYTHONPATH=/app \
    PYTHONUNBUFFERED=1 \
    PORT=${PORT} \
    NVIDIA_VISIBLE_DEVICES=all \
    NVIDIA_DRIVER_CAPABILITIES=compute,utility \
    GUNICORN_WORKERS=4 \
    GUNICORN_THREADS=4 \
    LOG_LEVEL=info

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.10 \
    python3.10-venv \
    python3-pip \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create app user/group
RUN groupadd -g ${APP_GID} ${APP_GROUP} \
    && useradd -u ${APP_UID} -g ${APP_GROUP} -s /bin/bash -m ${APP_USER}

# Set working directory
WORKDIR /app

# Copy requirements from builder
COPY --from=builder /app/requirements.txt .

# Install Python dependencies
RUN python3.10 -m pip install --no-cache-dir -r requirements.txt

# Create necessary directories
RUN mkdir -p /app/data /app/logs \
    && chown -R ${APP_USER}:${APP_GROUP} /app \
    && chmod -R 750 /app/data /app/logs

# Copy application code
COPY --chown=${APP_USER}:${APP_GROUP} . .

# Set up health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Switch to non-root user
USER ${APP_USER}

# Expose port
EXPOSE ${PORT}

# Set entrypoint
ENTRYPOINT ["gunicorn"]

# Set default command
CMD ["--workers", "4", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--threads", "4", \
     "--bind", "0.0.0.0:8000", \
     "--access-logfile", "/app/logs/access.log", \
     "--error-logfile", "/app/logs/error.log", \
     "--log-level", "info", \
     "--timeout", "120", \
     "--keep-alive", "5", \
     "--max-requests", "10000", \
     "--max-requests-jitter", "1000", \
     "--graceful-timeout", "30", \
     "api.main:app"]

# Labels
LABEL maintainer="Provocative Cloud Team" \
      version="1.0" \
      description="Provocative Cloud Backend Service" \
      org.opencontainers.image.source="https://github.com/provocative-cloud/backend" \
      com.nvidia.volumes.needed="nvidia_driver"