#!/bin/bash

# Provocative Cloud - Volume Backup Script
# Version: 1.0.0
# Dependencies:
# - aws-cli v2.0+
# - kubectl v1.27+
# - gpg
# - pigz (parallel gzip)

set -euo pipefail

# Global Configuration
BACKUP_BUCKET="s3://provocative-cloud-backups"
NAMESPACE="provocative-cloud"
BACKUP_RETENTION_DAYS=30
LOG_DIR="/var/log/provocative/backups"
ENCRYPTION_KEY_PATH="/etc/provocative/backup-keys"
COMPRESSION_LEVEL=9
BANDWIDTH_LIMIT="50MB/s"
MAX_PARALLEL_UPLOADS=5

# Timestamp format for backup naming
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Setup logging
mkdir -p "${LOG_DIR}"
exec 1> >(tee -a "${LOG_DIR}/backup-${TIMESTAMP}.log")
exec 2>&1

check_prerequisites() {
    local status=0

    echo "Checking prerequisites..."

    # Check required commands
    for cmd in kubectl aws gpg pigz; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            echo "ERROR: Required command not found: $cmd"
            status=1
        fi
    done

    # Verify kubectl access
    if ! kubectl auth can-i get pv -n "${NAMESPACE}" >/dev/null 2>&1; then
        echo "ERROR: Insufficient Kubernetes permissions"
        status=1
    fi

    # Check AWS S3 access
    if ! aws s3 ls "${BACKUP_BUCKET}" >/dev/null 2>&1; then
        echo "ERROR: Cannot access S3 bucket ${BACKUP_BUCKET}"
        status=1
    fi

    # Verify encryption keys
    if [ ! -r "${ENCRYPTION_KEY_PATH}/backup.key" ]; then
        echo "ERROR: Backup encryption key not found or not readable"
        status=1
    fi

    # Check available disk space (need at least 100GB free)
    if [ "$(df -BG /tmp | awk 'NR==2 {print $4}' | sed 's/G//')" -lt 100 ]; then
        echo "ERROR: Insufficient disk space for backup staging"
        status=1
    }

    return $status
}

create_backup() {
    local volume_name=$1
    local backup_type=$2
    local encryption_key=$3
    local compression_level=$4
    local status=0
    local backup_path="/tmp/${volume_name}-${TIMESTAMP}"
    local metadata_file="${backup_path}.meta"

    echo "Creating backup for volume: ${volume_name}"
    echo "Backup type: ${backup_type}"

    # Create volume snapshot
    if ! kubectl snapshot create -n "${NAMESPACE}" \
        --source="${volume_name}" \
        --name="${volume_name}-snap-${TIMESTAMP}"; then
        echo "ERROR: Failed to create snapshot for ${volume_name}"
        return 1
    fi

    # Export volume data
    if ! kubectl exec -n "${NAMESPACE}" \
        "$(kubectl get pod -n "${NAMESPACE}" -l "volume=${volume_name}" -o jsonpath='{.items[0].metadata.name}')" \
        -- tar cf - /data | pigz -${compression_level} > "${backup_path}.tar.gz"; then
        echo "ERROR: Failed to export volume data for ${volume_name}"
        status=1
    fi

    # Encrypt backup
    if ! gpg --batch --yes --encrypt \
        --recipient-file "${ENCRYPTION_KEY_PATH}/backup.key" \
        --output "${backup_path}.tar.gz.gpg" \
        "${backup_path}.tar.gz"; then
        echo "ERROR: Encryption failed for ${volume_name}"
        status=1
    fi

    # Calculate checksum
    sha256sum "${backup_path}.tar.gz.gpg" > "${backup_path}.sha256"

    # Create metadata
    cat > "${metadata_file}" <<EOF
volume_name: ${volume_name}
backup_type: ${backup_type}
timestamp: ${TIMESTAMP}
encryption: gpg
compression: pigz-${compression_level}
checksum_type: sha256
checksum_file: ${volume_name}-${TIMESTAMP}.sha256
EOF

    # Upload to S3 with bandwidth limiting
    if ! aws s3 cp "${backup_path}.tar.gz.gpg" \
        "${BACKUP_BUCKET}/${volume_name}/${TIMESTAMP}/" \
        --expected-size "$(stat -f%z "${backup_path}.tar.gz.gpg")" \
        --cli-connect-timeout 600 \
        --metadata-directive REPLACE \
        --metadata "$(cat "${metadata_file}")" \
        --quiet \
        --only-show-errors; then
        echo "ERROR: S3 upload failed for ${volume_name}"
        status=1
    fi

    # Clean up temporary files
    rm -f "${backup_path}"*

    # Delete snapshot if backup was successful
    if [ $status -eq 0 ]; then
        kubectl snapshot delete -n "${NAMESPACE}" "${volume_name}-snap-${TIMESTAMP}"
    fi

    return $status
}

