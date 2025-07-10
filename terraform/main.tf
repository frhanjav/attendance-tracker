# terraform/main.tf
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

# Local values for common tags and configuration
locals {
  common_tags = {
    Project     = "attendance-tracker"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# GCP Provider configuration
provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
}

# Create Artifact Registry for Docker images
resource "google_artifact_registry_repository" "docker_repo" {
  location      = var.gcp_region
  repository_id = "attendance-repo-multiarch"
  description   = "Docker repository for attendance tracker application"
  format        = "DOCKER"
}

# Create Cloud SQL PostgreSQL instance
resource "google_sql_database_instance" "postgres" {
  name             = "attendance-tracker-db-${var.environment}"
  database_version = "POSTGRES_15"
  region           = var.gcp_region
  deletion_protection = false

  settings {
    tier = var.db_instance_tier
    
    backup_configuration {
      enabled = true
      point_in_time_recovery_enabled = true
    }
    
    ip_configuration {
      ipv4_enabled = true
      authorized_networks {
        name  = "allow-all-for-development"
        value = "0.0.0.0/0"
      }
    }
    
    database_flags {
      name  = "log_statement"
      value = "all"
    }
  }
}

# Create database
resource "google_sql_database" "database" {
  name     = "attendance_tracker"
  instance = google_sql_database_instance.postgres.name
}

# Create database user
resource "google_sql_user" "user" {
  name     = var.db_username
  instance = google_sql_database_instance.postgres.name
  password = var.db_password
}

# Create Secret Manager secrets for sensitive data
resource "google_secret_manager_secret" "db_connection_string" {
  secret_id = "db-connection-string-${var.environment}"
  
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "db_connection_string" {
  secret = google_secret_manager_secret.db_connection_string.id
  secret_data = "postgresql://${var.db_username}:${var.db_password}@${google_sql_database_instance.postgres.public_ip_address}:5432/${google_sql_database.database.name}"
}

# Create a VM instance for hosting (optional - you might use your existing VM)
resource "google_compute_instance" "app_server" {
  count        = var.create_vm_instance ? 1 : 0
  name         = "attendance-tracker-${var.environment}"
  machine_type = var.vm_machine_type
  zone         = var.gcp_zone

  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2204-lts"
      size  = 20
    }
  }

  network_interface {
    network = "default"
    access_config {
      // Ephemeral public IP
    }
  }

  metadata_startup_script = <<-EOF
    #!/bin/bash
    apt-get update
    apt-get install -y docker.io docker-compose
    usermod -aG docker $USER
    systemctl enable docker
    systemctl start docker
    
    # Install Google Cloud SDK
    curl https://sdk.cloud.google.com | bash
    exec -l $SHELL
    
    # Create app directory
    mkdir -p /home/attendance-tracker
    chown $USER:$USER /home/attendance-tracker
  EOF

  tags = ["attendance-tracker", var.environment]
}

# Firewall rule to allow HTTP/HTTPS traffic
resource "google_compute_firewall" "allow_http" {
  count   = var.create_vm_instance ? 1 : 0
  name    = "allow-attendance-tracker-${var.environment}"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["80", "443", "3000", "5000"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["attendance-tracker"]
}
