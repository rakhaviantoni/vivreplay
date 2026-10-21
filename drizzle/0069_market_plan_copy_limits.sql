UPDATE `app_settings`
SET `value` = json_set(
  `value`,
  '$.free.maxCopiesPerCard', 4,
  '$.pro.maxCopiesPerCard', 10,
  '$.proAnnual.maxCopiesPerCard', 20
), `updated_at` = CURRENT_TIMESTAMP
WHERE `key` = 'market_policy' AND json_valid(`value`);
