# terraform/variables.tf

# Global Variables
variable "environment" {
  description = "Environment name (development, staging, production)"
  type        = string
  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be development, staging, or production."
  }
}

variable "app_name" {
  description = "Application name"
  type        = string
  default     = "attendance-tracker"
}

# GCP Variables
variable "gcp_project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "gcp_region" {
  description = "GCP Region"
  type        = string
  default     = "asia-south1"
}

variable "gcp_zone" {
  description = "GCP Zone"
  type        = string
  default     = "asia-south1-a"
}

# Database Configuration
variable "db_instance_tier" {
  description = "Cloud SQL instance tier"
  type        = string
  default     = "db-f1-micro"
}

variable "db_username" {
  description = "Database username"
  type        = string
  default     = "attendance_user"
}

variable "db_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}

# VM Configuration (optional - for hosting)
variable "create_vm_instance" {
  description = "Whether to create a VM instance for hosting"
  type        = bool
  default     = false
}

variable "vm_machine_type" {
  description = "VM machine type"
  type        = string
  default     = "e2-micro"
}

# Domain Configuration
variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = ""
}
