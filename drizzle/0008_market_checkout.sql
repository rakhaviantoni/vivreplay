ALTER TABLE `profiles` ADD `pro_expires_at` text;--> statement-breakpoint
CREATE TABLE `checkout_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`buyer_id` text NOT NULL,
	`seller_id` text,
	`listing_id` text,
	`items` text NOT NULL,
	`details` text,
	`subtotal` integer NOT NULL,
	`shipping_fee` integer NOT NULL DEFAULT 0,
	`amount` integer NOT NULL,
	`currency` text NOT NULL DEFAULT 'IDR',
	`payment_id` text,
	`status` text NOT NULL DEFAULT 'PENDING_PAYMENT',
	`expires_at` text,
	`fulfilled_at` text,
	`created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP
);--> statement-breakpoint
CREATE UNIQUE INDEX `checkout_orders_payment` ON `checkout_orders` (`payment_id`);--> statement-breakpoint
CREATE INDEX `checkout_orders_listing_reservations` ON `checkout_orders` (`listing_id`,`status`,`expires_at`);--> statement-breakpoint
CREATE INDEX `checkout_orders_buyer` ON `checkout_orders` (`buyer_id`,`created_at`);
