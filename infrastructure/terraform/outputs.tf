# Output variables for Provocative Cloud GPU rental platform infrastructure
# AWS Provider version ~> 5.0

# VPC and Networking Outputs
output "vpc_id" {
  description = "ID of the VPC hosting the Provocative Cloud platform"
  value       = module.vpc.vpc_id
  sensitive   = false

  depends_on = [module.vpc]

  validation {
    condition     = can(regex("^vpc-", var.vpc_id))
    error_message = "VPC ID must start with 'vpc-'"
  }
}

output "public_subnet_ids" {
  description = "IDs of public subnets for load balancers and NAT gateways across availability zones"
  value       = module.vpc.public_subnet_ids
  sensitive   = false

  depends_on = [module.vpc]

  validation {
    condition     = length(var.public_subnet_ids) >= 2
    error_message = "At least 2 public subnets required for high availability"
  }
}

output "private_subnet_ids" {
  description = "IDs of private subnets for GPU instances and application servers with high availability"
  value       = module.vpc.private_subnet_ids
  sensitive   = false

  depends_on = [module.vpc]

  validation {
    condition     = length(var.private_subnet_ids) >= 2
    error_message = "At least 2 private subnets required for high availability"
  }
}

# Database Outputs
output "database_endpoint" {
  description = "Endpoint URL for the PostgreSQL RDS instance with read/write capability"
  value       = module.rds.db_endpoint
  sensitive   = false

  depends_on = [module.rds]

  validation {
    condition     = can(regex(".+\\.rds\\.amazonaws\\.com$", var.database_endpoint))
    error_message = "Invalid RDS endpoint format"
  }
}

output "database_name" {
  description = "Name of the PostgreSQL database for application data storage"
  value       = module.rds.db_name
  sensitive   = false

  depends_on = [module.rds]
}

output "database_user" {
  description = "Master username for PostgreSQL database access"
  value       = module.rds.db_username
  sensitive   = true # Marked as sensitive to prevent exposure in logs

  depends_on = [module.rds]
}