ALTER TABLE `admin_jurisdiction_metrics` ADD COLUMN `source_date` text;
ALTER TABLE `admin_jurisdiction_metrics` ADD COLUMN `excerpt` text;
ALTER TABLE `admin_jurisdiction_metrics` ADD COLUMN `confidence` text DEFAULT 'HIGH' NOT NULL;
