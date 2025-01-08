"""
Automated backup script for Provocative Cloud platform.
Handles encrypted database backups, user data backups, and system configurations
with secure offsite storage and comprehensive retention policies.

Version: 1.0.0
"""

import asyncio
import datetime
from pathlib import Path
import subprocess
import tarfile
from typing import Dict, Optional
import os
import shutil

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64

from api.config import settings, get_database_settings, get_storage_settings, get_encryption_settings
from api.utils.logger import get_logger
from db.session import SessionLocal
from infrastructure.storage import StorageManager

# Global constants
BACKUP_TYPES = {
    "FULL": "full",
    "INCREMENTAL": "incremental",
    "WAL": "wal"
}
BACKUP_RETENTION_DAYS = 30
BACKUP_PATH = Path("/tmp/backups")
COMPRESSION_LEVEL = 9
MAX_RETRIES = 3
BACKUP_TIMEOUT = 3600  # 1 hour timeout
logger = get_logger(__name__)

async def create_backup_filename(backup_type: str, metadata: Dict) -> str:
    """
    Creates standardized backup filename with timestamp and metadata.
    
    Args:
        backup_type: Type of backup (full/incremental/wal)
        metadata: Additional metadata for filename
    
    Returns:
        Formatted backup filename
    """
    timestamp = datetime.datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    base_name = f"provocative_cloud_{backup_type}_{timestamp}"
    
    # Add metadata tags to filename
    tags = [f"{k}-{v}" for k, v in metadata.items()]
    if tags:
        base_name += f"_{'_'.join(tags)}"
    
    return f"{base_name}.tar.gz.enc"

async def perform_database_backup(backup_type: str, output_path: Path, options: Dict) -> Dict:
    """
    Performs PostgreSQL database backup with monitoring and retry logic.
    
    Args:
        backup_type: Type of backup to perform
        output_path: Path to store backup file
        options: Additional backup options
    
    Returns:
        Dict containing backup status and metrics
    """
    db_settings = get_database_settings()
    start_time = datetime.datetime.utcnow()
    
    # Construct pg_dump command
    cmd = [
        "pg_dump",
        "-h", db_settings["host"],
        "-p", str(db_settings["port"]),
        "-U", db_settings["user"],
        "-d", db_settings["database"],
        "-F", "c",  # Custom format
        "-Z", str(COMPRESSION_LEVEL),
        "-v"  # Verbose output
    ]
    
    if backup_type == BACKUP_TYPES["INCREMENTAL"]:
        cmd.extend(["--exclude-table-data", "metrics"])  # Exclude time-series data
    
    cmd.extend(["-f", str(output_path)])
    
    # Set environment for pg_dump
    env = os.environ.copy()
    env["PGPASSWORD"] = db_settings["password"]
    
    for attempt in range(MAX_RETRIES):
        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            try:
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(),
                    timeout=BACKUP_TIMEOUT
                )
                
                if process.returncode == 0:
                    duration = (datetime.datetime.utcnow() - start_time).total_seconds()
                    size = output_path.stat().st_size
                    
                    return {
                        "status": "success",
                        "type": backup_type,
                        "size_bytes": size,
                        "duration_seconds": duration,
                        "compressed": True,
                        "attempt": attempt + 1
                    }
                
                raise Exception(f"pg_dump failed: {stderr.decode()}")
                
            except asyncio.TimeoutError:
                process.kill()
                if attempt < MAX_RETRIES - 1:
                    logger.warning(f"Backup timeout, attempt {attempt + 1} of {MAX_RETRIES}")
                    continue
                raise Exception("Backup timed out after all retries")
                
        except Exception as e:
            if attempt < MAX_RETRIES - 1:
                logger.warning(f"Backup attempt {attempt + 1} failed: {str(e)}")
                await asyncio.sleep(5 * (attempt + 1))  # Exponential backoff
                continue
            raise

async def backup_user_data(backup_path: Path, encryption_settings: Dict) -> Dict:
    """
    Backs up user data and configurations with encryption.
    
    Args:
        backup_path: Path to store backup
        encryption_settings: Encryption configuration
    
    Returns:
        Dict containing backup status and metrics
    """
    start_time = datetime.datetime.utcnow()
    data_path = Path("/data/user_data")
    config_path = Path("/etc/provocative")
    
    # Create temporary archive
    temp_archive = backup_path.with_suffix(".tar.gz")
    
    with tarfile.open(temp_archive, f"w:gz", compresslevel=COMPRESSION_LEVEL) as tar:
        tar.add(data_path, arcname="user_data")
        tar.add(config_path, arcname="config")
    
    # Initialize encryption
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=base64.b64decode(encryption_settings["salt"]),
        iterations=100000
    )
    key = base64.urlsafe_b64encode(kdf.derive(encryption_settings["key"].encode()))
    fernet = Fernet(key)
    
    # Encrypt archive
    with open(temp_archive, "rb") as f:
        encrypted_data = fernet.encrypt(f.read())
    
    with open(backup_path, "wb") as f:
        f.write(encrypted_data)
    
    # Cleanup and return metrics
    temp_archive.unlink()
    duration = (datetime.datetime.utcnow() - start_time).total_seconds()
    size = backup_path.stat().st_size
    
    return {
        "status": "success",
        "size_bytes": size,
        "duration_seconds": duration,
        "encrypted": True,
        "compression_level": COMPRESSION_LEVEL
    }

