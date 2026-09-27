CREATE TABLE `listing_offers` (
  `id` text PRIMARY KEY NOT NULL,
  `listing_id` text NOT NULL,
  `actor_id` text NOT NULL,
  `type` text NOT NULL,
  `items` text NOT NULL,
  `amount` integer NOT NULL,
  `currency` text NOT NULL,
  `status` text NOT NULL DEFAULT 'PENDING',
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE CASCADE,
  FOREIGN KEY (`actor_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE CASCADE
);
CREATE INDEX `listing_offer_listing_status` ON `listing_offers` (`listing_id`,`status`);
CREATE INDEX `listing_offer_actor` ON `listing_offers` (`actor_id`,`created_at`);
