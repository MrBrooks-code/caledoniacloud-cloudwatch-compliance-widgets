# AWS Config Rules Dashboard - CloudWatch Custom Widgets

A responsive HTML dashboard that displays real-time status of AWS Config rules as CloudWatch Custom Widgets, integrating seamlessly with existing CloudWatch dashboards.

## Features

- **Real-time Config Rules Status**: Display current compliance status of all configured AWS Config rules
- **CloudWatch Native Integration**: Built as Custom Widgets that embed directly into CloudWatch dashboards
- **Interactive Elements**: Use `<cwdb-action>` tags for rule remediation and resource drilling
- **Responsive Design**: Adapts to widget dimensions and CloudWatch time ranges
- **SVG Visualizations**: Compliance charts and trending data without external dependencies
- **Search & Filter**: Filter rules by name, compliance status, or resource type
- **Multi-Widget Support**: Different widgets for compliance summary, rule details, and remediation

## Architecture

This implementation follows the patterns from [aws-samples/cloudwatch-custom-widgets-samples](https://github.com/aws-samples/cloudwatch-custom-widgets-samples):

- **Lambda Backend**: Core logic for fetching AWS Config data
- **HTML Response**: Styled HTML/CSS with embedded SVG charts
- **Widget Context Integration**: Leverage `widgetContext` for dashboard awareness
- **Interactive Actions**: Using `<cwdb-action>` tags for rule remediation

## Quick Start

### Prerequisites
- AWS CLI configured with appropriate permissions
- Node.js 18.x or Python 3.9+
- AWS Config service enabled in your account

### Deployment Options

#### Option 1: Terraform (Recommended)

The project includes a comprehensive Terraform module for infrastructure deployment:

```bash
# Navigate to terraform directory
cd terraform

# Deploy to development
./deploy.sh apply -e dev

# Deploy to production
./deploy.sh apply -e prod -a
```

For detailed Terraform documentation, see [terraform/README.md](terraform/README.md).

#### Option 2: CloudFormation

1. **Deploy the Lambda Functions**:
   ```bash
   aws cloudformation deploy \
     --template-file src/templates/config-widgets.yaml \
     --stack-name aws-config-widgets \
     --capabilities CAPABILITY_IAM
   ```

2. **Add Custom Widgets to CloudWatch Dashboard**:
   - Open CloudWatch Console
   - Create or edit a dashboard
   - Add Custom Widget
   - Use the Lambda function ARN from the CloudFormation output

### Widget Types

1. **Config Rules Summary Widget**: Overview of all Config rules with compliance status
2. **Config Compliance Details Widget**: Detailed view with resource information
3. **Config Remediation Widget**: Interactive remediation actions

## Project Structure

```
aws-config-custom-widget/
├── src/
│   ├── lambda/
│   │   ├── configRulesWidget.js      # Main Config rules widget
│   │   ├── configComplianceWidget.js # Compliance details widget
│   │   └── configRemediationWidget.js # Remediation actions widget
│   └── templates/
│       ├── config-widgets.yaml       # CloudFormation template
│       └── dashboard-example.yaml    # Example dashboard
├── terraform/                        # Terraform infrastructure module
│   ├── main.tf                       # Main Terraform configuration
│   ├── variables.tf                  # Variable definitions
│   ├── outputs.tf                    # Output definitions
│   ├── deploy.sh                     # Terraform deployment script
│   ├── terraform.tfvars.example      # Example configuration
│   ├── environments/                 # Environment-specific configs
│   │   ├── dev.tfvars
│   │   ├── staging.tfvars
│   │   └── prod.tfvars
│   └── README.md                     # Terraform documentation
├── scripts/
│   └── deploy.sh                     # CloudFormation deployment script
├── tests/
│   └── widget-tests.js               # Unit tests
└── README.md
```

## Configuration

### Widget Parameters

Each widget accepts the following parameters:

- `region`: AWS region (defaults to widget context region)
- `ruleNames`: Array of specific rule names to display
- `complianceStatus`: Filter by compliance status (COMPLIANT, NON_COMPLIANT, INSUFFICIENT_DATA)
- `resourceTypes`: Filter by resource types
- `showRemediation`: Enable/disable remediation buttons

### IAM Permissions

The Lambda functions require the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "config:DescribeConfigRules",
        "config:GetComplianceSummaryByConfigRule",
        "config:GetComplianceDetailsByConfigRule",
        "config:DescribeConfigRuleEvaluationStatus"
      ],
      "Resource": "*"
    }
  ]
}
```

## Development

### Local Testing

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run Tests**:
   ```bash
   npm test
   ```

3. **Deploy Changes**:
   ```bash
   ./scripts/deploy.sh
   ```

### Customization

- **Styling**: Modify CSS in the HTML generation functions
- **Charts**: Update SVG generation for different visualizations
- **Actions**: Add new `<cwdb-action>` tags for additional functionality
- **Data Sources**: Extend Lambda functions to fetch additional Config data

## Security

- **Least Privilege**: IAM roles with minimal required permissions
- **Input Validation**: All user inputs are validated and sanitized
- **No Hardcoded Credentials**: Uses AWS SDK default credential chain
- **CORS Configuration**: Proper CORS headers for cross-origin requests

## Troubleshooting

### Common Issues

1. **Widget Not Loading**: Check Lambda function permissions and CloudWatch logs
2. **No Data Displayed**: Verify AWS Config is enabled and rules are configured
3. **Interactive Elements Not Working**: Ensure `<cwdb-action>` tags are properly formatted

### Debugging

- Check CloudWatch logs for Lambda function errors
- Verify widget context parameters in CloudWatch dashboard
- Test Lambda function directly with sample event data

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For issues and questions:
- Create an issue in the GitHub repository
- Check CloudWatch logs for detailed error information
- Review AWS Config service documentation

## Roadmap

- [ ] Multi-account support
- [ ] Advanced filtering and search
- [ ] Historical compliance trending
- [ ] Automated remediation workflows
- [ ] Custom rule templates
- [ ] Integration with AWS Security Hub 