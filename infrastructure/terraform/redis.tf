# Configure AWS provider with version constraint
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Redis subnet group for multi-AZ deployment
resource "aws_elasticache_subnet_group" "redis_subnet_group" {
  name       = "${var.environment}-redis-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name        = "${var.environment}-redis-subnet-group"
    Environment = var.environment
    Service     = "provocative-cloud"
    ManagedBy   = "terraform"
  }
}

# Redis parameter group with optimized settings
resource "aws_elasticache_parameter_group" "redis_parameter_group" {
  family      = "redis7.0"
  name        = "${var.environment}-redis-params"
  description = "Redis parameter group for Provocative Cloud caching and real-time data"

  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  parameter {
    name  = "notify-keyspace-events"
    value = "Ex"
  }

  parameter {
    name  = "timeout"
    value = "300"
  }

  parameter {
    name  = "tcp-keepalive"
    value = "300"
  }

  tags = {
    Name        = "${var.environment}-redis-params"
    Environment = var.environment
    Service     = "provocative-cloud"
    ManagedBy   = "terraform"
  }
}

# High-availability Redis cluster
resource "aws_elasticache_cluster" "redis_cluster" {
  cluster_id           = "${var.environment}-redis"
  engine              = "redis"
  engine_version      = "7.0"
  node_type           = var.redis_node_type
  num_cache_nodes     = var.redis_num_cache_nodes
  parameter_group_name = aws_elasticache_parameter_group.redis_parameter_group.name
  subnet_group_name    = aws_elasticache_subnet_group.redis_subnet_group.name
  security_group_ids   = [var.redis_security_group_id]
  port                = 6379

  maintenance_window    = "sun:05:00-sun:09:00"
  snapshot_window      = "00:00-04:00"
  snapshot_retention_limit = 7

  automatic_failover_enabled = true
  multi_az_enabled          = true
  apply_immediately         = true

  tags = {
    Name        = "${var.environment}-redis"
    Environment = var.environment
    Service     = "provocative-cloud"
    ManagedBy   = "terraform"
  }
}

# Output the Redis endpoint for application configuration
output "redis_endpoint" {
  description = "Primary endpoint for Redis cluster access"
  value       = aws_elasticache_cluster.redis_cluster.cache_nodes[0].address
}

# Output the Redis port for application configuration
output "redis_port" {
  description = "Port number for Redis cluster connections"
  value       = aws_elasticache_cluster.redis_cluster.port
}

# Output the full Redis connection string
output "redis_connection_string" {
  description = "Full connection string for Redis cluster"
  value       = "redis://${aws_elasticache_cluster.redis_cluster.cache_nodes[0].address}:${aws_elasticache_cluster.redis_cluster.port}"
}