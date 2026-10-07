UPDATE app_settings
SET value = json_set(value, '$.free.commissionPercent', 1, '$.pro.commissionPercent', 0),
    updated_at = CURRENT_TIMESTAMP
WHERE key = 'market_policy'
  AND json_valid(value);
