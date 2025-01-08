# Configure AWS provider with version constraint
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Application Load Balancer Security Group
resource "aws_security_group" "alb_security_group" {
  name        = "${var.environment}-alb-sg"
  description = "Security group for Application Load Balancer"
  vpc_id      = aws_vpc.vpc.id

  ingress {
    description = "HTTP access from all sources"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS access from all sources"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.environment}-alb-sg"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# GPU Server Security Group
resource "aws_security_group" "gpu_server_security_group" {
  name        = "${var.environment}-gpu-server-sg"
  description = "Security group for GPU servers"
  vpc_id      = aws_vpc.vpc.id

  ingress {
    description     = "SSH access from bastion host only"
    from_port       = 22
    to_port         = 22
    protocol        = "tcp"
    security_groups = [aws_security_group.bastion_security_group.id]
  }

  ingress {
    description     = "Jupyter notebook access through ALB"
    from_port       = 8888
    to_port         = 8888
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_security_group.id]
  }

  ingress {
    description     = "Docker API access from ECS services"
    from_port       = 2376
    to_port         = 2376
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_security_group.id]
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.environment}-gpu-server-sg"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# ECS Service Security Group
resource "aws_security_group" "ecs_security_group" {
  name        = "${var.environment}-ecs-sg"
  description = "Security group for ECS services"
  vpc_id      = aws_vpc.vpc.id

  ingress {
    description     = "HTTP access from ALB only"
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_security_group.id]
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.environment}-ecs-sg"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# RDS Database Security Group
resource "aws_security_group" "rds_security_group" {
  name        = "${var.environment}-rds-sg"
  description = "Security group for RDS database"
  vpc_id      = aws_vpc.vpc.id

  ingress {
    description     = "PostgreSQL access from ECS services only"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_security_group.id]
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.environment}-rds-sg"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# Redis Cache Security Group
resource "aws_security_group" "redis_security_group" {
  name        = "${var.environment}-redis-sg"
  description = "Security group for Redis cluster"
  vpc_id      = aws_vpc.vpc.id

  ingress {
    description     = "Redis access from ECS services only"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_security_group.id]
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.environment}-redis-sg"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# Bastion Host Security Group
resource "aws_security_group" "bastion_security_group" {
  name        = "${var.environment}-bastion-sg"
  description = "Security group for bastion host"
  vpc_id      = aws_vpc.vpc.id

  ingress {
    description = "SSH access from allowed IP ranges"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # Should be restricted to specific IP ranges in production
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.environment}-bastion-sg"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# Security Group Outputs
output "alb_security_group_id" {
  description = "ID of the ALB security group"
  value       = aws_security_group.alb_security_group.id
}

output "gpu_server_security_group_id" {
  description = "ID of the GPU server security group"
  value       = aws_security_group.gpu_server_security_group.id
}

output "ecs_security_group_id" {
  description = "ID of the ECS security group"
  value       = aws_security_group.ecs_security_group.id
}

output "rds_security_group_id" {
  description = "ID of the RDS security group"
  value       = aws_security_group.rds_security_group.id
}

output "redis_security_group_id" {
  description = "ID of the Redis security group"
  value       = aws_security_group.redis_security_group.id
}

output "bastion_security_group_id" {
  description = "ID of the bastion security group"
  value       = aws_security_group.bastion_security_group.id
}