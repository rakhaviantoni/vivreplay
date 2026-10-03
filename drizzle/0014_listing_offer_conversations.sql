ALTER TABLE `listing_offers` ADD `thread_id` text;
ALTER TABLE `listing_offers` ADD `parent_offer_id` text;
UPDATE `listing_offers` SET `thread_id` = `id` WHERE `thread_id` IS NULL;
CREATE INDEX `listing_offer_thread` ON `listing_offers` (`thread_id`,`created_at`);
CREATE INDEX `listing_offer_parent` ON `listing_offers` (`parent_offer_id`);

CREATE TABLE `listing_offer_messages` (
  `id` text PRIMARY KEY NOT NULL,
  `thread_id` text NOT NULL,
  `offer_id` text,
  `actor_id` text NOT NULL,
  `kind` text NOT NULL DEFAULT 'MESSAGE',
  `body` text,
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`offer_id`) REFERENCES `listing_offers`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`actor_id`) REFERENCES `profiles`(`id`) ON DELETE CASCADE
);
CREATE INDEX `listing_offer_message_thread` ON `listing_offer_messages` (`thread_id`,`created_at`);

CREATE TABLE `listing_offer_attachments` (
  `id` text PRIMARY KEY NOT NULL,
  `message_id` text NOT NULL,
  `object_key` text NOT NULL,
  `mime` text NOT NULL,
  `byte_size` integer NOT NULL,
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`message_id`) REFERENCES `listing_offer_messages`(`id`) ON DELETE CASCADE
);
CREATE INDEX `listing_offer_attachment_message` ON `listing_offer_attachments` (`message_id`);
