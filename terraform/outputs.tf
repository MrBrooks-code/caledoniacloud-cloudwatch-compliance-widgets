# Outputs for AWS Config Custom Widgets

output "lambda_functions" {
  description = "Lambda function ARNs for CloudWatch Custom Widgets"
  value = {
    config_rules_widget     = aws_lambda_function.config_rules_widget.arn
    config_compliance_widget = aws_lambda_function.config_compliance_widget.arn
    config_remediation_widget = aws_lambda_function.config_remediation_widget.arn
  }
}

output "lambda_function_names" {
  description = "Lambda function names"
  value = {
    config_rules_widget     = aws_lambda_function.config_rules_widget.function_name
    config_compliance_widget = aws_lambda_function.config_compliance_widget.function_name
    config_remediation_widget = aws_lambda_function.config_remediation_widget.function_name
  }
}

output "iam_role_arn" {
  description = "ARN of the IAM role used by Lambda functions"
  value       = aws_iam_role.lambda_role.arn
}

output "cloudwatch_log_groups" {
  description = "CloudWatch log group names"
  value = {
    config_rules_widget     = aws_cloudwatch_log_group.config_rules_widget.name
    config_compliance_widget = aws_cloudwatch_log_group.config_compliance_widget.name
    config_remediation_widget = aws_cloudwatch_log_group.config_remediation_widget.name
  }
}

output "dashboard_url" {
  description = "URL of the CloudWatch dashboard (if created)"
  value = var.create_dashboard ? "https://${data.aws_region.current.name}.console.aws.amazon.com/cloudwatch/home?region=${data.aws_region.current.name}#dashboards:name=${aws_cloudwatch_dashboard.config_dashboard[0].dashboard_name}" : null
}

output "dashboard_name" {
  description = "Name of the CloudWatch dashboard (if created)"
  value = var.create_dashboard ? aws_cloudwatch_dashboard.config_dashboard[0].dashboard_name : null
}

output "deployment_instructions" {
  description = "Instructions for adding widgets to CloudWatch dashboards"
  value = <<-EOT
    AWS Config Custom Widgets deployed successfully!
    
    To add these widgets to your CloudWatch dashboard:
    
    1. Open CloudWatch Console
    2. Create or edit a dashboard
    3. Add Custom Widget
    4. Use the following Lambda function ARNs:
    
               Config Rules Widget: ${aws_lambda_function.config_rules_widget.arn}
        Config Compliance Widget: ${aws_lambda_function.config_compliance_widget.arn}
        Config Remediation Widget: ${aws_lambda_function.config_remediation_widget.arn}
    
    5. Configure widget parameters as needed:
       - region: ${data.aws_region.current.name}
       - showRemediation: true (for rules widget)
       - ruleName: <specific-rule-name> (for compliance widget)
    
    ${var.create_dashboard ? "A sample dashboard has been created. Check the dashboard_url output for the URL." : "No dashboard was created. Set create_dashboard = true to create one automatically."}
    
    For troubleshooting, check CloudWatch logs:
    - ${aws_cloudwatch_log_group.config_rules_widget.name}
    - ${aws_cloudwatch_log_group.config_compliance_widget.name}
    - ${aws_cloudwatch_log_group.config_remediation_widget.name}
  EOT
}

output "project_info" {
  description = "Project information and metadata"
  value = {
    project_name = var.project_name
    environment  = var.environment
    region       = data.aws_region.current.name
    account_id   = data.aws_caller_identity.current.account_id
    deployed_at  = timestamp()
  }
} 