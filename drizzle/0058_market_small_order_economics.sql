-- Keep small orders available while setting a minimum buyer fee and reserving
-- Pro shipping vouchers for larger card subtotals.
UPDATE `app_settings`
SET `value`=json_set(`value`,'$.buyerFeeMinimum',2000,'$.shippingVoucherMinSubtotal',1000000),
    `updated_at`=CURRENT_TIMESTAMP
WHERE `key`='market_policy' AND json_valid(`value`);
