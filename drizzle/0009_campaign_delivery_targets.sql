CREATE TABLE `admin_campaign_delivery_targets` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`platform` text NOT NULL,
	`destination_name` text,
	`destination_url` text,
	`source_url` text,
	`post_title` text,
	`post_body` text,
	`status` text DEFAULT 'NEEDS_DESTINATION' NOT NULL,
	`delivered_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_campaign_delivery_targets_campaign_platform_uidx` ON `admin_campaign_delivery_targets` (`campaign_id`,`platform`);--> statement-breakpoint
CREATE INDEX `admin_campaign_delivery_targets_status_idx` ON `admin_campaign_delivery_targets` (`status`,`updated_at`);
