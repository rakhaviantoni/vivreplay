ALTER TABLE `profiles` ADD `tier` text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE `listings` ADD `expires_at` text;--> statement-breakpoint
CREATE INDEX `listing_status_expires` ON `listings` (`status`,`expires_at`);
