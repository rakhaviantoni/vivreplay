CREATE TABLE `market_push_subscriptions` (
  `id` text PRIMARY KEY NOT NULL,
  `profile_id` text NOT NULL,
  `endpoint` text NOT NULL,
  `p256dh` text NOT NULL,
  `auth` text NOT NULL,
  `expiration_time` integer,
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON DELETE CASCADE
);
CREATE UNIQUE INDEX `market_push_profile_endpoint` ON `market_push_subscriptions` (`profile_id`,`endpoint`);
CREATE INDEX `market_push_profile` ON `market_push_subscriptions` (`profile_id`);
