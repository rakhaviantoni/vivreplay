UPDATE `app_settings`
SET `value`=json_set(`value`,'$.shippingVoucherMinSubtotal',500000),
    `updated_at`=CURRENT_TIMESTAMP
WHERE `key`='market_policy' AND json_valid(`value`);
