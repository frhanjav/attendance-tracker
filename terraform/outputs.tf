# terraform/outputs.tf

# Database outputs
output "database_connection_name" {
  description = "Cloud SQL connection name"
  value       = google_sql_database_instance.postgres.connection_name
}

output "database_public_ip" {
  description = "Database public IP address"
  value       = google_sql_database_instance.postgres.public_ip_address
}

output "database_private_ip" {
  description = "Database private IP address"
  value       = google_sql_database_instance.postgres.private_ip_address
}

# Artifact Registry outputs
output "docker_repository_url" {
  description = "Docker repository URL"
  value       = "${var.gcp_region}-docker.pkg.dev/${var.gcp_project_id}/${google_artifact_registry_repository.docker_repo.repository_id}"
}

# Secret Manager outputs
output "db_secret_name" {
  description = "Database connection string secret name"
  value       = google_secret_manager_secret.db_connection_string.secret_id
}

# VM outputs (if created)
output "vm_external_ip" {
  description = "VM external IP address"
  value       = var.create_vm_instance ? google_compute_instance.app_server[0].network_interface[0].access_config[0].nat_ip : null
}

output "vm_internal_ip" {
  description = "VM internal IP address"
  value       = var.create_vm_instance ? google_compute_instance.app_server[0].network_interface[0].network_ip : null
}

# Instructions for deployment
output "deployment_instructions" {
  description = "Instructions for deploying the application"
  value = <<-EOT
    
    🚀 Infrastructure Created Successfully!
    
    📋 Next Steps:
    
    1. Update your docker-compose.prod.yml with the database connection:
       DATABASE_URL: ${google_secret_manager_secret_version.db_connection_string.secret_data}
    
    2. Build and push your Docker images:
       docker build -t ${var.gcp_region}-docker.pkg.dev/${var.gcp_project_id}/${google_artifact_registry_repository.docker_repo.repository_id}/attendance-tracker-backend:latest ./backend
       docker build -t ${var.gcp_region}-docker.pkg.dev/${var.gcp_project_id}/${google_artifact_registry_repository.docker_repo.repository_id}/attendance-tracker-frontend:latest ./frontend
       
       gcloud auth configure-docker ${var.gcp_region}-docker.pkg.dev
       docker push ${var.gcp_region}-docker.pkg.dev/${var.gcp_project_id}/${google_artifact_registry_repository.docker_repo.repository_id}/attendance-tracker-backend:latest
       docker push ${var.gcp_region}-docker.pkg.dev/${var.gcp_project_id}/${google_artifact_registry_repository.docker_repo.repository_id}/attendance-tracker-frontend:latest
    
    3. Deploy on your server:
       docker-compose -f docker-compose.prod.yml pull
       docker-compose -f docker-compose.prod.yml up -d
    
    📊 Resources Created:
    - Database: ${google_sql_database_instance.postgres.name}
    - Docker Registry: ${google_artifact_registry_repository.docker_repo.repository_id}
    - Database Secret: ${google_secret_manager_secret.db_connection_string.secret_id}
    ${var.create_vm_instance ? "- VM Instance: ${google_compute_instance.app_server[0].name}" : ""}
    
  EOT
  sensitive = false
}
