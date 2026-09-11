CREATE TABLE `research_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`jurisdiction` text NOT NULL,
	`normalized_jurisdiction` text NOT NULL,
	`requester_email` text NOT NULL,
	`status` text DEFAULT 'requested' NOT NULL,
	`source_target_slug` text,
	`acknowledgement_sent_at` text,
	`notified_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `research_requests_jurisdiction_email_uidx` ON `research_requests` (`normalized_jurisdiction`,`requester_email`);--> statement-breakpoint
CREATE INDEX `research_requests_status_created_idx` ON `research_requests` (`status`,`created_at`);
