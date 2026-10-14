CREATE TABLE IF NOT EXISTS `market_pro_email_events` (
  `profile_id` TEXT NOT NULL,
  `event_key` TEXT NOT NULL,
  `state` TEXT NOT NULL DEFAULT 'PENDING',
  `created_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`profile_id`, `event_key`)
);
