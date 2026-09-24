CREATE TABLE `seller_shipping_origins` (
  `owner_id` text PRIMARY KEY NOT NULL,
  `label` text NOT NULL,
  `recipient_name` text,
  `phone` text,
  `address_line` text NOT NULL,
  `city` text NOT NULL,
  `postal_code` text NOT NULL,
  `area_id` text,
  `latitude` real,
  `longitude` real,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`owner_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE CASCADE
);
CREATE INDEX `shipping_origin_postal_code` ON `seller_shipping_origins` (`postal_code`);
