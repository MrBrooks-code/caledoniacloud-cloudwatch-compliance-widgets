# Development Environment Configuration

project_name = "aws-config-custom-widgets"
environment  = "dev"

# Lambda Configuration
lambda_runtime     = "nodejs16.x"
lambda_timeout     = 30
lambda_memory_size = 256

# Logging Configuration
log_retention_days = 7

# Dashboard Configuration
create_dashboard = true
dashboard_name   = "AWS-Config-Compliance-Dashboard-Dev"

# Monitoring Configuration
# Example: Monitor specific security-focused Config rules
monitored_config_rules = [
  "s3-bucket-public-read-prohibited",
  "vpc-flow-logs-enabled",
  "rds-instance-public-access-check",
  "iam-password-policy",
  "root-account-mfa-enabled"
]

# Example: Monitor specific resource types
monitored_resource_types = [
  "AWS::S3::Bucket",
  "AWS::EC2::VPC",
  "AWS::RDS::DBInstance",
  "AWS::IAM::User"
]

# Example: Focus on non-compliant resources only
compliance_status_filter = "NON_COMPLIANT"

# Advanced Configuration
enable_xray = true
lambda_reserved_concurrency = 0

# Additional Environment Variables
lambda_environment_variables = {
  LOG_LEVEL = "DEBUG"
  DEBUG     = "true"
  ENV       = "development"
}

# Tags
tags = {
  Project     = "aws-config-custom-widgets"
  Environment = "dev"
  ManagedBy   = "terraform"
  Owner       = "DevOps Team"
  CostCenter  = "Security"
} 