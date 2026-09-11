ALTER TABLE `admin_radar_signals` ADD COLUMN `jurisdiction` text;
--> statement-breakpoint
ALTER TABLE `admin_radar_signals` ADD COLUMN `issue_type` text;
--> statement-breakpoint
ALTER TABLE `admin_radar_signals` ADD COLUMN `speaker_type` text;
--> statement-breakpoint
ALTER TABLE `admin_radar_signals` ADD COLUMN `marketing_play` text;
--> statement-breakpoint
ALTER TABLE `admin_radar_signals` ADD COLUMN `cluster_key` text;
--> statement-breakpoint
ALTER TABLE `admin_radar_signals` ADD COLUMN `opportunity_score` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `admin_radar_signals` ADD COLUMN `cluster_signal_count` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `admin_campaign_batches` ADD COLUMN `cluster_key` text;
--> statement-breakpoint
ALTER TABLE `admin_campaign_batches` ADD COLUMN `jurisdiction` text;
--> statement-breakpoint
ALTER TABLE `admin_campaign_batches` ADD COLUMN `issue_type` text;
--> statement-breakpoint
ALTER TABLE `admin_campaign_batches` ADD COLUMN `marketing_route` text;
--> statement-breakpoint
ALTER TABLE `admin_campaign_batches` ADD COLUMN `source_count` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_campaign_cluster_uidx` ON `admin_campaign_batches` (`cluster_key`);
--> statement-breakpoint
DELETE FROM `admin_radar_signals` WHERE `endpoint_id` IN (SELECT `id` FROM `admin_radar_endpoints` WHERE `type` LIKE 'DISCOVERY_%');
--> statement-breakpoint
DELETE FROM `admin_radar_endpoints` WHERE `type` LIKE 'DISCOVERY_%';
--> statement-breakpoint
DELETE FROM `admin_activity_log` WHERE `event_type`='DISCOVERY_PASS_COMPLETED';
