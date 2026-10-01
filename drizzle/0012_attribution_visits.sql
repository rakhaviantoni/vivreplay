CREATE TABLE `attribution_visits` (
	`id` text PRIMARY KEY NOT NULL,
	`visitor_id` text NOT NULL,
	`landing_path` text NOT NULL,
	`referrer_origin` text,
	`utm_source` text,
	`utm_medium` text,
	`utm_campaign` text,
	`utm_term` text,
	`utm_content` text,
	`parameters` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `attribution_created` ON `attribution_visits` (`created_at`);
--> statement-breakpoint
CREATE INDEX `attribution_campaign` ON `attribution_visits` (`utm_source`,`utm_medium`,`utm_campaign`);
