CREATE TABLE IF NOT EXISTS `feedback_reports` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `category` TEXT NOT NULL,
  `summary` TEXT NOT NULL,
  `details` TEXT NOT NULL,
  `card_code` TEXT,
  `printing_id` TEXT,
  `listing_id` TEXT,
  `page_path` TEXT NOT NULL,
  `contact_email` TEXT,
  `status` TEXT NOT NULL DEFAULT 'NEW',
  `created_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `feedback_reports_created` ON `feedback_reports` (`created_at`);
