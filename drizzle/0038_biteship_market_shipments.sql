ALTER TABLE `checkout_orders` ADD `shipping_status` text;
ALTER TABLE `checkout_orders` ADD `biteship_draft_order_id` text;
ALTER TABLE `checkout_orders` ADD `biteship_order_id` text;
ALTER TABLE `checkout_orders` ADD `biteship_tracking_id` text;
ALTER TABLE `checkout_orders` ADD `shipping_waybill_id` text;
ALTER TABLE `checkout_orders` ADD `shipping_tracking_url` text;
ALTER TABLE `checkout_orders` ADD `shipping_updated_at` text;
CREATE INDEX `checkout_orders_biteship_tracking` ON `checkout_orders` (`biteship_tracking_id`);
