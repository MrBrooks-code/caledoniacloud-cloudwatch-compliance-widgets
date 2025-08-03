# Production Environment Configuration

project_name = "aws-config-custom-widgets"
environment  = "prod"

# Lambda Configuration
lambda_runtime     = "nodejs16.x"
lambda_timeout     = 30
lambda_memory_size = 512

# Logging Configuration
log_retention_days = 30

# Dashboard Configuration
create_dashboard = true
dashboard_name   = "AWS-Config-Compliance-Dashboard"

# Monitoring Configuration
# Production: Monitor all critical compliance rules
monitored_config_rules = [
  "s3-bucket-public-read-prohibited",
  "s3-bucket-public-write-prohibited",
  "vpc-flow-logs-enabled",
  "rds-instance-public-access-check",
  "rds-snapshots-public-prohibited",
  "iam-password-policy",
  "iam-user-mfa-enabled",
  "root-account-mfa-enabled",
  "cloudtrail-enabled",
  "cloudwatch-alarm-action-check",
  "ec2-instance-managed-by-systems-manager",
  "ec2-instance-no-public-ip",
  "lambda-function-public-access-prohibited",
  "sagemaker-notebook-no-direct-internet-access"
]

# Production: Monitor all critical resource types
monitored_resource_types = [
  "AWS::S3::Bucket",
  "AWS::EC2::VPC",
  "AWS::EC2::Instance",
  "AWS::RDS::DBInstance",
  "AWS::IAM::User",
  "AWS::IAM::Role",
  "AWS::Lambda::Function",
  "AWS::SageMaker::NotebookInstance"
]

# Production: Show all compliance statuses for comprehensive view
compliance_status_filter = ""

# Advanced Configuration
enable_xray = false
lambda_reserved_concurrency = 10

# Additional Environment Variables
lambda_environment_variables = {
  LOG_LEVEL = "INFO"
  DEBUG     = "false"
  ENV       = "production"
}

# Tags
tags = {
  Project     = "aws-config-custom-widgets"
  Environment = "prod"
  ManagedBy   = "terraform"
  Owner       = "DevOps Team"
  CostCenter  = "Security"
  Compliance  = "SOC2"
} 