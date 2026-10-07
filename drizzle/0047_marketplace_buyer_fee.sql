UPDATE app_settings
SET value = json_set(value, '$.free.commissionPercent', 1.5, '$.pro.commissionPercent', 0.75),
    updated_at = CURRENT_TIMESTAMP
WHERE key = 'market_policy'
  AND json_valid(value);
