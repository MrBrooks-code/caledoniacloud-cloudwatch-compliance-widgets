locals {
  name_prefix = "${var.project_name}-${var.environment}"
  
  # Merge default tags with provided tags
  common_tags = merge(var.tags, {
    Name = local.name_prefix
  })
}