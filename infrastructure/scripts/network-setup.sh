#!/bin/bash

# Network Setup Script for Provocative Cloud Platform
# Version: 1.0
# This script sets up and configures secure network infrastructure including
# firewall rules, VPN access, network isolation, QoS policies, and monitoring

# External dependencies:
# - ansible-core v2.15+
# - prometheus_client v0.17+

set -euo pipefail

# Global variables
ANSIBLE_CONFIG="/etc/ansible/ansible.cfg"
INVENTORY_FILE="infrastructure/ansible/inventory.yml"
PLAYBOOK_FILE="infrastructure/ansible/playbooks/network-setup.yml"
ENV_PLAYBOOK_FILE="infrastructure/ansible/playbooks/environmental-setup.yml"
LOG_FILE="/var/log/provocative/network-setup.log"
METRICS_FILE="/var/log/provocative/environmental-metrics.log"

# Function to check prerequisites
check_prerequisites() {
    echo "Checking prerequisites..."
    
    # Check if running as root
    if [[ $EUID -ne 0 ]]; then
        echo "Error: This script must be run as root" >&2
        return 1
    }

    # Check for ansible installation
    if ! command -v ansible-playbook &> /dev/null; then
        echo "Error: ansible-playbook is not installed" >&2
        return 1
    }

    # Verify ansible files exist
    if [[ ! -f "$INVENTORY_FILE" ]]; then
        echo "Error: Ansible inventory file not found at $INVENTORY_FILE" >&2
        return 1
    }

    if [[ ! -f "$PLAYBOOK_FILE" ]]; then
        echo "Error: Network playbook not found at $PLAYBOOK_FILE" >&2
        return 1
    }

    # Check log directory
    if [[ ! -d $(dirname "$LOG_FILE") ]]; then
        mkdir -p "$(dirname "$LOG_FILE")"
    }

    # Verify environmental systems connectivity
    if ! nc -z localhost 9090 &>/dev/null; then
        echo "Warning: Environmental metrics collector not available on port 9090" >&2
    }

    return 0
}

# Function to set up logging
setup_logging() {
    echo "Setting up logging..."
    
    # Create log directory if it doesn't exist
    mkdir -p "$(dirname "$LOG_FILE")" "$(dirname "$METRICS_FILE")"
    
    # Initialize log files with timestamp
    echo "=== Network Setup Log - $(date) ===" > "$LOG_FILE"
    echo "=== Environmental Metrics Log - $(date) ===" > "$METRICS_FILE"
    
    # Set up log rotation
    cat > /etc/logrotate.d/provocative-network << EOF
$LOG_FILE $METRICS_FILE {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0640 root root
}
EOF

    return 0
}

# Function to run network setup
run_network_setup() {
    echo "Running network setup..."
    
    # Execute network setup playbook
    if ! ansible-playbook -i "$INVENTORY_FILE" "$PLAYBOOK_FILE" --extra-vars "env=production" >> "$LOG_FILE" 2>&1; then
        echo "Error: Network setup playbook failed" >&2
        return 1
    }

    # Execute environmental setup playbook
    if ! ansible-playbook -i "$INVENTORY_FILE" "$ENV_PLAYBOOK_FILE" --extra-vars "env=production" >> "$LOG_FILE" 2>&1; then
        echo "Error: Environmental setup playbook failed" >&2
        return 1
    }

    return 0
}

# Function to verify network configuration
verify_network_config() {
    echo "Verifying network configuration..."
    local status=0

    # Check firewall status
    if ! ufw status | grep -q "Status: active"; then
        echo "Error: Firewall is not active" >&2
        status=1
    }

    # Verify VPN configuration
    if ! systemctl is-active --quiet wg-quick@wg0; then
        echo "Error: WireGuard VPN is not active" >&2
        status=1
    }

    # Test network isolation
    if ! ovs-vsctl show | grep -q "Bridge br0"; then
        echo "Error: Network isolation bridge not configured" >&2
        status=1
    }

    # Validate QoS policies
    if ! tc qdisc show | grep -q "htb"; then
        echo "Error: QoS policies not applied" >&2
        status=1
    }

    # Check monitoring setup
    if ! curl -s http://localhost:9090/-/healthy &>/dev/null; then
        echo "Error: Prometheus monitoring not healthy" >&2
        status=1
    }

    # Verify environmental metrics collection
    if ! curl -s http://localhost:9090/metrics | grep -q "carbon_capture"; then
        echo "Warning: Environmental metrics collection not detected" >&2
    }

    return $status
}

# Function to perform cleanup
cleanup() {
    echo "Performing cleanup..."
    
    # Remove temporary files
    find /tmp -name "network-setup-*" -type f -mtime +1 -delete
    
    # Rotate logs if needed
    if [[ -f "$LOG_FILE" && $(stat -f %z "$LOG_FILE") -gt 104857600 ]]; then
        logrotate -f /etc/logrotate.d/provocative-network
    fi
    
    # Archive initial metrics
    if [[ -f "$METRICS_FILE" ]]; then
        gzip -c "$METRICS_FILE" > "${METRICS_FILE}.$(date +%Y%m%d).gz"
    fi

    return 0
}

# Main execution
main() {
    echo "Starting network setup for Provocative Cloud..."
    
    # Run prerequisite checks
    if ! check_prerequisites; then
        echo "Failed prerequisite checks" >&2
        exit 1
    }

    # Initialize logging
    if ! setup_logging; then
        echo "Failed to set up logging" >&2
        exit 1
    }

    # Run network setup
    if ! run_network_setup; then
        echo "Network setup failed" >&2
        exit 1
    }

    # Verify configuration
    if ! verify_network_config; then
        echo "Network verification failed" >&2
        exit 1
    }

    # Perform cleanup
    if ! cleanup; then
        echo "Cleanup failed" >&2
        exit 1
    }

    echo "Network setup completed successfully"
    return 0
}

# Execute main function
main "$@"