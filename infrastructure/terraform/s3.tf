# AWS Provider configuration with version constraint
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# KMS key for S3 bucket encryption
resource "aws_kms_key" "s3_key" {
  description             = "KMS key for S3 bucket encryption"
  deletion_window_in_days = 7
  enable_key_rotation    = true
  multi_region          = true

  tags = {
    Name           = "Provocative S3 KMS Key"
    Environment    = var.environment
    Purpose        = "S3 Encryption"
    SecurityLevel  = "Critical"
  }
}

# KMS key alias for easier reference
resource "aws_kms_alias" "s3_key_alias" {
  name          = "alias/provocative-s3-${var.environment}"
  target_key_id = aws_kms_key.s3_key.key_id
}

# User data bucket for storing user artifacts and data
resource "aws_s3_bucket" "user_data_bucket" {
  bucket_prefix = "provocative-user-data-${var.environment}"
  force_destroy = false

  tags = {
    Name               = "Provocative User Data"
    Environment        = var.environment
    Purpose           = "User data and artifacts storage"
    SecurityLevel     = "High"
    DataClassification = "Sensitive"
  }
}

# Enable versioning for user data bucket
resource "aws_s3_bucket_versioning" "user_data_bucket_versioning" {
  bucket = aws_s3_bucket.user_data_bucket.id
  versioning_configuration {
    status     = "Enabled"
    mfa_delete = "Enabled"
  }
}

# Configure encryption for user data bucket
resource "aws_s3_bucket_server_side_encryption_configuration" "user_data_bucket_encryption" {
  bucket = aws_s3_bucket.user_data_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.s3_key.arn
    }
    bucket_key_enabled = true
  }
}

# Configure lifecycle rules for user data bucket
resource "aws_s3_bucket_lifecycle_configuration" "user_data_bucket_lifecycle" {
  bucket = aws_s3_bucket.user_data_bucket.id

  rule {
    id     = "user_data_lifecycle"
    status = "Enabled"

    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 365
      storage_class = "GLACIER"
    }

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "STANDARD_IA"
    }

    noncurrent_version_expiration {
      noncurrent_days = 365
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# Public access block for user data bucket
resource "aws_s3_bucket_public_access_block" "user_data_bucket_access" {
  bucket = aws_s3_bucket.user_data_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# System backup bucket for storing system backups and archives
resource "aws_s3_bucket" "system_backup_bucket" {
  bucket_prefix = "provocative-backups-${var.environment}"
  force_destroy = false

  tags = {
    Name               = "Provocative System Backups"
    Environment        = var.environment
    Purpose           = "System backups and archives"
    SecurityLevel     = "Critical"
    DataClassification = "Confidential"
  }
}

# Enable versioning for system backup bucket
resource "aws_s3_bucket_versioning" "system_backup_bucket_versioning" {
  bucket = aws_s3_bucket.system_backup_bucket.id
  versioning_configuration {
    status     = "Enabled"
    mfa_delete = "Enabled"
  }
}

# Configure encryption for system backup bucket
resource "aws_s3_bucket_server_side_encryption_configuration" "system_backup_bucket_encryption" {
  bucket = aws_s3_bucket.system_backup_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.s3_key.arn
    }
    bucket_key_enabled = true
  }
}

# Configure lifecycle rules for system backup bucket
resource "aws_s3_bucket_lifecycle_configuration" "system_backup_bucket_lifecycle" {
  bucket = aws_s3_bucket.system_backup_bucket.id

  rule {
    id     = "system_backup_lifecycle"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "STANDARD_IA"
    }

    noncurrent_version_expiration {
      noncurrent_days = 365
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# Public access block for system backup bucket
resource "aws_s3_bucket_public_access_block" "system_backup_bucket_access" {
  bucket = aws_s3_bucket.system_backup_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CORS configuration for user data bucket
resource "aws_s3_bucket_cors_configuration" "user_data_bucket_cors" {
  bucket = aws_s3_bucket.user_data_bucket.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE"]
    allowed_origins = ["https://*.${var.domain_name}"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}