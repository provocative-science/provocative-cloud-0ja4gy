# Environment Configuration
environment = "production"
aws_region = "us-west-2"

# Network Configuration
vpc_cidr = "10.0.0.0/16"
availability_zones = [
  "us-west-2a",
  "us-west-2b",
  "us-west-2c"
]

# GPU Infrastructure Configuration
gpu_instance_type = "p4d.24xlarge"  # 8x NVIDIA A100 GPUs
min_gpu_instances = 3  # Minimum instances for high availability
max_gpu_instances = 20  # Maximum instances for peak load

# Database Configuration
rds_instance_class = "db.r6g.2xlarge"  # High-performance instance for production workloads
rds_database_name = "provocative_prod"

# Cache Configuration
redis_node_type = "cache.r6g.2xlarge"  # High-memory cache nodes
redis_num_cache_nodes = 3  # Multi-AZ deployment for HA

# Container Host Configuration
ecs_instance_type = "c6g.4xlarge"  # Compute-optimized for container workloads

# Domain Configuration
domain_name = "provocative.cloud"

# Monitoring Configuration
enable_monitoring = true

# Additional Production-specific Settings
tags = {
  Environment     = "production"
  ManagedBy      = "terraform"
  ServiceTier    = "premium"
  BackupEnabled  = "true"
  MonitoringTier = "enhanced"
}

# High Availability Settings
multi_az_enabled = true
backup_retention_period = 30
auto_minor_version_upgrade = true
deletion_protection = true

# Performance Settings
performance_insights_enabled = true
monitoring_interval = 1  # Enhanced monitoring in seconds
alarm_cpu_threshold = 75
alarm_memory_threshold = 75

# Security Settings
ssl_enforcement = "enabled"
log_retention_days = 90
enable_encryption = true
enable_cloudtrail = true

# Scaling Configuration
cpu_utilization_threshold = 70
memory_utilization_threshold = 75
target_gpu_utilization = 80

# Backup Configuration
backup_window = "03:00-05:00"
maintenance_window = "Mon:05:00-Mon:07:00"

# Network Settings
private_subnet_tags = {
  Tier = "private"
  Role = "application"
}

public_subnet_tags = {
  Tier = "public"
  Role = "frontend"
}

# Enhanced Monitoring Settings
detailed_monitoring_enabled = true
create_monitoring_role = true
monitoring_role_name = "provocative-enhanced-monitoring-role"

# Load Balancer Settings
enable_cross_zone_load_balancing = true
enable_deletion_protection = true
enable_http2 = true
idle_timeout = 60

# WAF Configuration
enable_waf = true
waf_block_mode = "COUNT"  # Initially in monitoring mode