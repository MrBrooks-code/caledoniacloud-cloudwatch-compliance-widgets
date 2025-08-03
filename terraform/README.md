# AWS Config Custom Widgets - Terraform Module

This Terraform module deploys the AWS Config Custom Widgets infrastructure, including Lambda functions, IAM roles, CloudWatch log groups, and optionally a CloudWatch dashboard.

## Features

- **Modular Design**: Separate configuration for different environments
- **Comprehensive IAM**: Least-privilege permissions for Lambda functions
- **Flexible Configuration**: Environment-specific settings via tfvars files
- **Optional Dashboard**: Built-in CloudWatch dashboard with custom widgets
- **Advanced Features**: X-Ray tracing, reserved concurrency, custom environment variables
- **Automated Deployment**: Bash script for easy deployment and management

## Prerequisites

- Terraform >= 1.0
- AWS CLI configured with appropriate permissions
- Node.js 18.x (for Lambda runtime)
- AWS Config service enabled in your account

## Quick Start

### 1. Clone and Navigate

```bash
cd terraform
```

### 2. Configure Environment

Copy the example configuration and modify as needed:

```bash
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your settings
```

Or use environment-specific configurations:

```bash
# For development
cp environments/dev.tfvars terraform.tfvars

# For production
cp environments/prod.tfvars terraform.tfvars
```

### 3. Deploy

Using the deployment script:

```bash
# Make script executable
chmod +x deploy.sh

# Deploy to development
./deploy.sh apply -e dev

# Deploy to production
./deploy.sh apply -e prod -a
```

Or using Terraform directly:

```bash
# Initialize
terraform init

# Plan
terraform plan -var-file="environments/prod.tfvars"

# Apply
terraform apply -var-file="environments/prod.tfvars"
```

## Configuration

### Variables

| Variable | Description | Default | Type |
|----------|-------------|---------|------|
| `project_name` | Name of the project | `"aws-config-custom-widgets"` | string |
| `environment` | Environment name (dev, staging, prod) | `"prod"` | string |
| `lambda_runtime` | Lambda runtime | `"nodejs18.x"` | string |
| `lambda_timeout` | Lambda function timeout in seconds | `30` | number |
| `lambda_memory_size` | Lambda function memory size in MB | `256` | number |
| `log_retention_days` | CloudWatch log retention in days | `14` | number |
| `create_dashboard` | Whether to create a CloudWatch dashboard | `false` | bool |
| `dashboard_name` | Name of the CloudWatch dashboard | `null` | string |
| `enable_xray` | Enable X-Ray tracing for Lambda functions | `false` | bool |
| `lambda_reserved_concurrency` | Reserved concurrency for Lambda functions | `0` | number |
| `lambda_environment_variables` | Additional environment variables | `{}` | map(string) |
| `tags` | Tags to apply to all resources | `{}` | map(string) |

### Environment Configurations

The module includes pre-configured environment files:

- **`environments/dev.tfvars`**: Development environment with debug logging and X-Ray enabled
- **`environments/prod.tfvars`**: Production environment with optimized settings and longer log retention

### Custom Configuration

Create your own environment configuration:

```hcl
# my-environment.tfvars
project_name = "my-config-widgets"
environment  = "staging"
lambda_memory_size = 512
create_dashboard = true
dashboard_name = "My-Config-Dashboard"

tags = {
  Project     = "my-config-widgets"
  Environment = "staging"
  Owner       = "My Team"
}
```

## Deployment Script

The `deploy.sh` script provides a convenient way to manage deployments:

### Usage

```bash
./deploy.sh [OPTIONS] ACTION
```

### Actions

- `plan` - Show execution plan
- `apply` - Apply the configuration (default)
- `destroy` - Destroy the infrastructure
- `init` - Initialize Terraform
- `validate` - Validate the configuration
- `output` - Show outputs
- `refresh` - Refresh Terraform state

### Options

- `-e, --environment ENV` - Environment (dev, staging, prod) [default: prod]
- `-w, --workspace WS` - Terraform workspace [default: default]
- `-a, --auto-approve` - Auto-approve changes (for apply/destroy)
- `-h, --help` - Show help message

