CREATE TABLE `admin_official_contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`jurisdiction` text NOT NULL,
	`normalized_jurisdiction` text NOT NULL,
	`name` text NOT NULL,
	`title` text,
	`organization` text,
	`email` text NOT NULL,
	`phone` text,
	`source_url` text NOT NULL,
	`status` text DEFAULT 'VERIFIED' NOT NULL,
	`verified_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_official_contacts_jurisdiction_email_uidx` ON `admin_official_contacts` (`normalized_jurisdiction`,`email`);--> statement-breakpoint
CREATE INDEX `admin_official_contacts_status_idx` ON `admin_official_contacts` (`status`,`updated_at`);