-- Market Pro intro price: first 100 members, until the end of 2026 (Asia/Jakarta).
UPDATE app_settings
SET value = json_set(
      value,
      '$.introEndsAt', '2026-12-31T16:59:59.000Z',
      '$.introLimit', 100,
      '$.introAmount', COALESCE(json_extract(value, '$.introAmount'), 19900)
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE key = 'pro_pricing'
  AND json_valid(value)
  AND COALESCE(json_extract(value, '$.introEndsAt'), '') < '2026-12-31T16:59:59.000Z';
