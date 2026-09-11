CREATE TABLE `admin_friction_opportunities` (
	`id` text PRIMARY KEY NOT NULL,
	`generation_id` text NOT NULL,
	`cluster_key` text NOT NULL,
	`jurisdiction` text NOT NULL,
	`issue_type` text NOT NULL,
	`voice_type` text NOT NULL,
	`voice_name` text,
	`complaint_summary` text NOT NULL,
	`origin_url` text NOT NULL,
	`channel` text NOT NULL,
	`published_at` text,
	`source_count` integer DEFAULT 1 NOT NULL,
	`independent_source_count` integer DEFAULT 1 NOT NULL,
	`specificity_score` integer NOT NULL,
	`harm_score` integer NOT NULL,
	`corroboration_score` integer NOT NULL,
	`official_response_score` integer NOT NULL,
	`reachability_score` integer NOT NULL,
	`recency_score` integer NOT NULL,
	`friction_score` integer NOT NULL,
	`state` text NOT NULL,
	`source_urls_json` text DEFAULT '[]' NOT NULL,
	`audit_started_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_friction_generation_cluster_uidx` ON `admin_friction_opportunities` (`generation_id`,`cluster_key`);--> statement-breakpoint
CREATE INDEX `admin_friction_state_score_idx` ON `admin_friction_opportunities` (`state`,`friction_score`);
