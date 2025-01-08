# Stage 1: Base image setup
FROM ubuntu:20.04 AS base

# Version arguments for monitoring tools
ARG PROMETHEUS_VERSION=2.44.0
ARG GRAFANA_VERSION=9.5.0
ARG ALERTMANAGER_VERSION=0.25.0
ARG DCGM_EXPORTER_VERSION=3.1.7
ARG NODE_EXPORTER_VERSION=1.5.0

# Environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV PROMETHEUS_RETENTION_TIME=30d
ENV PROMETHEUS_STORAGE_SIZE=100GB
ENV GRAFANA_PLUGINS="grafana-piechart-panel,grafana-worldmap-panel"

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    wget \
    gnupg2 \
    software-properties-common \
    python3 \
    python3-pip \
    apt-transport-https \
    ca-certificates \
    && curl -fsSL https://nvidia.github.io/nvidia-docker/gpgkey | apt-key add - \
    && distribution=$(. /etc/os-release;echo $ID$VERSION_ID) \
    && curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | \
       tee /etc/apt/sources.list.d/nvidia-docker.list \
    && apt-get update && apt-get install -y --no-install-recommends \
    nvidia-container-toolkit \
    nvidia-dcgm \
    && rm -rf /var/lib/apt/lists/*

# Create system users
RUN groupadd -r prometheus && useradd -r -g prometheus -s /sbin/nologin -d /prometheus prometheus \
    && groupadd -r grafana && useradd -r -g grafana -s /sbin/nologin -d /var/lib/grafana grafana \
    && groupadd -r alertmanager && useradd -r -g alertmanager -s /sbin/nologin -d /alertmanager alertmanager \
    && groupadd -r dcgm-exporter && useradd -r -g dcgm-exporter -s /sbin/nologin -d /var/lib/dcgm-exporter dcgm-exporter

# Stage 2: Monitoring tools installation
FROM base AS monitoring

# Install Prometheus
RUN mkdir -p /prometheus /etc/prometheus \
    && curl -fsSL https://github.com/prometheus/prometheus/releases/download/v${PROMETHEUS_VERSION}/prometheus-${PROMETHEUS_VERSION}.linux-amd64.tar.gz | \
       tar -xz --strip-components=1 -C /prometheus \
    && chown -R prometheus:prometheus /prometheus /etc/prometheus

# Install Grafana
RUN mkdir -p /var/lib/grafana \
    && curl -fsSL https://dl.grafana.com/oss/release/grafana_${GRAFANA_VERSION}_amd64.deb -o grafana.deb \
    && dpkg -i grafana.deb \
    && rm grafana.deb \
    && for plugin in $(echo $GRAFANA_PLUGINS | tr ',' ' '); do \
         grafana-cli plugins install $plugin; \
       done \
    && chown -R grafana:grafana /var/lib/grafana

# Install Alertmanager
RUN mkdir -p /alertmanager \
    && curl -fsSL https://github.com/prometheus/alertmanager/releases/download/v${ALERTMANAGER_VERSION}/alertmanager-${ALERTMANAGER_VERSION}.linux-amd64.tar.gz | \
       tar -xz --strip-components=1 -C /alertmanager \
    && chown -R alertmanager:alertmanager /alertmanager

# Install DCGM Exporter
RUN mkdir -p /var/lib/dcgm-exporter \
    && curl -fsSL https://github.com/NVIDIA/dcgm-exporter/releases/download/v${DCGM_EXPORTER_VERSION}/dcgm-exporter-${DCGM_EXPORTER_VERSION}.tar.gz | \
       tar -xz -C /var/lib/dcgm-exporter \
    && chown -R dcgm-exporter:dcgm-exporter /var/lib/dcgm-exporter

# Install Node Exporter
RUN mkdir -p /var/lib/node_exporter \
    && curl -fsSL https://github.com/prometheus/node_exporter/releases/download/v${NODE_EXPORTER_VERSION}/node_exporter-${NODE_EXPORTER_VERSION}.linux-amd64.tar.gz | \
       tar -xz --strip-components=1 -C /var/lib/node_exporter

# Install custom environmental metrics exporter
COPY scripts/environmental-metrics-exporter.py /usr/local/bin/
RUN chmod +x /usr/local/bin/environmental-metrics-exporter.py \
    && pip3 install prometheus_client psutil

# Create necessary directories with correct permissions
RUN mkdir -p /prometheus/data /var/lib/grafana/dashboards /alertmanager/data \
    && chown prometheus:prometheus /prometheus/data \
    && chown grafana:grafana /var/lib/grafana/dashboards \
    && chown alertmanager:alertmanager /alertmanager/data

# Expose ports
EXPOSE 9090 # Prometheus
EXPOSE 3000 # Grafana
EXPOSE 9093 # Alertmanager
EXPOSE 9400 # DCGM Exporter
EXPOSE 9100 # Node Exporter

# Volume configuration
VOLUME ["/prometheus", "/var/lib/grafana", "/alertmanager", "/etc/prometheus", "/var/lib/dcgm-exporter"]

# Set working directory
WORKDIR /prometheus

# Copy entrypoint script
COPY scripts/entrypoint.sh /
RUN chmod +x /entrypoint.sh

# Set entrypoint
ENTRYPOINT ["/entrypoint.sh"]

# Default command
CMD ["start"]

# Labels
LABEL maintainer="Provocative Cloud Team" \
      description="Monitoring base image with GPU and environmental metrics support" \
      version="1.0.0" \
      prometheus.version="${PROMETHEUS_VERSION}" \
      grafana.version="${GRAFANA_VERSION}" \
      alertmanager.version="${ALERTMANAGER_VERSION}" \
      dcgm.exporter.version="${DCGM_EXPORTER_VERSION}" \
      node.exporter.version="${NODE_EXPORTER_VERSION}"