# Configure AWS provider with version constraint
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Create DB subnet group for RDS instance placement
resource "aws_db_subnet_group" "db_subnet_group" {
  name        = "${var.environment}-db-subnet-group"
  description = "Subnet group for RDS PostgreSQL instances"
  subnet_ids  = data.terraform_remote_state.vpc.outputs.private_subnet_ids

  tags = {
    Name        = "${var.environment}-db-subnet-group"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# Create enhanced parameter group for PostgreSQL configuration
resource "aws_db_parameter_group" "db_parameter_group" {
  name   = "${var.environment}-db-params"
  family = "postgres15"

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  parameter {
    name  = "log_statement"
    value = "ddl"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }

  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements"
  }

  parameter {
    name  = "track_io_timing"
    value = "1"
  }

  parameter {
    name  = "max_connections"
    value = "500"
  }

  tags = {
    Name        = "${var.environment}-db-params"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# Create IAM role for enhanced RDS monitoring
resource "aws_iam_role" "monitoring_role" {
  name = "${var.environment}-rds-monitoring-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  managed_policy_arns = ["arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"]

  tags = {
    Name        = "${var.environment}-rds-monitoring-role"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# Create AWS Secrets Manager secret for database password
resource "aws_secretsmanager_secret" "db_password" {
  name = "${var.environment}/rds/master-password"
  
  tags = {
    Name        = "${var.environment}-db-password"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# Generate random password for RDS instance
resource "random_password" "master_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# Store generated password in Secrets Manager
resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = random_password.master_password.result
}

# Create main RDS PostgreSQL instance
resource "aws_db_instance" "db_instance" {
  identifier = "${var.environment}-provocative-db"
  
  # Engine configuration
  engine         = "postgres"
  engine_version = "15.4"
  
  # Instance configuration
  instance_class        = var.rds_instance_class
  allocated_storage     = 100
  max_allocated_storage = 1000
  
  # Database configuration
  db_name  = var.rds_database_name
  username = "admin"
  password = aws_secretsmanager_secret_version.db_password.secret_string
  
  # Network configuration
  db_subnet_group_name   = aws_db_subnet_group.db_subnet_group.name
  vpc_security_group_ids = [data.terraform_remote_state.security_groups.outputs.rds_security_group_id]
  parameter_group_name   = aws_db_parameter_group.db_parameter_group.name
  
  # High availability configuration
  multi_az = true
  
  # Storage configuration
  storage_encrypted = true
  
  # Backup configuration
  backup_retention_period = 30
  backup_window          = "03:00-04:00"
  maintenance_window     = "Mon:04:00-Mon:05:00"
  
  # Version management
  auto_minor_version_upgrade = true
  
  # Protection
  deletion_protection = true
  skip_final_snapshot = false
  final_snapshot_identifier = "${var.environment}-provocative-db-final"
  
  # Monitoring configuration
  performance_insights_enabled          = true
  performance_insights_retention_period = 7
  monitoring_interval                   = 1
  monitoring_role_arn                  = aws_iam_role.monitoring_role.arn
  enabled_cloudwatch_logs_exports      = ["postgresql", "upgrade"]
  
  # Snapshot configuration
  copy_tags_to_snapshot = true
  
  tags = {
    Name        = "${var.environment}-provocative-db"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# Output values for use in other Terraform configurations
output "db_endpoint" {
  description = "RDS instance endpoint"
  value       = aws_db_instance.db_instance.endpoint
}

output "db_name" {
  description = "Name of the created database"
  value       = aws_db_instance.db_instance.db_name
}

output "db_secret_arn" {
  description = "ARN of the database password secret"
  value       = aws_secretsmanager_secret.db_password.arn
}

output "monitoring_role_arn" {
  description = "ARN of the RDS monitoring IAM role"
  value       = aws_iam_role.monitoring_role.arn
}