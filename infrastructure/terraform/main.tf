# Configure Terraform settings and required providers
terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
  }

  backend "s3" {
    bucket         = "provocative-cloud-terraform-state"
    key            = "infrastructure/terraform.tfstate"
    region         = "us-west-2"
    encrypt        = true
    dynamodb_table = "provocative-cloud-terraform-locks"
  }
}

# Configure AWS Provider
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = var.environment
      Project     = "Provocative Cloud"
      ManagedBy   = "Terraform"
    }
  }
}

# VPC Module for networking infrastructure
module "vpc" {
  source = "./vpc"

  environment         = var.environment
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones
  enable_nat_gateway = true
  single_nat_gateway = false
  enable_dns_hostnames = true

  tags = {
    Purpose = "GPU Rental Platform"
  }
}

# RDS Module for PostgreSQL database
module "rds" {
  source = "./rds"

  environment              = var.environment
  vpc_id                  = module.vpc.vpc_id
  subnet_ids              = module.vpc.private_subnet_ids
  instance_class          = var.rds_instance_class
  database_name           = var.rds_database_name
  multi_az               = true
  backup_retention_period = 7
  deletion_protection    = true

  depends_on = [module.vpc]
}

# Redis Module for caching and real-time data
module "redis" {
  source = "./redis"

  environment                = var.environment
  vpc_id                    = module.vpc.vpc_id
  subnet_ids                = module.vpc.private_subnet_ids
  node_type                = var.redis_node_type
  num_cache_nodes          = var.redis_num_cache_nodes
  automatic_failover_enabled = true
  multi_az_enabled         = true

  depends_on = [module.vpc]
}

# GPU Cluster Module for compute resources
module "gpu_cluster" {
  source = "./gpu_cluster"

  environment          = var.environment
  vpc_id              = module.vpc.vpc_id
  subnet_ids          = module.vpc.private_subnet_ids
  instance_type       = var.gpu_instance_type
  min_instances       = var.min_gpu_instances
  max_instances       = var.max_gpu_instances
  monitoring_enabled  = true
  detailed_monitoring = true
  carbon_metrics_enabled = true

  depends_on = [module.vpc, module.rds]
}

# CloudWatch Dashboard for monitoring
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.environment}-provocative-cloud"

  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        properties = {
          metrics = [
            ["GPU Cluster", "GPUUtilization", "Environment", var.environment],
            ["GPU Cluster", "MemoryUtilization", "Environment", var.environment]
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
          title  = "GPU Utilization"
        }
      },
      {
        type = "metric"
        properties = {
          metrics = [
            ["Carbon Metrics", "CO2Captured", "Environment", var.environment],
            ["Carbon Metrics", "CoolingEfficiency", "Environment", var.environment]
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
          title  = "Environmental Impact"
        }
      }
    ]
  })
}

# Output important infrastructure values
output "infrastructure_outputs" {
  value = {
    vpc_id             = module.vpc.vpc_id
    public_subnet_ids  = module.vpc.public_subnet_ids
    private_subnet_ids = module.vpc.private_subnet_ids
    rds_endpoint      = module.rds.endpoint
    redis_endpoint    = module.redis.endpoint
    gpu_cluster_ips   = module.gpu_cluster.instance_ips
  }

  description = "Infrastructure endpoints and IDs for application configuration"
}

# Random string for unique resource naming
resource "random_string" "suffix" {
  length  = 8
  special = false
  upper   = false
}

# CloudWatch Log Group for application logs
resource "aws_cloudwatch_log_group" "application_logs" {
  name              = "/provocative-cloud/${var.environment}/application"
  retention_in_days = 30

  tags = {
    Environment = var.environment
    Purpose     = "Application Logging"
  }
}

# S3 Bucket for application artifacts
resource "aws_s3_bucket" "artifacts" {
  bucket = "provocative-cloud-${var.environment}-artifacts-${random_string.suffix.result}"

  tags = {
    Environment = var.environment
    Purpose     = "Application Artifacts"
  }
}

resource "aws_s3_bucket_versioning" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Route53 DNS Zone
resource "aws_route53_zone" "main" {
  name = var.domain_name

  tags = {
    Environment = var.environment
    Purpose     = "DNS Management"
  }
}

# ACM Certificate for SSL/TLS
resource "aws_acm_certificate" "main" {
  domain_name       = var.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Environment = var.environment
    Purpose     = "SSL/TLS Certificate"
  }
}