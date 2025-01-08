# Base image with CUDA support
# Version: nvidia/cuda:12.0-base-ubuntu20.04
FROM nvidia/cuda:12.0-base-ubuntu20.04

# Set maintainer and metadata labels
LABEL maintainer="Provocative Cloud" \
      description="GPU-enabled base image with environmental monitoring" \
      version="1.0" \
      security.hardened="true" \
      power.managed="true" \
      carbon.tracked="true"

# Set environment variables
ENV NVIDIA_VISIBLE_DEVICES=all \
    NVIDIA_DRIVER_CAPABILITIES=compute,utility \
    CUDA_VERSION=12.0.0 \
    DEBIAN_FRONTEND=noninteractive \
    GPU_POWER_LIMIT=250 \
    GPU_THERMAL_LIMIT=85 \
    MONITORING_INTERVAL=1000 \
    CARBON_TRACKING_ENABLED=true \
    NVIDIA_DRIVER_VERSION=535.104.05

# Create required directories
RUN mkdir -p /usr/local/nvidia \
    /usr/local/cuda \
    /var/log/nvidia-power \
    /etc/nvidia-container-runtime

# Install system dependencies and security updates
RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        gnupg \
        wget \
        apt-transport-https \
        software-properties-common \
        ubuntu-keyring && \
    rm -rf /var/lib/apt/lists/*

# Add NVIDIA repository and install CUDA toolkit
RUN curl -fsSL https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2004/x86_64/3bf863cc.pub | apt-key add - && \
    echo "deb https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2004/x86_64 /" > /etc/apt/sources.list.d/cuda.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        cuda-toolkit-12-0=${CUDA_VERSION}-1 \
        nvidia-driver-${NVIDIA_DRIVER_VERSION} && \
    rm -rf /var/lib/apt/lists/*

# Install NVIDIA Container Toolkit
# Version: 1.13.0
RUN distribution=$(. /etc/os-release;echo $ID$VERSION_ID) && \
    curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg && \
    curl -s -L https://nvidia.github.io/libnvidia-container/$distribution/libnvidia-container.list | \
        sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
        tee /etc/apt/sources.list.d/nvidia-container-toolkit.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        nvidia-container-toolkit=1.13.0-1 && \
    rm -rf /var/lib/apt/lists/*

# Install NVIDIA DCGM for power monitoring
# Version: 3.1.7
RUN curl -fsSL https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2004/x86_64/nvidia-dcgm-keyring.gpg | apt-key add - && \
    echo "deb https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2004/x86_64 /" > /etc/apt/sources.list.d/nvidia-dcgm.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        datacenter-gpu-manager=3.1.7-1 && \
    rm -rf /var/lib/apt/lists/*

# Configure GPU power management and monitoring
COPY scripts/configure_gpu.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/configure_gpu.sh && \
    echo "#!/bin/bash\n\
    nvidia-smi -pm 1\n\
    nvidia-smi -pl ${GPU_POWER_LIMIT}\n\
    nvidia-smi --auto-boost-default=0\n\
    nvidia-smi --auto-boost-permission=0\n\
    dcgm-export -e ${MONITORING_INTERVAL} &\n\
    nvidia-smi dmon -s pucvmet -o T -i 0 >> /var/log/nvidia-power/power-metrics.log &" > /usr/local/bin/configure_gpu.sh

# Set up environmental impact tracking
COPY scripts/carbon_tracking.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/carbon_tracking.sh && \
    echo "#!/bin/bash\n\
    if [ \"\${CARBON_TRACKING_ENABLED}\" = \"true\" ]; then\n\
        mkdir -p /var/log/nvidia-power/carbon\n\
        while true; do\n\
            nvidia-smi --query-gpu=power.draw,temperature.gpu --format=csv,noheader >> /var/log/nvidia-power/carbon/usage.log\n\
            sleep \${MONITORING_INTERVAL}\n\
        done &\n\
    fi" > /usr/local/bin/carbon_tracking.sh

# Security hardening
RUN rm -rf /tmp/* && \
    rm -rf /var/tmp/* && \
    rm -rf /var/lib/apt/lists/* && \
    chmod 700 /usr/local/nvidia && \
    chmod 700 /var/log/nvidia-power && \
    chmod 700 /etc/nvidia-container-runtime

# Set up entrypoint
COPY scripts/entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/entrypoint.sh && \
    echo "#!/bin/bash\n\
    /usr/local/bin/configure_gpu.sh\n\
    /usr/local/bin/carbon_tracking.sh\n\
    exec \"\$@\"" > /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["nvidia-smi", "-l", "1"]

# Expose volumes for persistence
VOLUME ["/usr/local/nvidia", "/usr/local/cuda", "/var/log/nvidia-power", "/etc/nvidia-container-runtime"]