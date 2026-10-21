UPDATE `app_settings`
SET `value` = json_set(
  `value`,
  '$.free.maxListingCopies', 51,
  '$.free.maxCardTypes', 51,
  '$.pro.maxListingCopies', 75,
  '$.pro.maxCardTypes', 75
), `updated_at` = CURRENT_TIMESTAMP
WHERE `key` = 'market_policy' AND json_valid(`value`);
