resource "aws_iam_role" "lambda_role" {
  name = "${local.name_prefix}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

# IAM Policy for Lambda functions
resource "aws_iam_role_policy" "lambda_policy" {
  name = "${local.name_prefix}-lambda-policy"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "config:DescribeConfigRules",
          "config:GetComplianceSummaryByConfigRule",
          "config:GetComplianceDetailsByConfigRule",
          "config:DescribeConfigRuleEvaluationStatus"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = [
          "${aws_cloudwatch_log_group.config_rules_widget.arn}:*",
          "${aws_cloudwatch_log_group.config_compliance_widget.arn}:*",
          "${aws_cloudwatch_log_group.config_remediation_widget.arn}:*"
        ]
      }
    ]
  })
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "config_rules_widget" {
  name              = "/aws/lambda/${local.name_prefix}-config-rules-widget"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "config_compliance_widget" {
  name              = "/aws/lambda/${local.name_prefix}-config-compliance-widget"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "config_remediation_widget" {
  name              = "/aws/lambda/${local.name_prefix}-config-remediation-widget"
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

# Lambda Functions
resource "aws_lambda_function" "config_rules_widget" {
  filename         = data.archive_file.config_rules_widget.output_path
  function_name    = "${local.name_prefix}-config-rules-widget"
  role            = aws_iam_role.lambda_role.arn
  handler         = "configRulesWidget.handler"
  runtime         = var.lambda_runtime
  timeout         = var.lambda_timeout
  memory_size     = var.lambda_memory_size
  source_code_hash = data.archive_file.config_rules_widget.output_base64sha256

  environment {
    variables = merge({
      ENVIRONMENT = var.environment
      PROJECT     = var.project_name
    }, var.lambda_environment_variables)
  }

  reserved_concurrent_executions = var.lambda_reserved_concurrency > 0 ? var.lambda_reserved_concurrency : null

  tracing_config {
    mode = var.enable_xray ? "Active" : "PassThrough"
  }

  tags = local.common_tags

  depends_on = [
    aws_cloudwatch_log_group.config_rules_widget,
    aws_iam_role_policy.lambda_policy
  ]
}

resource "aws_lambda_function" "config_compliance_widget" {
  filename         = data.archive_file.config_compliance_widget.output_path
  function_name    = "${local.name_prefix}-config-compliance-widget"
  role            = aws_iam_role.lambda_role.arn
  handler         = "configComplianceWidget.handler"
  runtime         = var.lambda_runtime
  timeout         = var.lambda_timeout
  memory_size     = var.lambda_memory_size
  source_code_hash = data.archive_file.config_compliance_widget.output_base64sha256

  environment {
    variables = merge({
      ENVIRONMENT = var.environment
      PROJECT     = var.project_name
    }, var.lambda_environment_variables)
  }

  reserved_concurrent_executions = var.lambda_reserved_concurrency > 0 ? var.lambda_reserved_concurrency : null

  tracing_config {
    mode = var.enable_xray ? "Active" : "PassThrough"
  }

  tags = local.common_tags

  depends_on = [
    aws_cloudwatch_log_group.config_compliance_widget,
    aws_iam_role_policy.lambda_policy
  ]
}

resource "aws_lambda_function" "config_remediation_widget" {
  filename         = data.archive_file.config_remediation_widget.output_path
  function_name    = "${local.name_prefix}-config-remediation-widget"
  role            = aws_iam_role.lambda_role.arn
  handler         = "configRemediationWidget.handler"
  runtime         = var.lambda_runtime
  timeout         = var.lambda_timeout
  memory_size     = var.lambda_memory_size
  source_code_hash = data.archive_file.config_remediation_widget.output_base64sha256

  environment {
    variables = merge({
      ENVIRONMENT = var.environment
      PROJECT     = var.project_name
    }, var.lambda_environment_variables)
  }

  reserved_concurrent_executions = var.lambda_reserved_concurrency > 0 ? var.lambda_reserved_concurrency : null

  tracing_config {
    mode = var.enable_xray ? "Active" : "PassThrough"
  }

  tags = local.common_tags

  depends_on = [
    aws_cloudwatch_log_group.config_remediation_widget,
    aws_iam_role_policy.lambda_policy
  ]
}

# CloudWatch Dashboard (Optional)
resource "aws_cloudwatch_dashboard" "config_dashboard" {
  count          = var.create_dashboard ? 1 : 0
  dashboard_name = var.dashboard_name != null ? var.dashboard_name : "${local.name_prefix}-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "custom"
        x      = 0
        y      = 0
        width  = 12
        height = 8
        properties = {
          endpoint = aws_lambda_function.config_rules_widget.arn
          params = merge({
            region         = data.aws_region.current.name
            showRemediation = true
          }, 
          length(var.monitored_config_rules) > 0 ? { ruleNames = var.monitored_config_rules } : {},
          length(var.monitored_resource_types) > 0 ? { resourceTypes = var.monitored_resource_types } : {},
          var.compliance_status_filter != "" ? { complianceStatus = var.compliance_status_filter } : {})
          updateOnRefresh        = true
          updateOnResize         = true
          updateOnTimeRangeChange = true
        }
      },
      {
        type   = "custom"
        x      = 12
        y      = 0
        width  = 12
        height = 8
        properties = {
          endpoint = aws_lambda_function.config_compliance_widget.arn
          params = merge({
            region = data.aws_region.current.name
          },
          length(var.monitored_config_rules) > 0 ? { ruleNames = var.monitored_config_rules } : {},
          length(var.monitored_resource_types) > 0 ? { resourceTypes = var.monitored_resource_types } : {},
          var.compliance_status_filter != "" ? { complianceStatus = var.compliance_status_filter } : {})
          updateOnRefresh        = true
          updateOnResize         = true
          updateOnTimeRangeChange = true
        }
      },
      {
        type   = "custom"
        x      = 0
        y      = 8
        width  = 24
        height = 8
        properties = {
          endpoint = aws_lambda_function.config_remediation_widget.arn
          params = merge({
            region = data.aws_region.current.name
          },
          length(var.monitored_config_rules) > 0 ? { ruleNames = var.monitored_config_rules } : {},
          length(var.monitored_resource_types) > 0 ? { resourceTypes = var.monitored_resource_types } : {},
          var.compliance_status_filter != "" ? { complianceStatus = var.compliance_status_filter } : {})
          updateOnRefresh        = true
          updateOnResize         = true
          updateOnTimeRangeChange = true
        }
      }
    ]
  })

} 