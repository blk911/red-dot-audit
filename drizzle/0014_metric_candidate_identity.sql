ALTER TABLE `admin_jurisdiction_metrics` ADD COLUMN `census_id` text;
UPDATE `admin_jurisdiction_metrics` SET `census_id` = `normalized_jurisdiction` WHERE `census_id` IS NULL;
DROP INDEX `admin_jurisdiction_metrics_jurisdiction_key_uidx`;
CREATE UNIQUE INDEX `admin_jurisdiction_metrics_census_key_uidx` ON `admin_jurisdiction_metrics` (`census_id`,`metric_key`);
CREATE INDEX `admin_jurisdiction_metrics_jurisdiction_idx` ON `admin_jurisdiction_metrics` (`normalized_jurisdiction`);
