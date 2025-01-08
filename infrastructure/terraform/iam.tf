# AWS Provider configuration with version constraint
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# GPU Server IAM Role
resource "aws_iam_role" "gpu_server_role" {
  name                 = "${var.environment}-gpu-server-role"
  max_session_duration = 3600
  force_detach_policies = true

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
        Condition = {
          StringEquals = {
            "aws:RequestedRegion": var.aws_region
          }
          Bool = {
            "aws:SecureTransport": "true"
          }
        }
      }
    ]
  })

  tags = {
    Name             = "${var.environment}-gpu-server-role"
    Environment      = var.environment
    CostCenter       = "gpu-compute"
    Owner            = "platform-team"
    ComplianceScope  = "pci-dss"
    SecurityLevel    = "high"
    DataClassification = "confidential"
  }
}

# GPU Server IAM Policy
resource "aws_iam_policy" "gpu_server_policy" {
  name = "${var.environment}-gpu-server-policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::${var.environment}-gpu-artifacts/*",
          "arn:aws:s3:::${var.environment}-gpu-artifacts"
        ]
        Condition = {
          StringEquals = {
            "s3:x-amz-server-side-encryption": "aws:kms"
          }
        }
      },
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricData",
          "cloudwatch:GetMetricData",
          "cloudwatch:ListMetrics"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "aws:RequestedRegion": var.aws_region
          }
        }
      },
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParametersByPath"
        ]
        Resource = "arn:aws:ssm:${var.aws_region}:*:parameter/${var.environment}/gpu/*"
      }
    ]
  })

  tags = {
    Name                = "${var.environment}-gpu-server-policy"
    Environment         = var.environment
    SecurityLevel       = "high"
    DataClassification  = "confidential"
  }
}

# Attach policy to GPU server role
resource "aws_iam_role_policy_attachment" "gpu_server_policy_attachment" {
  role       = aws_iam_role.gpu_server_role.name
  policy_arn = aws_iam_policy.gpu_server_policy.arn
}

# Monitoring IAM Role
resource "aws_iam_role" "monitoring_role" {
  name                 = "${var.environment}-monitoring-role"
  max_session_duration = 3600
  permissions_boundary = "${var.environment}-monitoring-boundary"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
        Condition = {
          Bool = {
            "aws:MultiFactorAuthPresent": "true",
            "aws:SecureTransport": "true"
          }
        }
      }
    ]
  })

  tags = {
    Name            = "${var.environment}-monitoring-role"
    Environment     = var.environment
    SecurityLevel   = "high"
    Purpose         = "monitoring"
    ComplianceScope = "pci-dss"
  }
}

# Monitoring IAM Policy
resource "aws_iam_policy" "monitoring_policy" {
  name = "${var.environment}-monitoring-policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricData",
          "cloudwatch:GetMetricData",
          "cloudwatch:GetMetricStatistics",
          "cloudwatch:ListMetrics",
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "aws:RequestedRegion": var.aws_region
          }
        }
      },
      {
        Effect = "Allow"
        Action = [
          "ec2:DescribeInstances",
          "ec2:DescribeInstanceStatus"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "aws:RequestedRegion": var.aws_region,
            "ec2:ResourceTag/Environment": var.environment
          }
        }
      }
    ]
  })

  tags = {
    Name            = "${var.environment}-monitoring-policy"
    Environment     = var.environment
    SecurityLevel   = "high"
    Purpose         = "monitoring"
  }
}

# Attach policy to monitoring role
resource "aws_iam_role_policy_attachment" "monitoring_policy_attachment" {
  role       = aws_iam_role.monitoring_role.name
  policy_arn = aws_iam_policy.monitoring_policy.arn
}

# Instance Profile for GPU Servers
resource "aws_iam_instance_profile" "gpu_server_profile" {
  name = "${var.environment}-gpu-server-profile"
  role = aws_iam_role.gpu_server_role.name

  tags = {
    Name        = "${var.environment}-gpu-server-profile"
    Environment = var.environment
  }
}

# Outputs
output "gpu_server_role_arn" {
  description = "ARN of the GPU server IAM role"
  value       = aws_iam_role.gpu_server_role.arn
}

output "monitoring_role_arn" {
  description = "ARN of the monitoring IAM role"
  value       = aws_iam_role.monitoring_role.arn
}

output "gpu_server_instance_profile_arn" {
  description = "ARN of the GPU server instance profile"
  value       = aws_iam_instance_profile.gpu_server_profile.arn
}