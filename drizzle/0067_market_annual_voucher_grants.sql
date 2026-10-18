CREATE TABLE IF NOT EXISTS `market_pro_voucher_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL UNIQUE REFERENCES `checkout_orders`(`id`),
	`owner_id` text NOT NULL REFERENCES `profiles`(`id`),
	`voucher_total` integer NOT NULL,
	`starts_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS `market_pro_voucher_grants_owner_term` ON `market_pro_voucher_grants` (`owner_id`, `starts_at`, `expires_at`);
