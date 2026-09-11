CREATE TABLE `matters` (
	`id` text PRIMARY KEY NOT NULL,
	`target_query` text NOT NULL,
	`jurisdiction` text NOT NULL,
	`vendor` text DEFAULT 'Flock Safety' NOT NULL,
	`system` text DEFAULT 'ALPR' NOT NULL,
	`status` text DEFAULT 'checkout_pending' NOT NULL,
	`report_version` text DEFAULT 'grand-island-v1' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `matters_status_created_idx` ON `matters` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `purchases` (
	`id` text PRIMARY KEY NOT NULL,
	`matter_id` text NOT NULL,
	`tier` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'usd' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`buyer_email` text,
	`stripe_session_id` text,
	`stripe_payment_intent_id` text,
	`access_token_hash` text,
	`access_expires_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`paid_at` text
);
--> statement-breakpoint
CREATE INDEX `purchases_matter_idx` ON `purchases` (`matter_id`);--> statement-breakpoint
CREATE INDEX `purchases_status_created_idx` ON `purchases` (`status`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `purchases_stripe_session_uidx` ON `purchases` (`stripe_session_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `purchases_access_token_uidx` ON `purchases` (`access_token_hash`);