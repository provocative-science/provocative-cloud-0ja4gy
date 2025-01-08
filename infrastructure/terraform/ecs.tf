# Configure AWS provider with version constraint
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# ECS Cluster with enhanced monitoring and container insights
resource "aws_ecs_cluster" "ecs_cluster" {
  name = "${var.environment}-provocative-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  configuration {
    execute_command_configuration {
      logging = "OVERRIDE"
      log_configuration {
        cloud_watch_log_group_name = "/aws/ecs/${var.environment}/command-execution"
      }
    }
  }

  tags = {
    Name        = "${var.environment}-ecs-cluster"
    Environment = var.environment
    ManagedBy   = "terraform"
    Project     = "provocative-cloud"
  }
}

# Enhanced IAM role for ECS task execution
resource "aws_iam_role" "ecs_task_execution_role" {
  name = "${var.environment}-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  managed_policy_arns = [
    "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
    "arn:aws:iam::aws:policy/CloudWatchLogsFullAccess"
  ]

  tags = {
    Name        = "${var.environment}-ecs-execution-role"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Backend API task definition with optimized resources
resource "aws_ecs_task_definition" "backend_task_definition" {
  family                   = "${var.environment}-backend"
  requires_compatibilities = ["FARGATE"]
  network_mode            = "awsvpc"
  cpu                     = 2048
  memory                  = 4096
  execution_role_arn      = aws_iam_role.ecs_task_execution_role.arn

  container_definitions = jsonencode([
    {
      name      = "backend"
      image     = "${var.ecr_repository_url}:latest"
      essential = true
      
      portMappings = [
        {
          containerPort = 8000
          protocol     = "tcp"
        }
      ]

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:8000/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/${var.environment}/backend"
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "backend"
          "awslogs-create-group"  = "true"
        }
      }

      environment = [
        {
          name  = "ENVIRONMENT"
          value = var.environment
        }
      ]
    }
  ])

  tags = {
    Name        = "${var.environment}-backend-task"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Enhanced ECS service with high availability and deployment controls
resource "aws_ecs_service" "backend_service" {
  name                              = "${var.environment}-backend-service"
  cluster                          = aws_ecs_cluster.ecs_cluster.id
  task_definition                  = aws_ecs_task_definition.backend_task_definition.arn
  desired_count                    = 3
  launch_type                      = "FARGATE"
  platform_version                 = "LATEST"
  health_check_grace_period_seconds = 120
  enable_execute_command           = true

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [var.backend_security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = 8000
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  deployment_controller {
    type = "ECS"
  }

  tags = {
    Name        = "${var.environment}-backend-service"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Auto-scaling configuration with wider capacity range
resource "aws_appautoscaling_target" "backend_auto_scaling" {
  max_capacity       = 10
  min_capacity       = 3
  resource_id        = "service/${aws_ecs_cluster.ecs_cluster.name}/${aws_ecs_service.backend_service.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"

  tags = {
    Name        = "${var.environment}-backend-autoscaling"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# CPU utilization based auto-scaling policy
resource "aws_appautoscaling_policy" "backend_cpu_policy" {
  name               = "${var.environment}-backend-cpu-policy"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.backend_auto_scaling.resource_id
  scalable_dimension = aws_appautoscaling_target.backend_auto_scaling.scalable_dimension
  service_namespace  = aws_appautoscaling_target.backend_auto_scaling.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

# Memory utilization based auto-scaling policy
resource "aws_appautoscaling_policy" "backend_memory_policy" {
  name               = "${var.environment}-backend-memory-policy"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.backend_auto_scaling.resource_id
  scalable_dimension = aws_appautoscaling_target.backend_auto_scaling.scalable_dimension
  service_namespace  = aws_appautoscaling_target.backend_auto_scaling.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
    target_value = 80.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

# Output values for reference in other resources
output "ecs_cluster_id" {
  description = "ID of the created ECS cluster for reference"
  value       = aws_ecs_cluster.ecs_cluster.id
}

output "ecs_cluster_name" {
  description = "Name of the created ECS cluster for service discovery"
  value       = aws_ecs_cluster.ecs_cluster.name
}

output "backend_service_name" {
  description = "Name of the backend ECS service for monitoring"
  value       = aws_ecs_service.backend_service.name
}