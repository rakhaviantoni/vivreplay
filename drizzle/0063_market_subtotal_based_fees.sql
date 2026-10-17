UPDATE `app_settings`
SET `value`=json_set(`value`,'$.buyerFeeMinimum',0,'$.sellerFeeMinimum',0),
    `updated_at`=CURRENT_TIMESTAMP
WHERE `key`='market_policy' AND json_valid(`value`);