cleanup_old_backups() {
    local volume_name=$1
    local cutoff_date=$(date -d "${BACKUP_RETENTION_DAYS} days ago" +%Y%m%d)

    echo "Cleaning up old backups for volume: ${volume_name}"

    # List old backups
    aws s3 ls "${BACKUP_BUCKET}/${volume_name}/" | while read -r line; do
        backup_date=$(echo "$line" | awk '{print $1}' | tr -d '-')
        if [ "${backup_date}" -lt "${cutoff_date}" ]; then
            backup_path=$(echo "$line" | awk '{print $4}')
            echo "Removing old backup: ${backup_path}"
            aws s3 rm "${BACKUP_BUCKET}/${volume_name}/${backup_path}" --recursive
        fi
    done
}

verify_backup() {
    local volume_name=$1
    local backup_timestamp=$2
    local encryption_key=$3
    local status=0
    local verify_path="/tmp/verify-${volume_name}-${backup_timestamp}"

    echo "Verifying backup: ${volume_name} from ${backup_timestamp}"

    # Download backup and checksum
    aws s3 cp "${BACKUP_BUCKET}/${volume_name}/${backup_timestamp}/${volume_name}-${backup_timestamp}.tar.gz.gpg" \
        "${verify_path}.tar.gz.gpg"
    aws s3 cp "${BACKUP_BUCKET}/${volume_name}/${backup_timestamp}/${volume_name}-${backup_timestamp}.sha256" \
        "${verify_path}.sha256"

    # Verify checksum
    if ! sha256sum -c "${verify_path}.sha256"; then
        echo "ERROR: Checksum verification failed for ${volume_name}"
        status=1
    fi

    # Test decryption
    if ! gpg --batch --yes --decrypt \
        --recipient-file "${encryption_key}" \
        --output "${verify_path}.tar.gz" \
        "${verify_path}.tar.gz.gpg"; then
        echo "ERROR: Decryption test failed for ${volume_name}"
        status=1
    fi

    # Clean up verification files
    rm -f "${verify_path}"*

    return $status
}

main() {
    local exit_status=0

    echo "Starting backup process at $(date)"

    # Check prerequisites
    if ! check_prerequisites; then
        echo "Prerequisites check failed. Aborting."
        return 1
    fi

    # Process each volume type
    for volume in "gpu-data-pv" "metrics-pv" "user-data-pv"; do
        if ! create_backup "${volume}" "full" "${ENCRYPTION_KEY_PATH}/backup.key" "${COMPRESSION_LEVEL}"; then
            echo "ERROR: Backup failed for ${volume}"
            exit_status=1
            continue
        fi

        if ! verify_backup "${volume}" "${TIMESTAMP}" "${ENCRYPTION_KEY_PATH}/backup.key"; then
            echo "ERROR: Verification failed for ${volume}"
            exit_status=1
            continue
        fi

        cleanup_old_backups "${volume}"
    done

    echo "Backup process completed at $(date) with status ${exit_status}"
    return $exit_status
}

# Execute main function
main "$@"