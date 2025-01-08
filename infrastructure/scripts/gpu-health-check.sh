#!/bin/bash

# GPU Health Check Script for Provocative Cloud Platform
# Version: 1.0
# This script performs comprehensive health checks on GPU servers, monitoring critical metrics,
# environmental impact data, and reporting issues.

# Exit on error
set -e

# Import required Python modules for metrics collection
PYTHON_IMPORTS=$(cat << 'EOF'
from gpu_manager.metrics import GPUMetricsCollector, EnvironmentalMetricsCollector
from gpu_manager.nvidia import NvidiaGPU, initialize_nvml
import json
import sys
EOF
)

# Global constants
TEMPERATURE_THRESHOLD=80
MEMORY_THRESHOLD=95
UTILIZATION_THRESHOLD=90
PUE_THRESHOLD=1.2
CUE_THRESHOLD=0.7
CO2_CAPTURE_MIN_RATE=0.5
CHECK_INTERVAL=300
ENV_CHECK_INTERVAL=900
LOG_FILE="/var/log/provocative/gpu-health.log"
ENV_LOG_FILE="/var/log/provocative/environmental.log"
ALERT_ENDPOINT="http://localhost:9093/api/v1/alerts"

# Ensure log directories exist
mkdir -p /var/log/provocative

# Logging function
log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "$timestamp [$level] $message" >> "$LOG_FILE"
}

# Environmental metrics logging
log_environmental() {
    local message=$1
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "$timestamp [ENV] $message" >> "$ENV_LOG_FILE"
}

# Check if required tools are installed
check_dependencies() {
    local missing_deps=()
    
    # Check for jq
    if ! command -v jq &> /dev/null; then
        missing_deps+=("jq")
    fi
    
    # Check for curl
    if ! command -v curl &> /dev/null; then
        missing_deps+=("curl")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        log "ERROR" "Missing dependencies: ${missing_deps[*]}"
        exit 1
    fi
}

# Initialize NVML and metrics collection
initialize_monitoring() {
    python3 -c "$PYTHON_IMPORTS
try:
    if not initialize_nvml():
        sys.exit(1)
    sys.exit(0)
except Exception as e:
    print(str(e))
    sys.exit(1)
"
    if [ $? -ne 0 ]; then
        log "ERROR" "Failed to initialize GPU monitoring"
        exit 1
    fi
    log "INFO" "GPU monitoring initialized successfully"
}

# Check GPU temperature
check_gpu_temperature() {
    local gpu_id=$1
    local temp=$(python3 -c "$PYTHON_IMPORTS
try:
    gpu = NvidiaGPU($gpu_id)
    metrics = gpu.get_metrics()
    print(metrics['temperature'])
except Exception as e:
    print('ERROR:', str(e))
    sys.exit(1)
")
    
    if [[ $temp == ERROR* ]]; then
        log "ERROR" "Failed to get temperature for GPU $gpu_id: ${temp#ERROR: }"
        return 2
    fi
    
    if [ $(echo "$temp >= $TEMPERATURE_THRESHOLD" | bc) -eq 1 ]; then
        log "WARNING" "High temperature on GPU $gpu_id: ${temp}°C"
        return 1
    fi
    
    return 0
}

# Check environmental metrics
check_environmental_metrics() {
    local facility_id=$1
    python3 -c "$PYTHON_IMPORTS
try:
    collector = EnvironmentalMetricsCollector()
    metrics = collector.collect_metrics(0)  # Use first GPU as reference
    
    # Calculate efficiency metrics
    pue = metrics['power_usage'] / metrics['average_power'] if metrics['average_power'] > 0 else float('inf')
    carbon_efficiency = metrics['carbon_efficiency']
    
    result = {
        'pue': pue,
        'carbon_efficiency': carbon_efficiency,
        'temperature': metrics['temperature'],
        'power_usage': metrics['power_usage']
    }
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({'error': str(e)}))
    sys.exit(1)
"
}

# Check cooling efficiency
check_cooling_efficiency() {
    local facility_id=$1
    local metrics=$(check_environmental_metrics "$facility_id")
    
    if [ $? -ne 0 ]; then
        log "ERROR" "Failed to get cooling metrics for facility $facility_id"
        return 1
    fi
    
    local temperature=$(echo "$metrics" | jq -r '.temperature')
    local power_usage=$(echo "$metrics" | jq -r '.power_usage')
    local pue=$(echo "$metrics" | jq -r '.pue')
    
    # Log cooling metrics
    log_environmental "Facility $facility_id - Temperature: ${temperature}°C, Power: ${power_usage}W, PUE: $pue"
    
    if [ $(echo "$pue > $PUE_THRESHOLD" | bc) -eq 1 ]; then
        return 1
    fi
    
    return 0
}

# Send environmental alert
send_environmental_alert() {
    local metric_type=$1
    local severity=$2
    local metric_data=$3
    
    local alert_payload=$(cat << EOF
{
    "alert": {
        "type": "$metric_type",
        "severity": "$severity",
        "data": $metric_data,
        "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    }
}
EOF
)
    
    curl -s -X POST \
         -H "Content-Type: application/json" \
         -d "$alert_payload" \
         "$ALERT_ENDPOINT"
    
    return $?
}

# Main execution loop
main() {
    local last_env_check=0
    
    # Check dependencies
    check_dependencies
    
    # Initialize monitoring
    initialize_monitoring
    
    log "INFO" "Starting GPU health check service"
    
    while true; do
        current_time=$(date +%s)
        
        # Get list of GPUs
        gpu_count=$(python3 -c "$PYTHON_IMPORTS
try:
    print(len([gpu for gpu in range(10) if NvidiaGPU(gpu)]))
except:
    print(0)
")
        
        # Check each GPU
        for gpu_id in $(seq 0 $((gpu_count-1))); do
            # Check GPU temperature
            check_gpu_temperature "$gpu_id"
            temp_status=$?
            
            if [ $temp_status -eq 1 ]; then
                send_environmental_alert "temperature" "warning" "{\"gpu_id\": $gpu_id}"
            elif [ $temp_status -eq 2 ]; then
                send_environmental_alert "temperature" "critical" "{\"gpu_id\": $gpu_id}"
            fi
        done
        
        # Check environmental metrics at longer interval
        if [ $((current_time - last_env_check)) -ge $ENV_CHECK_INTERVAL ]; then
            # Check cooling efficiency
            check_cooling_efficiency "main"
            if [ $? -ne 0 ]; then
                send_environmental_alert "cooling" "warning" "{\"facility\": \"main\"}"
            fi
            
            # Get environmental metrics
            env_metrics=$(check_environmental_metrics "main")
            log_environmental "Environmental Metrics: $env_metrics"
            
            last_env_check=$current_time
        fi
        
        sleep "$CHECK_INTERVAL"
    done
}

# Start the script
main