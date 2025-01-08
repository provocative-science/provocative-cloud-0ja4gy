# Environment Configuration
variable "environment" {
  type        = string
  description = "Deployment environment (staging/production) determining resource allocation strategy and redundancy levels"
  validation {
    condition     = can(regex("^(staging|production)$", var.environment))
    error_message = "Environment must be either staging or production"
  }
}

# Region Configuration
variable "aws_region" {
  type        = string
  description = "AWS region for resource deployment, must support required GPU instance types and offer multiple availability zones"
  default     = "us-west-2"
  validation {
    condition     = contains(["us-west-2", "us-east-1", "eu-west-1"], var.aws_region)
    error_message = "Region must be one that supports p4d.24xlarge GPU instances"
  }
}

# Network Configuration
variable "vpc_cidr" {
  type        = string
  description = "CIDR block for VPC with sufficient address space for all components including GPU servers, databases, and caching layers"
  default     = "10.0.0.0/16"
  validation {
    condition     = can(cidrhost(var.vpc_cidr, 32))
    error_message = "VPC CIDR must be valid and allow at least 32 subnets"
  }
}

variable "availability_zones" {
  type        = list(string)
  description = "List of availability zones for high availability deployment, minimum of 3 zones required for production"
  default     = ["us-west-2a", "us-west-2b", "us-west-2c"]
  validation {
    condition     = length(var.availability_zones) >= 3
    error_message = "At least 3 availability zones required for high availability"
  }
}

# GPU Instance Configuration
variable "gpu_instance_type" {
  type        = string
  description = "EC2 instance type for GPU servers, must be NVIDIA A100 compatible for AI/ML workloads"
  default     = "p4d.24xlarge"
  validation {
    condition     = contains(["p4d.24xlarge", "p3.16xlarge"], var.gpu_instance_type)
    error_message = "Must use supported GPU instance types"
  }
}

variable "min_gpu_instances" {
  type        = number
  description = "Minimum number of GPU instances for baseline availability"
  default     = 1
  validation {
    condition     = var.min_gpu_instances >= 1
    error_message = "Must maintain at least one GPU instance"
  }
}

variable "max_gpu_instances" {
  type        = number
  description = "Maximum number of GPU instances for peak load handling"
  default     = 10
  validation {
    condition     = var.max_gpu_instances >= var.min_gpu_instances
    error_message = "Maximum instances must be greater than or equal to minimum instances"
  }
}

# Database Configuration
variable "rds_instance_class" {
  type        = string
  description = "RDS instance class for PostgreSQL database with high memory for GPU metadata and user data"
  default     = "db.r6g.xlarge"
  validation {
    condition     = can(regex("^db\\.(r6g|r6gd)\\.(xlarge|2xlarge|4xlarge)$", var.rds_instance_class))
    error_message = "Must use r6g or r6gd instance class for optimal performance"
  }
}

variable "rds_database_name" {
  type        = string
  description = "Name of the PostgreSQL database for application data"
  default     = "provocative"
  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9_]{0,62}$", var.rds_database_name))
    error_message = "Database name must be valid PostgreSQL identifier"
  }
}

# Cache Configuration
variable "redis_node_type" {
  type        = string
  description = "ElastiCache node type for Redis, optimized for session management and real-time metrics"
  default     = "cache.r6g.xlarge"
  validation {
    condition     = can(regex("^cache\\.(r6g|r6gd)\\.(large|xlarge|2xlarge)$", var.redis_node_type))
    error_message = "Must use r6g or r6gd cache node type"
  }
}

variable "redis_num_cache_nodes" {
  type        = number
  description = "Number of cache nodes in Redis cluster for high availability"
  default     = 2
  validation {
    condition     = var.redis_num_cache_nodes >= 2
    error_message = "Must have at least 2 cache nodes for redundancy"
  }
}

# Container Host Configuration
variable "ecs_instance_type" {
  type        = string
  description = "EC2 instance type for ECS container hosts running auxiliary services"
  default     = "c6g.2xlarge"
  validation {
    condition     = can(regex("^c6g\\.(large|xlarge|2xlarge|4xlarge)$", var.ecs_instance_type))
    error_message = "Must use c6g instance type for container hosts"
  }
}

# Domain Configuration
variable "domain_name" {
  type        = string
  description = "Domain name for the application with SSL/TLS termination"
  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]\\.[a-z]{2,}$", var.domain_name))
    error_message = "Domain name must be a valid domain name format"
  }
}

# Monitoring Configuration
variable "enable_monitoring" {
  type        = bool
  description = "Enable enhanced monitoring and logging for comprehensive system observability"
  default     = true
}