async def upload_backup(backup_path: Path, backup_type: str, metadata: Dict) -> Dict:
    """
    Uploads encrypted backup to S3 storage with verification.
    
    Args:
        backup_path: Path to backup file
        backup_type: Type of backup
        metadata: Backup metadata
    
    Returns:
        Dict containing upload status and metrics
    """
    start_time = datetime.datetime.utcnow()
    storage = StorageManager()
    
    # Calculate backup retention date
    retention_date = datetime.datetime.utcnow() + datetime.timedelta(days=BACKUP_RETENTION_DAYS)
    
    try:
        # Upload to S3 with metadata
        s3_path = f"backups/{backup_type}/{backup_path.name}"
        upload_result = await storage.upload_file(
            local_path=str(backup_path),
            s3_path=s3_path,
            metadata={
                **metadata,
                "backup_type": backup_type,
                "retention_date": retention_date.isoformat(),
                "sha256": storage.calculate_file_hash(backup_path)
            }
        )
        
        # Verify upload
        verification = await storage.verify_upload(s3_path, backup_path)
        
        if not verification["verified"]:
            raise Exception("Backup verification failed")
        
        duration = (datetime.datetime.utcnow() - start_time).total_seconds()
        return {
            "status": "success",
            "s3_path": s3_path,
            "size_bytes": backup_path.stat().st_size,
            "duration_seconds": duration,
            "verified": True,
            **upload_result
        }
        
    except Exception as e:
        logger.error(f"Backup upload failed: {str(e)}")
        raise

async def cleanup_old_backups() -> Dict:
    """
    Removes backups older than retention period with policy enforcement.
    
    Returns:
        Dict containing cleanup metrics
    """
    storage = StorageManager()
    start_time = datetime.datetime.utcnow()
    retention_date = datetime.datetime.utcnow() - datetime.timedelta(days=BACKUP_RETENTION_DAYS)
    
    deleted_count = 0
    saved_bytes = 0
    
    try:
        # List all backups
        backups = await storage.list_objects(prefix="backups/")
        
        for backup in backups:
            # Check retention policy
            backup_date = datetime.datetime.fromisoformat(
                backup["metadata"]["retention_date"]
            )
            
            if backup_date < retention_date:
                # Delete old backup
                await storage.delete_object(backup["key"])
                deleted_count += 1
                saved_bytes += backup["size"]
        
        duration = (datetime.datetime.utcnow() - start_time).total_seconds()
        return {
            "status": "success",
            "deleted_count": deleted_count,
            "saved_bytes": saved_bytes,
            "duration_seconds": duration
        }
        
    except Exception as e:
        logger.error(f"Backup cleanup failed: {str(e)}")
        raise

async def main(backup_type: str, options: Dict = None) -> Dict:
    """
    Main backup execution function with comprehensive error handling.
    
    Args:
        backup_type: Type of backup to perform
        options: Additional backup options
    
    Returns:
        Dict containing complete backup operation status
    """
    start_time = datetime.datetime.utcnow()
    options = options or {}
    
    try:
        # Create backup directory
        BACKUP_PATH.mkdir(parents=True, exist_ok=True)
        os.chmod(BACKUP_PATH, 0o700)  # Secure permissions
        
        # Generate backup filename and metadata
        metadata = {
            "timestamp": start_time.isoformat(),
            "version": "1.0.0",
            **options
        }
        
        filename = await create_backup_filename(backup_type, metadata)
        backup_file = BACKUP_PATH / filename
        
        # Perform backups
        db_result = await perform_database_backup(backup_type, backup_file, options)
        user_data_result = await backup_user_data(
            backup_file,
            get_encryption_settings()
        )
        
        # Upload to S3
        upload_result = await upload_backup(backup_file, backup_type, metadata)
        
        # Cleanup old backups
        cleanup_result = await cleanup_old_backups()
        
        # Cleanup temporary files
        backup_file.unlink()
        
        duration = (datetime.datetime.utcnow() - start_time).total_seconds()
        return {
            "status": "success",
            "backup_type": backup_type,
            "duration_seconds": duration,
            "database": db_result,
            "user_data": user_data_result,
            "upload": upload_result,
            "cleanup": cleanup_result
        }
        
    except Exception as e:
        logger.error(f"Backup failed: {str(e)}", exc_info=True)
        raise