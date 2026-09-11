CREATE TABLE `admin_jurisdiction_evidence` (
  `id` text PRIMARY KEY NOT NULL,
  `audit_id` text NOT NULL,
  `friction_id` text NOT NULL,
  `jurisdiction` text NOT NULL,
  `normalized_jurisdiction` text NOT NULL,
  `evidence_type` text NOT NULL,
  `title` text,
  `source_url` text NOT NULL,
  `publisher_domain` text NOT NULL,
  `source_class` text NOT NULL,
  `status` text NOT NULL,
  `excerpt` text,
  `failure_reason` text,
  `discovered_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `verified_at` text,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX `admin_jurisdiction_evidence_audit_url_uidx` ON `admin_jurisdiction_evidence` (`audit_id`,`source_url`);
CREATE INDEX `admin_jurisdiction_evidence_audit_status_idx` ON `admin_jurisdiction_evidence` (`audit_id`,`status`);
CREATE INDEX `admin_jurisdiction_evidence_jurisdiction_type_idx` ON `admin_jurisdiction_evidence` (`normalized_jurisdiction`,`evidence_type`);
CREATE INDEX `admin_jurisdiction_metrics_jurisdiction_status_idx` ON `admin_jurisdiction_metrics` (`normalized_jurisdiction`,`verification_status`);
