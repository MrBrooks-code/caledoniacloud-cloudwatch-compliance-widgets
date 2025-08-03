# Variables for AWS Config Custom Widgets Terraform Module

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "aws-config-custom-widgets"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "prod"
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "lambda_runtime" {
  description = "Lambda runtime"
  type        = string
  default     = "nodejs16.x"
  
  validation {
    condition     = contains(["nodejs16.x", "nodejs18.x", "nodejs20.x"], var.lambda_runtime)
    error_message = "Lambda runtime must be one of: nodejs16.x, nodejs18.x, nodejs20.x."
  }
}

variable "lambda_timeout" {
  description = "Lambda function timeout in seconds"
  type        = number
  default     = 30
  
  validation {
    condition     = var.lambda_timeout >= 3 && var.lambda_timeout <= 900
    error_message = "Lambda timeout must be between 3 and 900 seconds."
  }
}

variable "lambda_memory_size" {
  description = "Lambda function memory size in MB"
  type        = number
  default     = 256
  
  validation {
    condition     = contains([128, 256, 512, 1024, 2048, 3008], var.lambda_memory_size)
    error_message = "Lambda memory size must be one of: 128, 256, 512, 1024, 2048, 3008 MB."
  }
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 14
  
  validation {
    condition     = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653], var.log_retention_days)
    error_message = "Log retention must be one of the allowed values: 1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653 days."
  }
}

variable "create_dashboard" {
  description = "Whether to create a CloudWatch dashboard with the custom widgets"
  type        = bool
  default     = false
}

variable "dashboard_name" {
  description = "Name of the CloudWatch dashboard (if create_dashboard is true)"
  type        = string
  default     = null
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default = {
    Project     = "aws-config-custom-widgets"
    Environment = "prod"
    ManagedBy   = "terraform"
  }
}

variable "enable_xray" {
  description = "Enable X-Ray tracing for Lambda functions"
  type        = bool
  default     = false
}

variable "lambda_environment_variables" {
  description = "Additional environment variables for Lambda functions"
  type        = map(string)
  default     = {}
}

variable "lambda_reserved_concurrency" {
  description = "Reserved concurrency for Lambda functions (0 for unreserved)"
  type        = number
  default     = 0
  
  validation {
    condition     = var.lambda_reserved_concurrency >= 0
    error_message = "Reserved concurrency must be 0 or greater."
  }
} 

variable "profile" {
  description = "AWS profile"
  type        = string
  default     = "cc"
}

variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "monitored_config_rules" {
  description = "List of specific AWS Config rule names to monitor"
  type        = list(string)
  default     = []
  
  validation {
    condition     = alltrue([for rule in var.monitored_config_rules : length(rule) > 0])
    error_message = "Config rule names cannot be empty."
  }
}

variable "monitored_resource_types" {
  description = "List of AWS resource types to monitor"
  type        = list(string)
  default     = []
  
  validation {
    condition     = alltrue([for type in var.monitored_resource_types : length(type) > 0])
    error_message = "Resource types cannot be empty."
  }
}

variable "compliance_status_filter" {
  description = "Filter by compliance status (COMPLIANT, NON_COMPLIANT, INSUFFICIENT_DATA, or empty for all)"
  type        = string
  default     = ""
  
  validation {
    condition     = contains(["", "COMPLIANT", "NON_COMPLIANT", "INSUFFICIENT_DATA"], var.compliance_status_filter)
    error_message = "Compliance status filter must be one of: COMPLIANT, NON_COMPLIANT, INSUFFICIENT_DATA, or empty for all."
  }
}