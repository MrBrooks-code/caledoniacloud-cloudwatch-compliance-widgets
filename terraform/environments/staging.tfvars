# Staging Environment Configuration

project_name = "aws-config-custom-widgets"
environment  = "staging"

# Lambda Configuration
lambda_runtime     = "nodejs16.x"
lambda_timeout     = 30
lambda_memory_size = 256

# Logging Configuration
log_retention_days = 14

# Dashboard Configuration
create_dashboard = true
dashboard_name   = "AWS-Config-Compliance-Dashboard-Staging"

# Advanced Configuration
enable_xray = true
lambda_reserved_concurrency = 5

# Additional Environment Variables
lambda_environment_variables = {
  LOG_LEVEL = "INFO"
  DEBUG     = "false"
  ENV       = "staging"
}

# Tags
tags = {
  Project     = "aws-config-custom-widgets"
  Environment = "staging"
  ManagedBy   = "terraform"
  Owner       = "DevOps Team"
  CostCenter  = "Security"
} 