UPDATE `app_settings`
SET `value`=json_set(`value`,'$.buyerFeeMinimum',2000,'$.sellerFeeMinimum',1000),
    `updated_at`=CURRENT_TIMESTAMP
WHERE `key`='market_policy' AND json_valid(`value`);
