UPDATE app_settings
SET value = json_set(
      value,
      '$.free.durationDays', 7,
      '$.free.maxActiveListings', 25,
      '$.free.canAutoRenew', json('false'),
      '$.free.commissionPercent', 1.5,
      '$.pro.durationDays', 30,
      '$.pro.maxActiveListings', 2500,
      '$.pro.canAutoRenew', json('true'),
      '$.pro.commissionPercent', 0.75
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE key = 'market_policy'
  AND json_valid(value);
