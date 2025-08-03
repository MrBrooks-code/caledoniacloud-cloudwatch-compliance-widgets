#!/bin/bash

# AWS Config Rules Dashboard - CloudWatch Custom Widgets Deployment Script

set -e

# Configuration
STACK_NAME="aws-config-widgets"
TEMPLATE_FILE="src/templates/config-widgets.yaml"
REGION="${AWS_REGION:-us-east-1}"
ENVIRONMENT="${ENVIRONMENT:-prod}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if AWS CLI is installed and configured
check_aws_cli() {
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi
    
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS CLI is not configured. Please run 'aws configure' first."
        exit 1
    fi
    
    print_success "AWS CLI is installed and configured"
}

# Function to check if template file exists
check_template() {
    if [ ! -f "$TEMPLATE_FILE" ]; then
        print_error "Template file not found: $TEMPLATE_FILE"
        exit 1
    fi
    
    print_success "Template file found: $TEMPLATE_FILE"
}

# Function to validate CloudFormation template
validate_template() {
    print_status "Validating CloudFormation template..."
    
    if aws cloudformation validate-template --template-body file://"$TEMPLATE_FILE" --region "$REGION" &> /dev/null; then
        print_success "Template validation successful"
    else
        print_error "Template validation failed"
        exit 1
    fi
}

# Function to check if stack exists
stack_exists() {
    aws cloudformation describe-stacks --stack-name "$STACK_NAME" --region "$REGION" &> /dev/null
}

# Function to deploy the stack
deploy_stack() {
    print_status "Deploying CloudFormation stack: $STACK_NAME"
    
    local deploy_command="aws cloudformation deploy \
        --template-file $TEMPLATE_FILE \
        --stack-name $STACK_NAME \
        --capabilities CAPABILITY_IAM \
        --region $REGION \
        --parameter-overrides Environment=$ENVIRONMENT"
    
    if [ "$ENVIRONMENT" = "prod" ]; then
        deploy_command="$deploy_command --no-fail-on-empty-changeset"
    fi
    
    if eval "$deploy_command"; then
        print_success "Stack deployment completed successfully"
    else
        print_error "Stack deployment failed"
        exit 1
    fi
}

# Function to get stack outputs
get_stack_outputs() {
    print_status "Getting stack outputs..."
    
    local outputs
    outputs=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --query 'Stacks[0].Outputs' \
        --output json 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        echo "$outputs" | jq -r '.[] | "\(.OutputKey): \(.OutputValue)"'
    else
        print_warning "Could not retrieve stack outputs"
    fi
}

# Function to display deployment instructions
display_instructions() {
    print_status "Deployment completed! Here's how to use the widgets:"
    echo ""
    echo "1. Open AWS CloudWatch Console"
    echo "2. Navigate to Dashboards"
    echo "3. Create a new dashboard or edit an existing one"
    echo "4. Click 'Add widget' and select 'Custom widget'"
    echo "5. Use one of the following Lambda function ARNs:"
    echo ""
    
    # Get the function ARNs from stack outputs
    local config_rules_arn
    local config_compliance_arn
    local config_remediation_arn
    
    config_rules_arn=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --query 'Stacks[0].Outputs[?OutputKey==`ConfigRulesWidgetFunctionArn`].OutputValue' \
        --output text 2>/dev/null)
    
    config_compliance_arn=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --query 'Stacks[0].Outputs[?OutputKey==`ConfigComplianceWidgetFunctionArn`].OutputValue' \
        --output text 2>/dev/null)
    
    config_remediation_arn=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --query 'Stacks[0].Outputs[?OutputKey==`ConfigRemediationWidgetFunctionArn`].OutputValue' \
        --output text 2>/dev/null)
    
    if [ "$config_rules_arn" != "None" ] && [ -n "$config_rules_arn" ]; then
        echo "   • Config Rules Widget: $config_rules_arn"
    fi
    
    if [ "$config_compliance_arn" != "None" ] && [ -n "$config_compliance_arn" ]; then
        echo "   • Config Compliance Widget: $config_compliance_arn"
    fi
    
    if [ "$config_remediation_arn" != "None" ] && [ -n "$config_remediation_arn" ]; then
        echo "   • Config Remediation Widget: $config_remediation_arn"
    fi
    
    echo ""
    echo "6. Configure widget parameters as needed:"
    echo "   • region: AWS region (optional)"
    echo "   • ruleNames: Array of specific rule names (optional)"
    echo "   • complianceStatus: Filter by status (optional)"
    echo "   • resourceTypes: Filter by resource types (optional)"
    echo "   • showRemediation: Enable/disable remediation buttons (optional)"
    echo ""
    echo "7. Save the dashboard"
    echo ""
    print_success "Your AWS Config Rules Dashboard is ready!"
}

# Function to clean up resources (for development)
cleanup() {
    print_warning "This will delete the CloudFormation stack and all associated resources."
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Deleting CloudFormation stack: $STACK_NAME"
        
        if aws cloudformation delete-stack --stack-name "$STACK_NAME" --region "$REGION"; then
            print_success "Stack deletion initiated. Check CloudFormation console for progress."
        else
            print_error "Stack deletion failed"
            exit 1
        fi
    else
        print_status "Cleanup cancelled"
    fi
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS] COMMAND"
    echo ""
    echo "Commands:"
    echo "  deploy     Deploy the AWS Config Custom Widgets"
    echo "  cleanup    Delete the CloudFormation stack (development only)"
    echo "  validate   Validate the CloudFormation template"
    echo "  status     Show deployment status and outputs"
    echo ""
    echo "Options:"
    echo "  -r, --region REGION     AWS region (default: us-east-1)"
    echo "  -e, --environment ENV   Environment name (default: prod)"
    echo "  -h, --help             Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  AWS_REGION             AWS region"
    echo "  ENVIRONMENT            Environment name"
    echo ""
    echo "Examples:"
    echo "  $0 deploy"
    echo "  $0 deploy --region us-west-2 --environment dev"
    echo "  $0 cleanup"
    echo "  $0 status"
}

# Parse command line arguments
COMMAND=""
while [[ $# -gt 0 ]]; do
    case $1 in
        deploy|cleanup|validate|status)
            COMMAND="$1"
            shift
            ;;
        -r|--region)
            REGION="$2"
            shift 2
            ;;
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Check if command is provided
if [ -z "$COMMAND" ]; then
    print_error "No command specified"
    show_usage
    exit 1
fi

# Main execution
case $COMMAND in
    deploy)
        print_status "Starting deployment process..."
        print_status "Region: $REGION"
        print_status "Environment: $ENVIRONMENT"
        print_status "Stack Name: $STACK_NAME"
        echo ""
        
        check_aws_cli
        check_template
        validate_template
        deploy_stack
        get_stack_outputs
        display_instructions
        ;;
    cleanup)
        cleanup
        ;;
    validate)
        check_aws_cli
        check_template
        validate_template
        ;;
    status)
        if stack_exists; then
            print_success "Stack exists: $STACK_NAME"
            get_stack_outputs
        else
            print_warning "Stack does not exist: $STACK_NAME"
        fi
        ;;
    *)
        print_error "Unknown command: $COMMAND"
        show_usage
        exit 1
        ;;
esac 