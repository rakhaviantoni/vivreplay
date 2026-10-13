-- Apply the current seller fee schedule while preserving all other market policy settings.
UPDATE `app_settings`
SET `value`=json_set(`value`,'$.free.commissionPercent',1.25,'$.pro.commissionPercent',0.75),
    `updated_at`=CURRENT_TIMESTAMP
WHERE `key`='market_policy' AND json_valid(`value`);
