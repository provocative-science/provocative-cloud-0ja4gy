# AWS Route53 configuration for Provocative Cloud platform
# Provider version: ~> 5.0

# Primary Route53 hosted zone for the domain
resource "aws_route53_zone" "route53_zone" {
  name          = var.domain_name
  comment       = "Managed by Terraform - Provocative Cloud ${var.environment}"
  force_destroy = false

  tags = {
    Name        = var.domain_name
    Environment = var.environment
    Project     = "provocative-cloud"
    ManagedBy   = "terraform"
    CreatedAt   = timestamp()
    CostCenter  = "dns-infrastructure"
  }
}

# Primary health check for endpoint monitoring
resource "aws_route53_health_check" "primary" {
  fqdn              = var.domain_name
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = "3"
  request_interval  = "30"

  regions = [
    "us-east-1",    # North America
    "eu-west-1",    # Europe
    "ap-southeast-1" # Asia Pacific
  ]

  tags = {
    Name        = "primary-health-check"
    Environment = var.environment
  }
}

# WWW subdomain record with CloudFront alias and health check
resource "aws_route53_record" "route53_www_record" {
  zone_id = aws_route53_zone.route53_zone.zone_id
  name    = "www.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.cloudfront_distribution.domain_name
    zone_id               = aws_cloudfront_distribution.cloudfront_distribution.hosted_zone_id
    evaluate_target_health = true
  }

  health_check_id = aws_route53_health_check.primary.id
  set_identifier  = "primary"

  failover_routing_policy {
    type = "PRIMARY"
  }
}

# Apex domain record with CloudFront alias and failover configuration
resource "aws_route53_record" "route53_apex_record" {
  zone_id = aws_route53_zone.route53_zone.zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.cloudfront_distribution.domain_name
    zone_id               = aws_cloudfront_distribution.cloudfront_distribution.hosted_zone_id
    evaluate_target_health = true
  }

  health_check_id = aws_route53_health_check.primary.id
  set_identifier  = "primary"

  failover_routing_policy {
    type = "PRIMARY"
  }
}

# Output the Route53 zone ID for cross-module reference
output "route53_zone_id" {
  description = "ID of the Route53 hosted zone for cross-module reference"
  value       = aws_route53_zone.route53_zone.zone_id
}

# Output the Route53 nameservers for DNS configuration
output "route53_zone_nameservers" {
  description = "Nameservers for the Route53 hosted zone for DNS configuration"
  value       = aws_route53_zone.route53_zone.name_servers
}

# Output the health check ID for monitoring reference
output "route53_health_check_id" {
  description = "ID of the primary health check for monitoring reference"
  value       = aws_route53_health_check.primary.id
}