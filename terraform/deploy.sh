#!/bin/bash

# AWS Config Custom Widgets - Terraform Deployment Script
# This script handles deployment of the Terraform infrastructure

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="prod"
ACTION="apply"
WORKSPACE="default"
AUTO_APPROVE=""

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

# Function to show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS] ACTION

Actions:
    plan     - Show execution plan
    apply    - Apply the configuration (default)
    destroy  - Destroy the infrastructure
    init     - Initialize Terraform
    validate - Validate the configuration
    output   - Show outputs
    refresh  - Refresh Terraform state

Options:
    -e, --environment ENV    Environment (dev, staging, prod) [default: prod]
    -w, --workspace WS       Terraform workspace [default: default]
    -a, --auto-approve       Auto-approve changes (for apply/destroy)
    -h, --help              Show this help message

Examples:
    $0 plan -e dev
    $0 apply -e prod -a
    $0 destroy -e dev
    $0 output -e prod

EOF
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if Terraform is installed
    if ! command -v terraform &> /dev/null; then
        print_error "Terraform is not installed. Please install Terraform first."
        exit 1
    fi
    
    # Check if AWS CLI is installed
    if ! command -v aws &> /dev/null; then
        print_error "AWS CLI is not installed. Please install AWS CLI first."
        exit 1
    fi
    
    # Check if AWS credentials are configured
    if ! aws sts get-caller-identity &> /dev/null; then
        print_error "AWS credentials are not configured. Please run 'aws configure' first."
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Function to initialize Terraform
init_terraform() {
    print_status "Initializing Terraform..."
    
    # Create dist directory if it doesn't exist
    mkdir -p dist
    
    terraform init
    print_success "Terraform initialized successfully"
}

# Function to select workspace
select_workspace() {
    print_status "Selecting workspace: $WORKSPACE"
    
    # Check if workspace exists, create if not
    if ! terraform workspace list | grep -q "$WORKSPACE"; then
        print_status "Creating workspace: $WORKSPACE"
        terraform workspace new "$WORKSPACE"
    else
        terraform workspace select "$WORKSPACE"
    fi
    
    print_success "Workspace selected: $WORKSPACE"
}

# Function to validate configuration
validate_config() {
    print_status "Validating Terraform configuration..."
    terraform validate
    print_success "Configuration validation passed"
}

# Function to plan changes
plan_changes() {
    print_status "Creating execution plan..."
    
    local tfvars_file="environments/${ENVIRONMENT}.tfvars"
    if [ ! -f "$tfvars_file" ]; then
        print_error "Environment configuration file not found: $tfvars_file"
        exit 1
    fi
    
    terraform plan -var-file="$tfvars_file" -out=tfplan
    print_success "Execution plan created: tfplan"
}

# Function to apply changes
apply_changes() {
    print_status "Applying changes..."
    
    local tfvars_file="environments/${ENVIRONMENT}.tfvars"
    if [ ! -f "$tfvars_file" ]; then
        print_error "Environment configuration file not found: $tfvars_file"
        exit 1
    fi
    
    if [ -f "tfplan" ]; then
        terraform apply $AUTO_APPROVE tfplan
    else
        terraform apply $AUTO_APPROVE -var-file="$tfvars_file"
    fi
    
    print_success "Changes applied successfully"
}

# Function to destroy infrastructure
destroy_infrastructure() {
    print_warning "This will destroy all infrastructure for environment: $ENVIRONMENT"
    read -p "Are you sure you want to continue? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        print_status "Destroy cancelled"
        exit 0
    fi
    
    print_status "Destroying infrastructure..."
    
    local tfvars_file="environments/${ENVIRONMENT}.tfvars"
    if [ ! -f "$tfvars_file" ]; then
        print_error "Environment configuration file not found: $tfvars_file"
        exit 1
    fi
    
    terraform destroy $AUTO_APPROVE -var-file="$tfvars_file"
    print_success "Infrastructure destroyed successfully"
}

# Function to show outputs
show_outputs() {
    print_status "Showing Terraform outputs..."
    terraform output
}

# Function to refresh state
refresh_state() {
    print_status "Refreshing Terraform state..."
    terraform refresh
    print_success "State refreshed successfully"
}

# Function to show deployment summary
show_summary() {
    if [ "$ACTION" = "apply" ]; then
        print_success "Deployment completed successfully!"
        echo
        print_status "Deployment Summary:"
        echo "  Environment: $ENVIRONMENT"
        echo "  Workspace: $WORKSPACE"
        echo "  Region: $(aws configure get region)"
        echo
        print_status "Next steps:"
        echo "  1. Check the outputs above for Lambda function ARNs"
        echo "  2. Add the widgets to your CloudWatch dashboard"
        echo "  3. Monitor the Lambda functions in CloudWatch Logs"
        echo
        print_status "Useful commands:"
        echo "  Show outputs: $0 output -e $ENVIRONMENT"
        echo "  View logs: aws logs tail /aws/lambda/aws-config-custom-widgets-${ENVIRONMENT}-config-rules-widget"
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        plan|apply|destroy|init|validate|output|refresh)
            ACTION="$1"
            shift
            ;;
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -w|--workspace)
            WORKSPACE="$2"
            shift 2
            ;;
        -a|--auto-approve)
            AUTO_APPROVE="-auto-approve"
            shift
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

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
    print_error "Invalid environment: $ENVIRONMENT. Must be dev, staging, or prod."
    exit 1
fi

# Main execution
main() {
    print_status "Starting deployment for environment: $ENVIRONMENT"
    
    # Check prerequisites
    check_prerequisites
    
    # Change to terraform directory
    cd "$(dirname "$0")"
    
    # Initialize Terraform
    init_terraform
    
    # Select workspace
    select_workspace
    
    # Execute action
    case $ACTION in
        init)
            print_success "Initialization completed"
            ;;
        validate)
            validate_config
            ;;
        plan)
            validate_config
            plan_changes
            ;;
        apply)
            validate_config
            plan_changes
            apply_changes
            show_summary
            ;;
        destroy)
            destroy_infrastructure
            ;;
        output)
            show_outputs
            ;;
        refresh)
            refresh_state
            ;;
        *)
            print_error "Unknown action: $ACTION"
            show_usage
            exit 1
            ;;
    esac
}

# Run main function
main "$@" 