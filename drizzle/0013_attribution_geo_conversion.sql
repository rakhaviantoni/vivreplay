ALTER TABLE `attribution_visits` ADD COLUMN `country_code` text;
--> statement-breakpoint
ALTER TABLE `attribution_visits` ADD COLUMN `converted_at` text;
--> statement-breakpoint
CREATE INDEX `attribution_conversion` ON `attribution_visits` (`converted_at`);
