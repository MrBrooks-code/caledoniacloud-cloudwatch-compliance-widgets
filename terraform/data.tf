data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Archive files for Lambda functions
data "archive_file" "config_rules_widget" {
  type        = "zip"
  source_file = "${path.module}/../src/lambda/configRulesWidget.js"
  output_path = "${path.module}/dist/configRulesWidget.zip"
}

data "archive_file" "config_compliance_widget" {
  type        = "zip"
  source_file = "${path.module}/../src/lambda/configComplianceWidget.js"
  output_path = "${path.module}/dist/configComplianceWidget.zip"
}

data "archive_file" "config_remediation_widget" {
  type        = "zip"
  source_file = "${path.module}/../src/lambda/configRemediationWidget.js"
  output_path = "${path.module}/dist/configRemediationWidget.zip"
}
