CREATE TABLE `market_activity_reads` (
  `profile_id` text NOT NULL,
  `section` text NOT NULL,
  `last_seen_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`profile_id`, `section`),
  FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON DELETE CASCADE
);
