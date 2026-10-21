UPDATE `app_settings`
SET `value` = json_set(
  `value`,
  '$.free.maxActiveListings', 25,
  '$.pro.maxActiveListings', 2500,
  '$.proAnnual.maxActiveListings', 1000
), `updated_at` = CURRENT_TIMESTAMP
WHERE `key` = 'market_policy' AND json_valid(`value`);
