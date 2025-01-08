#!/bin/bash

# Metrics Collector Script for Provocative Cloud
# Version: 1.0.0
# Collects GPU metrics and environmental data with Prometheus integration

# External dependencies:
# - prometheus-node-exporter v1.5.0
# - nvidia-drivers v12.0+

# Set strict error handling
set -euo pipefail
trap 'error_handler $? $LINENO $BASH_LINENO "$BASH_COMMAND" $(printf "::%s" ${FUNCNAME[@]:-})' ERR

# Global Configuration
METRICS_COLLECTION_INTERVAL=60
METRICS_RETENTION_PERIOD=2592000
TEMPERATURE_ALERT_THRESHOLD=80.0
MEMORY_ALERT_THRESHOLD=0.95
UTILIZATION_ALERT_THRESHOLD=0.90
CARBON_INTENSITY_FACTOR=0.475
PUE_TARGET=1.2
CO2_CAPTURE_EFFICIENCY=0.50
COOLING_POWER_RATIO=0.30
ENVIRONMENTAL_METRICS_INTERVAL=300
LOG_DIR="/var/log/provocative/metrics"
METRICS_EXPORT_PORT=9100
METRICS_BATCH_SIZE=100
RETRY_ATTEMPTS=3
RETRY_DELAY=5

# Ensure log directory exists
mkdir -p "${LOG_DIR}"

# Error handler function
error_handler() {
    local exit_code=$1
    local line_no=$2
    local bash_lineno=$3
    local last_command=$4
    local func_stack=$5
    
    echo "Error occurred in ${func_stack} at line ${line_no}" >> "${LOG_DIR}/error.log"
    echo "Command: ${last_command}" >> "${LOG_DIR}/error.log"
    echo "Exit code: ${exit_code}" >> "${LOG_DIR}/error.log"
    
    # Attempt cleanup
    cleanup
    exit "${exit_code}"
}

# Initialization check
init_checks() {
    # Check NVIDIA driver installation
    if ! command -v nvidia-smi &> /dev/null; then
        echo "ERROR: nvidia-smi not found. Please install NVIDIA drivers." >&2
        exit 1
    fi
    
    # Check Prometheus node exporter
    if ! command -v node_exporter &> /dev/null; then
        echo "ERROR: node_exporter not found. Please install prometheus-node-exporter." >&2
        exit 1
    }
    
    # Create metrics directory structure
    mkdir -p "${LOG_DIR}/gpu_metrics"
    mkdir -p "${LOG_DIR}/environmental_metrics"
}

# Collect GPU metrics
collect_metrics() {
    local timestamp
    timestamp=$(date +%s)
    local metrics_file="${LOG_DIR}/gpu_metrics/metrics_${timestamp}.json"
    
    # Collect GPU metrics using nvidia-smi
    nvidia-smi --query-gpu=timestamp,uuid,name,temperature.gpu,utilization.gpu,utilization.memory,memory.total,memory.used,power.draw,power.limit \
               --format=csv,noheader,nounits > "${metrics_file}.tmp"
    
    # Process metrics and add environmental data
    while IFS=, read -r timestamp uuid name temp util mem_util mem_total mem_used power_draw power_limit; do
        # Calculate environmental metrics
        local power_efficiency=$(echo "scale=2; 1 - ${power_draw}/${power_limit}" | bc)
        local thermal_efficiency=$(echo "scale=2; 1 - ${temp}/${TEMPERATURE_ALERT_THRESHOLD}" | bc)
        local co2_impact=$(echo "scale=2; ${power_draw} * ${CARBON_INTENSITY_FACTOR} / 1000" | bc)
        local co2_captured=$(echo "scale=2; ${co2_impact} * ${CO2_CAPTURE_EFFICIENCY}" | bc)
        
        # Format metrics for Prometheus
        {
            echo "# HELP gpu_temperature_celsius GPU temperature in Celsius"
            echo "# TYPE gpu_temperature_celsius gauge"
            echo "gpu_temperature_celsius{uuid=\"${uuid}\",name=\"${name}\"} ${temp}"
            
            echo "# HELP gpu_utilization_ratio GPU utilization ratio"
            echo "# TYPE gpu_utilization_ratio gauge"
            echo "gpu_utilization_ratio{uuid=\"${uuid}\",name=\"${name}\"} ${util}"
            
            echo "# HELP gpu_memory_used_bytes GPU memory used in bytes"
            echo "# TYPE gpu_memory_used_bytes gauge"
            echo "gpu_memory_used_bytes{uuid=\"${uuid}\",name=\"${name}\"} ${mem_used}"
            
            echo "# HELP gpu_power_draw_watts GPU power consumption in watts"
            echo "# TYPE gpu_power_draw_watts gauge"
            echo "gpu_power_draw_watts{uuid=\"${uuid}\",name=\"${name}\"} ${power_draw}"
            
            echo "# HELP gpu_carbon_impact_kg GPU carbon impact in kg CO2"
            echo "# TYPE gpu_carbon_impact_kg gauge"
            echo "gpu_carbon_impact_kg{uuid=\"${uuid}\",name=\"${name}\"} ${co2_impact}"
            
            echo "# HELP gpu_co2_captured_kg CO2 captured from GPU cooling in kg"
            echo "# TYPE gpu_co2_captured_kg counter"
            echo "gpu_co2_captured_kg{uuid=\"${uuid}\",name=\"${name}\"} ${co2_captured}"
            
            echo "# HELP gpu_power_efficiency_ratio GPU power efficiency ratio"
            echo "# TYPE gpu_power_efficiency_ratio gauge"
            echo "gpu_power_efficiency_ratio{uuid=\"${uuid}\",name=\"${name}\"} ${power_efficiency}"
            
            echo "# HELP gpu_thermal_efficiency_ratio GPU thermal efficiency ratio"
            echo "# TYPE gpu_thermal_efficiency_ratio gauge"
            echo "gpu_thermal_efficiency_ratio{uuid=\"${uuid}\",name=\"${name}\"} ${thermal_efficiency}"
        } >> "${metrics_file}"
        
        # Check for alerts
        check_alerts "${uuid}" "${temp}" "${util}" "${mem_util}" "${power_efficiency}"
        
    done < "${metrics_file}.tmp"
    
    rm "${metrics_file}.tmp"
    export_metrics "${metrics_file}"
}

