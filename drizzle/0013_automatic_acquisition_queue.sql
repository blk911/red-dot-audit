ALTER TABLE `admin_census_deployments` ADD COLUMN `acquisition_status` text DEFAULT 'QUEUED' NOT NULL;
ALTER TABLE `admin_census_deployments` ADD COLUMN `acquisition_attempts` integer DEFAULT 0 NOT NULL;
ALTER TABLE `admin_census_deployments` ADD COLUMN `acquisition_started_at` text;
ALTER TABLE `admin_census_deployments` ADD COLUMN `acquisition_completed_at` text;
ALTER TABLE `admin_census_deployments` ADD COLUMN `acquisition_error` text;
ALTER TABLE `admin_census_deployments` ADD COLUMN `audit_id` text;
CREATE INDEX `admin_census_acquisition_queue_idx` ON `admin_census_deployments` (`acquisition_status`,`device_count`,`evidence_count`);
ALTER TABLE `admin_jurisdiction_audits` ADD COLUMN `census_id` text;
CREATE INDEX `admin_jurisdiction_audits_census_idx` ON `admin_jurisdiction_audits` (`census_id`);
