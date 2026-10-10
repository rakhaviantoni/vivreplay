-- Keep admin activity charts and customer pages on bounded indexed ranges.
CREATE INDEX IF NOT EXISTS `profiles_created_at_id`
  ON `profiles` (`created_at` DESC, `id` DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `profiles_tier_expiry`
  ON `profiles` (`tier`, `pro_expires_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `user_created_at_id`
  ON `user` (`createdAt` DESC, `id` DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `checkout_orders_kind_created_status`
  ON `checkout_orders` (`kind`, `created_at`, `status`);
