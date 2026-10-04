ALTER TABLE `checkout_orders` ADD `offer_id` text REFERENCES `listing_offers`(`id`);
CREATE INDEX `checkout_orders_offer` ON `checkout_orders` (`offer_id`, `status`, `expires_at`);
