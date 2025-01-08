# Configure AWS provider with version constraint
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Main VPC resource with DNS support and metrics enabled
resource "aws_vpc" "vpc" {
  cidr_block                           = var.vpc_cidr
  enable_dns_hostnames                 = true
  enable_dns_support                   = true
  enable_network_address_usage_metrics = true

  tags = {
    Name        = "${var.environment}-vpc"
    Environment = var.environment
    Purpose     = "GPU Rental Platform"
    ManagedBy   = "Terraform"
  }
}

# Public subnets for load balancers and NAT gateways
resource "aws_subnet" "public_subnets" {
  count                   = length(var.availability_zones)
  vpc_id                  = aws_vpc.vpc.id
  cidr_block             = cidrsubnet(var.vpc_cidr, 8, count.index)
  availability_zone      = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name        = "${var.environment}-public-subnet-${count.index + 1}"
    Environment = var.environment
    Type        = "Public"
    Purpose     = "Load Balancers and NAT Gateways"
    ManagedBy   = "Terraform"
  }
}

# Private subnets for GPU servers and application components
resource "aws_subnet" "private_subnets" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.vpc.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + length(var.availability_zones))
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name        = "${var.environment}-private-subnet-${count.index + 1}"
    Environment = var.environment
    Type        = "Private"
    Purpose     = "GPU Servers"
    GPUEnabled  = "true"
    ManagedBy   = "Terraform"
  }
}

# Internet Gateway for public subnet internet access
resource "aws_internet_gateway" "internet_gateway" {
  vpc_id = aws_vpc.vpc.id

  tags = {
    Name        = "${var.environment}-igw"
    Environment = var.environment
    Purpose     = "Public Internet Access"
    ManagedBy   = "Terraform"
  }
}

# Elastic IPs for NAT Gateways
resource "aws_eip" "nat" {
  count  = length(var.availability_zones)
  domain = "vpc"

  tags = {
    Name             = "${var.environment}-nat-eip-${count.index + 1}"
    Environment      = var.environment
    Purpose         = "NAT Gateway"
    AvailabilityZone = var.availability_zones[count.index]
    ManagedBy       = "Terraform"
  }
}

# NAT Gateways for private subnet internet access
resource "aws_nat_gateway" "nat_gateways" {
  count         = length(var.availability_zones)
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public_subnets[count.index].id
  depends_on    = [aws_internet_gateway.internet_gateway]

  tags = {
    Name             = "${var.environment}-nat-${count.index + 1}"
    Environment      = var.environment
    Purpose         = "Private Subnet Internet Access"
    AvailabilityZone = var.availability_zones[count.index]
    ManagedBy       = "Terraform"
  }
}

# Route table for public subnets
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.internet_gateway.id
  }

  tags = {
    Name        = "${var.environment}-public-rt"
    Environment = var.environment
    Type        = "Public"
    ManagedBy   = "Terraform"
  }
}

# Route table for private subnets
resource "aws_route_table" "private" {
  count  = length(var.availability_zones)
  vpc_id = aws_vpc.vpc.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.nat_gateways[count.index].id
  }

  tags = {
    Name             = "${var.environment}-private-rt-${count.index + 1}"
    Environment      = var.environment
    Type            = "Private"
    AvailabilityZone = var.availability_zones[count.index]
    ManagedBy       = "Terraform"
  }
}

# Associate public subnets with public route table
resource "aws_route_table_association" "public" {
  count          = length(var.availability_zones)
  subnet_id      = aws_subnet.public_subnets[count.index].id
  route_table_id = aws_route_table.public.id
}

# Associate private subnets with corresponding private route tables
resource "aws_route_table_association" "private" {
  count          = length(var.availability_zones)
  subnet_id      = aws_subnet.private_subnets[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

# VPC Flow Logs for network monitoring
resource "aws_flow_log" "vpc_flow_log" {
  vpc_id          = aws_vpc.vpc.id
  traffic_type    = "ALL"
  iam_role_arn    = aws_iam_role.vpc_flow_log_role.arn
  log_destination = aws_cloudwatch_log_group.vpc_flow_log.arn

  tags = {
    Name        = "${var.environment}-vpc-flow-log"
    Environment = var.environment
    Purpose     = "Network Monitoring"
    ManagedBy   = "Terraform"
  }
}

# CloudWatch Log Group for VPC Flow Logs
resource "aws_cloudwatch_log_group" "vpc_flow_log" {
  name              = "/aws/vpc/${var.environment}-flow-logs"
  retention_in_days = 30

  tags = {
    Name        = "${var.environment}-vpc-flow-log-group"
    Environment = var.environment
    Purpose     = "Network Monitoring"
    ManagedBy   = "Terraform"
  }
}

# IAM Role for VPC Flow Logs
resource "aws_iam_role" "vpc_flow_log_role" {
  name = "${var.environment}-vpc-flow-log-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "vpc-flow-logs.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.environment}-vpc-flow-log-role"
    Environment = var.environment
    Purpose     = "Network Monitoring"
    ManagedBy   = "Terraform"
  }
}

# IAM Policy for VPC Flow Logs
resource "aws_iam_role_policy" "vpc_flow_log_policy" {
  name = "${var.environment}-vpc-flow-log-policy"
  role = aws_iam_role.vpc_flow_log_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams"
        ]
        Effect   = "Allow"
        Resource = "*"
      }
    ]
  })
}

# Outputs for use in other Terraform resources
output "vpc_id" {
  description = "ID of the created VPC for reference in other resources"
  value       = aws_vpc.vpc.id
}

output "public_subnet_ids" {
  description = "List of public subnet IDs for load balancer and NAT gateway placement"
  value       = aws_subnet.public_subnets[*].id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs for GPU server and application component placement"
  value       = aws_subnet.private_subnets[*].id
}