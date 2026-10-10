-- Support selective catalog code lookups used by search and card-effect sync.
CREATE INDEX IF NOT EXISTS `tcg_card_identities_code`
  ON `tcg_card_identities` (`code`);
--> statement-breakpoint
-- Keep existing editable listing policy in step with the new fee schedule.
UPDATE `app_settings`
SET `value`=json_set(`value`,'$.free.commissionPercent',0.75,'$.pro.commissionPercent',0.5),
    `updated_at`=CURRENT_TIMESTAMP
WHERE `key`='market_policy' AND json_valid(`value`);
