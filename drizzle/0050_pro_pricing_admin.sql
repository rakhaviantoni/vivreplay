INSERT INTO app_settings (key, value, updated_at)
VALUES ('pro_pricing', '{"amount":24900,"durationDays":30,"introAmount":19900,"introEndsAt":"2026-11-19T16:59:59.000Z","introLimit":100}', CURRENT_TIMESTAMP)
ON CONFLICT(key) DO NOTHING;
