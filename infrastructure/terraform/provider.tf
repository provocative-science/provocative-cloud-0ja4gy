# Terraform version constraint ensuring compatibility with infrastructure specifications
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    # AWS provider for core infrastructure provisioning
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }

    # Random provider for generating unique identifiers
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }

    # Null provider for custom operations and provisioners
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
  }
}

# AWS provider configuration with region and default resource tagging
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = var.environment
      Project     = "Provocative Cloud"
      ManagedBy   = "Terraform"
      Purpose     = "GPU Rental Infrastructure"
      CreatedBy   = "Terraform Provider"
    }
  }
}

# Random provider configuration with environment-based keepers
provider "random" {
  keepers = {
    environment = var.environment
  }
}

# Null provider configuration with environment-based triggers
provider "null" {
  triggers_replace = {
    environment = var.environment
  }
}