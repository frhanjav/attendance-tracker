# terraform/main.tf
terraform {
  required_version = ">= 1.6.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  # No backend configuration - this is a module
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

# Create a service account for the VM instance
resource "google_service_account" "vm_service_account" {
  account_id   = "attendance-vm-${var.environment}"
  display_name = "Attendance Tracker VM Service Account (${var.environment})"
  description  = "Service account for attendance tracker VM to access GCP services"
}

# Grant necessary permissions to the service account
resource "google_project_iam_member" "vm_artifact_registry_reader" {
  project = var.gcp_project_id
  role    = "roles/artifactregistry.reader"
  member  = "serviceAccount:${google_service_account.vm_service_account.email}"
}

# Reserve a static external IP address
resource "google_compute_address" "vm_static_ip" {
  count  = var.create_vm_instance ? 1 : 0
  name   = "attendance-tracker-${var.environment}-ip"
  region = var.gcp_region
}

# Create a VM instance for hosting (optional - you might use your existing VM)
resource "google_compute_instance" "app_server" {
  count        = var.create_vm_instance ? 1 : 0
  name         = "attendance-tracker-${var.environment}"
  machine_type = var.vm_machine_type
  zone         = var.gcp_zone

  # Allow stopping for updates (needed when changing service account)
  allow_stopping_for_update = true

  # Attach the service account to the VM
  service_account {
    email  = google_service_account.vm_service_account.email
    scopes = [
      "https://www.googleapis.com/auth/cloud-platform",
      "https://www.googleapis.com/auth/devstorage.read_only",
      "https://www.googleapis.com/auth/logging.write",
      "https://www.googleapis.com/auth/monitoring.write"
    ]
  }

  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2204-lts"
      size  = 20
    }
  }

  network_interface {
    network = "default"
    access_config {
      nat_ip = var.create_vm_instance ? google_compute_address.vm_static_ip[0].address : null
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
