# AWS Provider configuration with version constraint
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# CloudFront cache policy for static content
resource "aws_cloudfront_cache_policy" "default" {
  name        = "provocative-default-cache-policy-${var.environment}"
  comment     = "Default cache policy for static content"
  min_ttl     = 0
  default_ttl = 3600
  max_ttl     = 86400

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "none"
    }
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true
  }
}

# CloudFront cache policy for API requests
resource "aws_cloudfront_cache_policy" "api" {
  name        = "provocative-api-cache-policy-${var.environment}"
  comment     = "Cache policy for API requests"
  min_ttl     = 0
  default_ttl = 0
  max_ttl     = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "all"
    }
    headers_config {
      header_behavior = "whitelist"
      headers {
        items = ["Authorization", "Origin", "Accept", "Content-Type"]
      }
    }
    query_strings_config {
      query_string_behavior = "all"
    }
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true
  }
}

# CloudFront origin request policy for static content
resource "aws_cloudfront_origin_request_policy" "default" {
  name    = "provocative-default-origin-policy-${var.environment}"
  comment = "Default origin request policy for static content"

  cookies_config {
    cookie_behavior = "none"
  }
  headers_config {
    header_behavior = "whitelist"
    headers {
      items = ["Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers"]
    }
  }
  query_strings_config {
    query_string_behavior = "none"
  }
}

# CloudFront origin request policy for API requests
resource "aws_cloudfront_origin_request_policy" "api" {
  name    = "provocative-api-origin-policy-${var.environment}"
  comment = "Origin request policy for API requests"

  cookies_config {
    cookie_behavior = "all"
  }
  headers_config {
    header_behavior = "allViewer"
  }
  query_strings_config {
    query_string_behavior = "all"
  }
}

# CloudFront response headers policy with security headers
resource "aws_cloudfront_response_headers_policy" "security" {
  name    = "provocative-security-headers-${var.environment}"
  comment = "Security headers policy for all responses"

  security_headers_config {
    content_security_policy {
      content_security_policy = "default-src 'self' https: data: 'unsafe-inline' 'unsafe-eval'; frame-ancestors 'none'"
      override = true
    }
    content_type_options {
      override = true
    }
    frame_options {
      frame_option = "DENY"
      override     = true
    }
    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }
    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = true
      preload                    = true
      override                   = true
    }
    xss_protection {
      mode_block = true
      protection = true
      override   = true
    }
  }
}

# CloudFront Origin Access Identity
resource "aws_cloudfront_origin_access_identity" "oai" {
  comment = "OAI for Provocative Cloud Platform - ${var.environment}"
}

# CloudFront distribution
resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled    = true
  comment            = "Provocative Cloud Platform Distribution - ${var.environment}"
  default_root_object = "index.html"
  price_class        = "PriceClass_All"
  aliases            = [var.domain_name]
  web_acl_id         = aws_wafv2_web_acl.main.arn

  logging_config {
    include_cookies = false
    bucket         = aws_s3_bucket.logs_bucket.bucket_regional_domain_name
    prefix         = "cloudfront/"
  }

  origin {
    domain_name = aws_s3_bucket.user_data_bucket.bucket_regional_domain_name
    origin_id   = "S3-${aws_s3_bucket.user_data_bucket.id}"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.oai.cloudfront_access_identity_path
    }

    origin_shield {
      enabled              = true
      origin_shield_region = "us-east-1"
    }
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.user_data_bucket.id}"
    compress         = true

    cache_policy_id            = aws_cloudfront_cache_policy.default.id
    origin_request_policy_id   = aws_cloudfront_origin_request_policy.default.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id

    viewer_protocol_policy = "redirect-to-https"
    min_ttl               = 0
    default_ttl           = 3600
    max_ttl               = 86400
  }

  ordered_cache_behavior {
    path_pattern     = "/api/*"
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "API-${aws_apigateway_rest_api.main.id}"

    cache_policy_id            = aws_cloudfront_cache_policy.api.id
    origin_request_policy_id   = aws_cloudfront_origin_request_policy.api.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id

    viewer_protocol_policy = "https-only"
    min_ttl               = 0
    default_ttl           = 0
    max_ttl               = 0
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.main.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  tags = {
    Name        = "Provocative Cloud CDN"
    Environment = var.environment
  }
}

# S3 bucket policy for CloudFront access
resource "aws_s3_bucket_policy" "cloudfront_access" {
  bucket = aws_s3_bucket.user_data_bucket.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "CloudFrontAccess"
        Effect    = "Allow"
        Principal = {
          AWS = aws_cloudfront_origin_access_identity.oai.iam_arn
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.user_data_bucket.arn}/*"
      }
    ]
  })
}