# Export metrics to Prometheus node exporter
export_metrics() {
    local metrics_file=$1
    local textfile_dir="/var/lib/node_exporter/textfile_collector"
    
    # Ensure textfile collector directory exists
    mkdir -p "${textfile_dir}"
    
    # Export metrics in batches
    split -l "${METRICS_BATCH_SIZE}" "${metrics_file}" "${textfile_dir}/gpu_metrics_"
    
    # Atomic update of metrics file
    for batch in "${textfile_dir}"/gpu_metrics_*; do
        mv "${batch}" "${batch}.prom.$$"
        mv "${batch}.prom.$$" "${batch}.prom"
    done
}

# Check metrics against thresholds
check_alerts() {
    local uuid=$1
    local temp=$2
    local util=$3
    local mem_util=$4
    local power_efficiency=$5
    local alert_file="${LOG_DIR}/alerts.log"
    
    # Temperature alert
    if (( $(echo "${temp} > ${TEMPERATURE_ALERT_THRESHOLD}" | bc -l) )); then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ALERT: High temperature ${temp}°C for GPU ${uuid}" >> "${alert_file}"
    fi
    
    # Utilization alert
    if (( $(echo "${util} > ${UTILIZATION_ALERT_THRESHOLD} * 100" | bc -l) )); then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ALERT: High utilization ${util}% for GPU ${uuid}" >> "${alert_file}"
    fi
    
    # Memory alert
    if (( $(echo "${mem_util} > ${MEMORY_ALERT_THRESHOLD} * 100" | bc -l) )); then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ALERT: High memory utilization ${mem_util}% for GPU ${uuid}" >> "${alert_file}"
    fi
    
    # Efficiency alert
    if (( $(echo "${power_efficiency} < 0.7" | bc -l) )); then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ALERT: Low power efficiency ${power_efficiency} for GPU ${uuid}" >> "${alert_file}"
    fi
}

# Calculate environmental impact metrics
calculate_environmental_metrics() {
    local power_consumption=$1
    local cooling_power=$2
    local co2_captured=$3
    
    # Calculate PUE
    local pue=$(echo "scale=2; (${power_consumption} + ${cooling_power}) / ${power_consumption}" | bc)
    
    # Calculate total CO2 emissions
    local total_emissions=$(echo "scale=2; (${power_consumption} + ${cooling_power}) * ${CARBON_INTENSITY_FACTOR}" | bc)
    
    # Calculate net environmental impact
    local net_impact=$(echo "scale=2; ${total_emissions} - ${co2_captured}" | bc)
    
    echo "${pue},${total_emissions},${net_impact}"
}

# Cleanup function
cleanup() {
    # Remove temporary files
    find "${LOG_DIR}" -name "*.tmp" -type f -delete
    
    # Archive old metrics
    find "${LOG_DIR}" -type f -mtime +30 -exec gzip {} \;
    
    # Rotate logs
    if command -v logrotate &> /dev/null; then
        logrotate -f /etc/logrotate.d/provocative-metrics
    fi
}

# Main execution loop
main() {
    init_checks
    
    echo "Starting Provocative Cloud metrics collector..."
    
    while true; do
        collect_metrics
        
        # Environmental metrics collection (every 5 minutes)
        if (( SECONDS % ENVIRONMENTAL_METRICS_INTERVAL == 0 )); then
            local power_data=$(nvidia-smi --query-gpu=power.draw --format=csv,noheader,nounits)
            local total_power=0
            for power in ${power_data}; do
                total_power=$(echo "${total_power} + ${power}" | bc)
            done
            
            local cooling_power=$(echo "${total_power} * ${COOLING_POWER_RATIO}" | bc)
            local co2_captured=$(echo "${cooling_power} * ${CO2_CAPTURE_EFFICIENCY} * ${CARBON_INTENSITY_FACTOR}" | bc)
            
            calculate_environmental_metrics "${total_power}" "${cooling_power}" "${co2_captured}" >> "${LOG_DIR}/environmental_metrics/impact_$(date +%s).csv"
        fi
        
        sleep "${METRICS_COLLECTION_INTERVAL}"
    done
}

# Start the collector
main