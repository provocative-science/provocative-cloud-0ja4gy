# Environment Identification
environment = "staging"
aws_region = "us-west-2"

# Network Configuration
vpc_cidr = "10.1.0.0/16"
availability_zones = ["us-west-2a", "us-west-2b"]

# GPU Instance Configuration
gpu_instance_type = "g4dn.xlarge"
min_gpu_instances = 1
max_gpu_instances = 3
enable_spot_instances = true

# Database Configuration
rds_instance_class = "db.t4g.large"
rds_database_name = "provocative_staging"
backup_retention_days = 7

# Cache Configuration
redis_node_type = "cache.t4g.medium"
redis_num_cache_nodes = 2

# Container Hosting
ecs_instance_type = "t4g.large"

# Domain Configuration
domain_name = "staging.provocative.cloud"

# Monitoring and Operations
enable_monitoring = true
detailed_monitoring_enabled = true
auto_shutdown_enabled = true

# Tags
tags = {
  Environment = "staging"
  Project     = "provocative-cloud"
  ManagedBy   = "terraform"
  CostCenter  = "staging-ops"
}

# Security Groups
allow_ssh_cidrs = ["10.0.0.0/8"]
allow_https_cidrs = ["0.0.0.0/0"]

# Scaling Configuration
scaling_config = {
  cpu_threshold    = 70
  memory_threshold = 80
  scale_in_cooldown  = 300
  scale_out_cooldown = 180
}

# Backup Configuration
backup_config = {
  retention_days = 7
  backup_window = "03:00-04:00"
  maintenance_window = "Mon:04:00-Mon:05:00"
}

# Monitoring Configuration
monitoring_config = {
  metrics_granularity = "1m"
  log_retention_days  = 30
  alarm_email        = "staging-alerts@provocative.cloud"
}

# Cost Optimization
cost_optimization = {
  spot_bid_percentage = 70
  auto_shutdown_utc   = "0 20 * * *"  # 8PM UTC
  auto_startup_utc    = "0 12 * * *"  # 12PM UTC
}

# Performance Configuration
performance_config = {
  rds_max_connections = 500
  redis_maxmemory_percent = 75
  api_rate_limit = 1000
}

# High Availability
ha_config = {
  multi_az_rds = true
  multi_az_redis = true
  failover_timeout = 60
}

# Storage Configuration
storage_config = {
  ebs_volume_type = "gp3"
  ebs_volume_size = 100
  ebs_iops = 3000
  ebs_throughput = 125
}

# Network Configuration
network_config = {
  private_subnet_cidrs = ["10.1.1.0/24", "10.1.2.0/24"]
  public_subnet_cidrs  = ["10.1.10.0/24", "10.1.11.0/24"]
  nat_gateway_count    = 2
}

# SSL/TLS Configuration
ssl_config = {
  certificate_arn = "arn:aws:acm:us-west-2:123456789012:certificate/staging-cert"
  ssl_policy      = "ELBSecurityPolicy-TLS-1-2-2017-01"
}

# Logging Configuration
logging_config = {
  cloudwatch_log_groups = ["api", "gpu", "monitoring"]
  retention_in_days     = 30
  enable_audit_logs     = true
}