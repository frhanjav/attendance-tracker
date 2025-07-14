# terraform/environments/production/variables.tf

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "gcp_project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "gcp_region" {
  description = "GCP Region"
  type        = string
}

variable "gcp_zone" {
  description = "GCP Zone"
  type        = string
}

variable "app_name" {
  description = "Application name"
  type        = string
}

variable "create_vm_instance" {
  description = "Whether to create a VM instance"
  type        = bool
}

variable "vm_machine_type" {
  description = "VM machine type"
  type        = string
}

variable "domain_name" {
  description = "Domain name"
  type        = string
}

variable "support_email" {
  description = "Support email for OAuth consent screen"
  type        = string
}
