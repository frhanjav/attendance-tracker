# This file references the main Terraform configuration

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  backend "gcs" {
    # Configuration will be provided via backend.tfvars
  }
}

# Use the main module
module "attendance_tracker" {
  source = "../../"

  # Pass variables to the main module
  environment        = var.environment
  gcp_project_id     = var.gcp_project_id
  gcp_region         = var.gcp_region
  gcp_zone           = var.gcp_zone
  app_name           = var.app_name
  create_vm_instance = var.create_vm_instance
  vm_machine_type    = var.vm_machine_type
  domain_name        = var.domain_name
}

# Output the values from the module
output "vm_external_ip" {
  description = "VM external IP address"
  value       = module.attendance_tracker.vm_external_ip
}

output "vm_internal_ip" {
  description = "VM internal IP address"
  value       = module.attendance_tracker.vm_internal_ip
}

output "vm_name" {
  description = "VM instance name"
  value       = module.attendance_tracker.vm_name
}

output "docker_repository_url" {
  description = "Docker repository URL"
  value       = module.attendance_tracker.docker_repository_url
}

output "vm_service_account_email" {
  description = "VM service account email"
  value       = module.attendance_tracker.vm_service_account_email
}
