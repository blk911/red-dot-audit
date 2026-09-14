ALTER TABLE `admin_census_deployments` ADD COLUMN `acquisition_next_attempt_at` text;
ALTER TABLE `admin_census_deployments` ADD COLUMN `acquisition_terminal_reason` text;
CREATE INDEX `admin_census_next_attempt_idx` ON `admin_census_deployments` (`acquisition_status`,`acquisition_next_attempt_at`);
