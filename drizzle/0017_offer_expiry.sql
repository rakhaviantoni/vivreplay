ALTER TABLE `listing_offers` ADD `expires_at` text;
UPDATE `listing_offers`
SET `expires_at` = MIN(datetime(`created_at`, '+24 hours'), COALESCE((SELECT datetime(`expires_at`) FROM `listings` WHERE `listings`.`id` = `listing_offers`.`listing_id`), datetime(`created_at`, '+24 hours')))
WHERE `expires_at` IS NULL;
CREATE INDEX `listing_offer_expiry` ON `listing_offers` (`status`, `expires_at`);
