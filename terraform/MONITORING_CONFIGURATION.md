# AWS Config Custom Widgets - Monitoring Configuration Guide

This guide explains how to configure the AWS Config Custom Widgets to monitor specific rules, resource types, and compliance statuses.

## 🎯 **Overview**

The widgets support three types of filtering:
1. **Specific Config Rules** - Monitor only certain AWS Config rules
2. **Resource Types** - Focus on specific AWS resource types
3. **Compliance Status** - Filter by compliance state

## 🔧 **Configuration Variables**

### **1. Monitored Config Rules**
```hcl
monitored_config_rules = [
  "s3-bucket-public-read-prohibited",
  "vpc-flow-logs-enabled",
  "iam-password-policy"
]
```

### **2. Monitored Resource Types**
```hcl
monitored_resource_types = [
  "AWS::S3::Bucket",
  "AWS::EC2::VPC",
  "AWS::IAM::User"
]
```

### **3. Compliance Status Filter**
```hcl
compliance_status_filter = "NON_COMPLIANT"  # or "COMPLIANT", "INSUFFICIENT_DATA", or "" for all
```

## 📋 **Example Configurations**

### **Security-Focused Dashboard**
```hcl
# Monitor only security-critical rules
monitored_config_rules = [
  "s3-bucket-public-read-prohibited",
  "s3-bucket-public-write-prohibited",
  "vpc-flow-logs-enabled",
  "rds-instance-public-access-check",
  "iam-password-policy",
  "root-account-mfa-enabled"
]

# Focus on non-compliant resources
compliance_status_filter = "NON_COMPLIANT"
```

### **S3-Specific Dashboard**
```hcl
# Monitor only S3-related rules
monitored_config_rules = [
  "s3-bucket-public-read-prohibited",
  "s3-bucket-public-write-prohibited",
  "s3-bucket-ssl-requests-only",
  "s3-bucket-versioning-enabled"
]

# Monitor only S3 resources
monitored_resource_types = ["AWS::S3::Bucket"]

# Show all compliance statuses
compliance_status_filter = ""
```

### **Comprehensive Production Dashboard**
```hcl
# Monitor all critical compliance rules
monitored_config_rules = [
  "s3-bucket-public-read-prohibited",
  "vpc-flow-logs-enabled",
  "rds-instance-public-access-check",
  "iam-password-policy",
  "cloudtrail-enabled",
  "ec2-instance-managed-by-systems-manager"
]

# Monitor all critical resource types
monitored_resource_types = [
  "AWS::S3::Bucket",
  "AWS::EC2::VPC",
  "AWS::EC2::Instance",
  "AWS::RDS::DBInstance",
  "AWS::IAM::User"
]

# Show all compliance statuses
compliance_status_filter = ""
```

## 🚀 **How to Apply Configuration**

### **1. Update Environment File**
Edit your environment-specific `.tfvars` file (e.g., `environments/dev.tfvars`):

```hcl
# Add monitoring configuration
monitored_config_rules = [
  "your-rule-name-1",
  "your-rule-name-2"
]

monitored_resource_types = [
  "AWS::Your::ResourceType"
]

compliance_status_filter = "NON_COMPLIANT"
```

### **2. Apply Changes**
```bash
cd terraform
terraform apply -var-file="environments/dev.tfvars"
```

## 📊 **Available AWS Config Rules**

### **Common Security Rules**
- `s3-bucket-public-read-prohibited`
- `s3-bucket-public-write-prohibited`
- `vpc-flow-logs-enabled`
- `rds-instance-public-access-check`
- `iam-password-policy`
- `iam-user-mfa-enabled`
- `root-account-mfa-enabled`
- `cloudtrail-enabled`

### **Common Resource Types**
- `AWS::S3::Bucket`
- `AWS::EC2::VPC`
- `AWS::EC2::Instance`
- `AWS::RDS::DBInstance`
- `AWS::IAM::User`
- `AWS::IAM::Role`
- `AWS::Lambda::Function`

## 🔍 **Finding Your Config Rules**

To see all available Config rules in your account:

```bash
aws configservice describe-config-rules --region us-east-1
```

To see rules for specific resource types:

```bash
aws configservice describe-config-rules --region us-east-1 --query 'ConfigRules[?Scope.ComplianceResourceTypes[0]==`AWS::S3::Bucket`]'
```

## ⚙️ **Advanced Filtering**

### **Multiple Filters**
You can combine all three filter types:
```hcl
monitored_config_rules = ["s3-bucket-public-read-prohibited"]
monitored_resource_types = ["AWS::S3::Bucket"]
compliance_status_filter = "NON_COMPLIANT"
```

### **No Filters**
Leave arrays empty to show all rules/resources:
```hcl
monitored_config_rules = []
monitored_resource_types = []
compliance_status_filter = ""
```

## 🎨 **Widget Behavior**

- **Config Rules Widget**: Shows filtered list of rules with compliance status
- **Compliance Widget**: Shows detailed compliance for filtered rules
- **Remediation Widget**: Shows remediation actions for filtered non-compliant rules

## 🔄 **Real-time Updates**

The widgets automatically refresh and respect your filters when:
- Dashboard is refreshed
- Widget is resized
- Time range is changed
- New data is available 