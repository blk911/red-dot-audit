CREATE TABLE `admin_census_deployments` (
  `id` text PRIMARY KEY NOT NULL,
  `jurisdiction` text NOT NULL,
  `agency` text NOT NULL,
  `state` text NOT NULL,
  `vendor_system` text NOT NULL,
  `confidence` text DEFAULT 'UNVERIFIED' NOT NULL,
  `evidence_count` integer DEFAULT 0 NOT NULL,
  `device_count` integer,
  `cost_summary` text,
  `source_urls_json` text DEFAULT '[]' NOT NULL,
  `lead_reason` text DEFAULT '' NOT NULL,
  `research_readiness` integer DEFAULT 0 NOT NULL,
  `case_file_id` text,
  `last_verified_at` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE UNIQUE INDEX `admin_census_jurisdiction_agency_uidx` ON `admin_census_deployments` (`jurisdiction`,`agency`);
CREATE INDEX `admin_census_confidence_readiness_idx` ON `admin_census_deployments` (`confidence`,`research_readiness`);

CREATE TABLE `admin_monitor_batches` (
  `id` text PRIMARY KEY NOT NULL,
  `label` text NOT NULL,
  `status` text DEFAULT 'RUNNING' NOT NULL,
  `endpoints_planned` integer DEFAULT 0 NOT NULL,
  `endpoints_checked` integer DEFAULT 0 NOT NULL,
  `changes_detected` integer DEFAULT 0 NOT NULL,
  `relevant_signals` integer DEFAULT 0 NOT NULL,
  `research_escalations` integer DEFAULT 0 NOT NULL,
  `started_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `completed_at` text,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX `admin_monitor_batches_started_idx` ON `admin_monitor_batches` (`started_at`);

CREATE TABLE `admin_campaign_batches` (
  `id` text PRIMARY KEY NOT NULL,
  `label` text NOT NULL,
  `issue_summary` text NOT NULL,
  `status` text DEFAULT 'PROPOSED' NOT NULL,
  `case_count` integer DEFAULT 0 NOT NULL,
  `target_count` integer DEFAULT 0 NOT NULL,
  `direct_count` integer DEFAULT 0 NOT NULL,
  `referral_count` integer DEFAULT 0 NOT NULL,
  `priority_score` integer DEFAULT 0 NOT NULL,
  `review_minutes` integer DEFAULT 0 NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `approved_at` text
);
CREATE INDEX `admin_campaign_status_priority_idx` ON `admin_campaign_batches` (`status`,`priority_score`);

CREATE TABLE `admin_activity_log` (
  `id` text PRIMARY KEY NOT NULL,
  `actor` text DEFAULT 'SYSTEM' NOT NULL,
  `event_type` text NOT NULL,
  `entity_type` text NOT NULL,
  `entity_id` text,
  `summary` text NOT NULL,
  `metadata_json` text DEFAULT '{}' NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX `admin_activity_created_idx` ON `admin_activity_log` (`created_at`);
CREATE INDEX `admin_activity_entity_idx` ON `admin_activity_log` (`entity_type`,`entity_id`);
