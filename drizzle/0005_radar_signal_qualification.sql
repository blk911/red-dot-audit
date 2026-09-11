ALTER TABLE `admin_radar_endpoints` ADD COLUMN `last_http_status` integer;
--> statement-breakpoint
ALTER TABLE `admin_radar_endpoints` ADD COLUMN `last_error` text;
--> statement-breakpoint
ALTER TABLE `admin_radar_endpoints` ADD COLUMN `content_excerpt` text;
--> statement-breakpoint
ALTER TABLE `admin_radar_signals` ADD COLUMN `change_reason` text;
--> statement-breakpoint
ALTER TABLE `admin_radar_signals` ADD COLUMN `diff_excerpt` text;
--> statement-breakpoint
ALTER TABLE `admin_radar_signals` ADD COLUMN `change_fingerprint` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_radar_signal_change_uidx` ON `admin_radar_signals` (`endpoint_id`,`change_fingerprint`);