### Examples

```bash
# Plan deployment for development
./deploy.sh plan -e dev

# Deploy to production with auto-approve
./deploy.sh apply -e prod -a

# Destroy development environment
./deploy.sh destroy -e dev

# Show outputs for production
./deploy.sh output -e prod
```

## Outputs

After deployment, the module provides the following outputs:

- `lambda_functions` - Lambda function ARNs for CloudWatch Custom Widgets
- `lambda_function_names` - Lambda function names
- `iam_role_arn` - ARN of the IAM role used by Lambda functions
- `cloudwatch_log_groups` - CloudWatch log group names
- `dashboard_url` - URL of the CloudWatch dashboard (if created)
- `dashboard_name` - Name of the CloudWatch dashboard (if created)
- `deployment_instructions` - Instructions for adding widgets to CloudWatch dashboards
- `project_info` - Project information and metadata

## Adding Widgets to CloudWatch Dashboard

After deployment, you can add the custom widgets to any CloudWatch dashboard:

1. Open CloudWatch Console
2. Create or edit a dashboard
3. Add Custom Widget
4. Use the Lambda function ARNs from the outputs
5. Configure widget parameters as needed

### Widget Parameters

Each widget accepts the following parameters:

- `region`: AWS region (defaults to widget context region)
- `ruleNames`: Array of specific rule names to display
- `complianceStatus`: Filter by compliance status (COMPLIANT, NON_COMPLIANT, INSUFFICIENT_DATA)
- `resourceTypes`: Filter by resource types
- `showRemediation`: Enable/disable remediation buttons

## Monitoring and Troubleshooting

### CloudWatch Logs

Each Lambda function has its own log group:

```bash
# View logs for config rules widget
aws logs tail /aws/lambda/aws-config-custom-widgets-prod-config-rules-widget

# View logs for compliance widget
aws logs tail /aws/lambda/aws-config-custom-widgets-prod-config-compliance-widget

# View logs for remediation widget
aws logs tail /aws/lambda/aws-config-custom-widgets-prod-config-remediation-widget
```

### Common Issues

1. **Widget Not Loading**: Check Lambda function permissions and CloudWatch logs
2. **No Data Displayed**: Verify AWS Config is enabled and rules are configured
3. **Permission Errors**: Ensure the Lambda role has the required AWS Config permissions

### Debugging

```bash
# Test Lambda function directly
aws lambda invoke \
  --function-name aws-config-custom-widgets-prod-config-rules-widget \
  --payload '{"widgetContext":{"theme":"light"},"params":{}}' \
  response.json

# Check function configuration
aws lambda get-function --function-name aws-config-custom-widgets-prod-config-rules-widget
```

## Security

### IAM Permissions

The Lambda functions use a least-privilege IAM role with the following permissions:

- `config:DescribeConfigRules`
- `config:GetComplianceSummaryByConfigRule`
- `config:GetComplianceDetailsByConfigRule`
- `config:DescribeConfigRuleEvaluationStatus`
- CloudWatch Logs permissions for the specific log groups

### Security Best Practices

- Use environment-specific configurations
- Enable X-Ray tracing for debugging in non-production environments
- Set appropriate log retention periods
- Use reserved concurrency in production to prevent resource exhaustion
- Regularly review and update IAM permissions

## Cost Optimization

- Use appropriate Lambda memory sizes (256MB is usually sufficient)
- Set log retention to reasonable periods (7-30 days for most use cases)
- Use reserved concurrency only when necessary
- Monitor Lambda execution times and adjust timeout settings

## Updating

To update the deployment:

```bash
# Plan the update
./deploy.sh plan -e prod

# Apply the update
./deploy.sh apply -e prod -a
```

## Cleanup

To destroy the infrastructure:

```bash
# Destroy with confirmation
./deploy.sh destroy -e prod

# Destroy with auto-approve
./deploy.sh destroy -e prod -a
```

## Contributing

1. Follow the existing code structure
2. Add appropriate variable validations
3. Update documentation for new features
4. Test changes in development environment first
5. Use semantic versioning for releases

## License

This project is licensed under the MIT License. 