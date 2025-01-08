# Start from our GPU-enabled base image
FROM gpu-base:latest

# Set maintainer and metadata labels
LABEL maintainer="Provocative Cloud" \
      description="GPU-enabled Jupyter notebook environment with monitoring" \
      version="1.0" \
      security.profile="hardened" \
      monitoring.enabled="true" \
      carbon.tracking="enabled"

# Set environment variables
ENV JUPYTER_ENABLE_LAB=yes \
    NB_USER=jovyan \
    NB_UID=1000 \
    NB_GID=100 \
    JUPYTER_PORT=8888 \
    GRANT_SUDO=yes \
    GPU_MONITORING_ENABLED=true \
    CARBON_TRACKING_ENABLED=true \
    POWER_MANAGEMENT_ENABLED=true \
    DEBIAN_FRONTEND=noninteractive \
    PATH=$PATH:/opt/conda/bin

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    curl \
    ca-certificates \
    sudo \
    locales \
    fonts-liberation \
    run-one \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Create jovyan user with sudo privileges
RUN echo "en_US.UTF-8 UTF-8" > /etc/locale.gen && \
    locale-gen && \
    groupadd -g ${NB_GID} jovyan && \
    useradd -m -s /bin/bash -N -u ${NB_UID} -g ${NB_GID} ${NB_USER} && \
    echo "${NB_USER} ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/${NB_USER} && \
    chmod 0440 /etc/sudoers.d/${NB_USER}

# Install Miniconda and create Python environment
RUN curl -o ~/miniconda.sh -L https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh && \
    chmod +x ~/miniconda.sh && \
    ~/miniconda.sh -b -p /opt/conda && \
    rm ~/miniconda.sh && \
    /opt/conda/bin/conda install -y python=3.10 && \
    /opt/conda/bin/conda clean -ya

# Install Python packages with specific versions
RUN pip install --no-cache-dir \
    jupyterlab==4.0.5 \
    notebook==7.0.2 \
    torch==2.0.0 \
    torchvision==0.15.0 \
    torchaudio==2.0.0 \
    tensorflow==2.13.0 \
    numpy==1.24.0 \
    pandas==2.0.0 \
    scikit-learn==1.3.0 \
    jupyterlab-gpu-monitor==1.0.0 \
    && pip cache purge

# Configure Jupyter
COPY jupyter_config.json /etc/jupyter/jupyter_config.json
RUN mkdir -p /home/${NB_USER}/.jupyter && \
    chown -R ${NB_USER}:${NB_GID} /home/${NB_USER}/.jupyter && \
    chmod 700 /home/${NB_USER}/.jupyter

# Set up monitoring and logging directories
RUN mkdir -p /var/log/jupyter \
    /var/lib/nvidia-gpu-monitoring \
    /home/${NB_USER}/work && \
    chown -R ${NB_USER}:${NB_GID} /var/log/jupyter \
    /var/lib/nvidia-gpu-monitoring \
    /home/${NB_USER}/work && \
    chmod 700 /var/log/jupyter \
    /var/lib/nvidia-gpu-monitoring

# Security hardening
RUN chmod 644 /etc/jupyter/jupyter_config.json && \
    rm -rf /tmp/* /var/tmp/* && \
    find /opt/conda -type d -exec chmod 755 {} \; && \
    find /opt/conda -type f -exec chmod 644 {} \;

# Set working directory and user
WORKDIR /home/${NB_USER}/work
USER ${NB_USER}

# Configure Jupyter extensions and GPU monitoring
RUN jupyter labextension install jupyterlab-gpu-monitor && \
    jupyter lab build && \
    jupyter lab clean && \
    rm -rf /home/${NB_USER}/.cache

# Expose volume mount points
VOLUME [ "/home/jovyan/work", \
         "/home/jovyan/.jupyter", \
         "/var/log/jupyter", \
         "/var/lib/nvidia-gpu-monitoring" ]

# Expose Jupyter port
EXPOSE ${JUPYTER_PORT}

# Set default command
CMD ["jupyter", "lab", \
     "--ip=0.0.0.0", \
     "--port=${JUPYTER_PORT}", \
     "--no-browser", \
     "--NotebookApp.token=''", \
     "--NotebookApp.password=''", \
     "--NotebookApp.allow_origin='*'", \
     "--NotebookApp.base_url=${NB_PREFIX}", \
     "--NotebookApp.trust_xheaders=True"]