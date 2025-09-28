# terraform/outputs.tf

# Artifact Registry outputs
output "docker_repository_url" {
  description = "Docker repository URL"
  value       = "${var.gcp_region}-docker.pkg.dev/${var.gcp_project_id}/${google_artifact_registry_repository.docker_repo.repository_id}"
}

# Service Account outputs
output "vm_service_account_email" {
  description = "VM service account email"
  value       = google_service_account.vm_service_account.email
}

# VM outputs (if created)
output "vm_external_ip" {
  description = "VM external IP address (static)"
  value       = var.create_vm_instance ? google_compute_address.vm_static_ip[0].address : null
}

output "vm_internal_ip" {
  description = "VM internal IP address"
  value       = var.create_vm_instance ? google_compute_instance.app_server[0].network_interface[0].network_ip : null
}

output "vm_name" {
  description = "VM instance name"
  value       = var.create_vm_instance ? google_compute_instance.app_server[0].name : null
}

# Instructions for deployment
output "deployment_instructions" {
  description = "Instructions for deploying the application"
  value       = <<-EOT
    
     Infrastructure Created Successfully!
    
     Next Steps:
    
    1. Add database URL to your GitHub Actions secrets:
       - STAGING_DATABASE_URL (for staging environment)
       - PRODUCTION_DATABASE_URL (for production environment)
    
    2. Use CI/CD pipeline for deployment:
       - Push to 'develop' branch for staging deployment
       - Push to 'main' branch for production deployment
       
       The pipeline will automatically:
       - Build and push Docker images to: ${var.gcp_region}-docker.pkg.dev/${var.gcp_project_id}/${google_artifact_registry_repository.docker_repo.repository_id}
       - Deploy to your VM using docker-compose
    
    3. Manual deployment (if needed):
       docker-compose -f docker-compose.staging.yml pull && docker-compose -f docker-compose.staging.yml up -d
    
     Resources Created:
    - Docker Registry: ${google_artifact_registry_repository.docker_repo.repository_id}
    - VM Service Account: ${google_service_account.vm_service_account.email}
    ${var.create_vm_instance ? "- VM Instance: ${google_compute_instance.app_server[0].name}" : ""}
    - Database: Using Aiven PostgreSQL (managed via GitHub Actions secrets)
    
  EOT
  sensitive   = false
}
