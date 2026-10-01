ALTER TABLE `card_printings` ADD `printing_code` text;
--> statement-breakpoint
UPDATE `card_printings`
SET `printing_code` = (
  SELECT `code` FROM `card_identities` WHERE `card_identities`.`id` = `card_printings`.`identity_id`
)
WHERE `printing_code` IS NULL;
