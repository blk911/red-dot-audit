CREATE TABLE `admin_jurisdiction_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`normalized_jurisdiction` text NOT NULL,
	`jurisdiction` text NOT NULL,
	`metric_key` text NOT NULL,
	`value` text NOT NULL,
	`label` text NOT NULL,
	`source_url` text NOT NULL,
	`verification_status` text DEFAULT 'SOURCE_VERIFIED' NOT NULL,
	`verified_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_jurisdiction_metrics_jurisdiction_key_uidx` ON `admin_jurisdiction_metrics` (`normalized_jurisdiction`,`metric_key`);--> statement-breakpoint
CREATE INDEX `admin_jurisdiction_metrics_verified_idx` ON `admin_jurisdiction_metrics` (`verification_status`,`verified_at`);--> statement-breakpoint
CREATE TABLE `admin_market_candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`generation_id` text NOT NULL,
	`cluster_key` text NOT NULL,
	`jurisdiction` text NOT NULL,
	`issue_type` text NOT NULL,
	`qualification_state` text NOT NULL,
	`score` integer NOT NULL,
	`source_count` integer NOT NULL,
	`independent_source_count` integer NOT NULL,
	`source_strength_score` integer NOT NULL,
	`discrepancy_score` integer NOT NULL,
	`recency_score` integer NOT NULL,
	`quantified_score` integer NOT NULL,
	`official_action_score` integer NOT NULL,
	`audience_score` integer NOT NULL,
	`contact_score` integer NOT NULL,
	`metric_count` integer DEFAULT 0 NOT NULL,
	`source_urls_json` text DEFAULT '[]' NOT NULL,
	`newest_source_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_market_candidates_generation_cluster_uidx` ON `admin_market_candidates` (`generation_id`,`cluster_key`);--> statement-breakpoint
CREATE INDEX `admin_market_candidates_state_score_idx` ON `admin_market_candidates` (`qualification_state`,`score`);--> statement-breakpoint
CREATE TABLE `admin_market_generation_rows` (
	`id` text PRIMARY KEY NOT NULL,
	`generation_id` text NOT NULL,
	`table_name` text NOT NULL,
	`record_id` text,
	`payload_json` text NOT NULL,
	`archived_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_market_generation_rows_generation_idx` ON `admin_market_generation_rows` (`generation_id`,`table_name`);--> statement-breakpoint
CREATE TABLE `admin_market_generations` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`reason` text NOT NULL,
	`archived_counts_json` text DEFAULT '{}' NOT NULL,
	`scan_results_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE INDEX `admin_market_generations_status_idx` ON `admin_market_generations` (`status`,`created_at`);
