-- Keep catalog lookups selective for identity and set filters.
CREATE INDEX IF NOT EXISTS `tcg_card_printings_identity_language`
  ON `tcg_card_printings` (`identity_id`, `language`, `set_code`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `tcg_card_printings_language_set_identity`
  ON `tcg_card_printings` (`language`, `set_code`, `identity_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `listings_seller_id_id`
  ON `listings` (`seller_id`, `id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `listing_offers_listing_created_actor_thread`
  ON `listing_offers` (`listing_id`, `created_at`, `actor_id`, `thread_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `listing_offers_actor_created_listing_thread`
  ON `listing_offers` (`actor_id`, `created_at`, `listing_id`, `thread_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `listing_offer_messages_actor_created_thread`
  ON `listing_offer_messages` (`actor_id`, `created_at`, `thread_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `checkout_orders_buyer_updated_status`
  ON `checkout_orders` (`buyer_id`, `updated_at`, `status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `checkout_orders_seller_updated_status`
  ON `checkout_orders` (`seller_id`, `updated_at`, `status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `tcg_card_printings_set_identity`
  ON `tcg_card_printings` (`set_code`, `identity_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `tcg_card_printings_rarity_identity`
  ON `tcg_card_printings` (`rarity`, `identity_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `tcg_card_identities_game_type_cost`
  ON `tcg_card_identities` (`game_id`, `card_type`, `cost`, `code`);
--> statement-breakpoint
CREATE VIRTUAL TABLE IF NOT EXISTS `tcg_card_identity_search` USING fts5(
  `identity_id` UNINDEXED,
  `code`,
  `name`,
  `color`,
  `card_type`,
  tokenize='unicode61 remove_diacritics 2'
);
--> statement-breakpoint
INSERT INTO `tcg_card_identity_search` (`identity_id`,`code`,`name`,`color`,`card_type`)
SELECT `id`,`code`,`name`,`color`,`card_type` FROM `tcg_card_identities`;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `tcg_card_identity_search_insert`
AFTER INSERT ON `tcg_card_identities`
BEGIN
  INSERT INTO `tcg_card_identity_search` (`identity_id`,`code`,`name`,`color`,`card_type`)
  VALUES (new.`id`,new.`code`,new.`name`,new.`color`,new.`card_type`);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `tcg_card_identity_search_update`
AFTER UPDATE OF `code`,`name`,`color`,`card_type` ON `tcg_card_identities`
BEGIN
  DELETE FROM `tcg_card_identity_search` WHERE `identity_id`=old.`id`;
  INSERT INTO `tcg_card_identity_search` (`identity_id`,`code`,`name`,`color`,`card_type`)
  VALUES (new.`id`,new.`code`,new.`name`,new.`color`,new.`card_type`);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `tcg_card_identity_search_delete`
AFTER DELETE ON `tcg_card_identities`
BEGIN
  DELETE FROM `tcg_card_identity_search` WHERE `identity_id`=old.`id`;
END;
