ALTER TABLE `purchases` ADD `access_code_hash` text;--> statement-breakpoint
ALTER TABLE `purchases` ADD `email_delivery_status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `purchases` ADD `email_delivered_at` text;