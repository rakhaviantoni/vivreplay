ALTER TABLE `profiles` ADD `pro_billing_period` text NOT NULL DEFAULT 'monthly' CHECK (`pro_billing_period` IN ('monthly','yearly'));

UPDATE `profiles`
SET `pro_billing_period` = COALESCE((
  SELECT CASE WHEN json_extract(`details`, '$.billingPeriod') = 'yearly' THEN 'yearly' ELSE 'monthly' END
  FROM `checkout_orders`
  WHERE `checkout_orders`.`buyer_id` = `profiles`.`id`
    AND `checkout_orders`.`kind` = 'PRO'
    AND `checkout_orders`.`status` IN ('PAID','COMPLETED')
  ORDER BY COALESCE(`fulfilled_at`,`paid_at`,`created_at`) DESC
  LIMIT 1
), 'monthly')
WHERE `profiles`.`tier` = 'pro';

UPDATE `app_settings`
SET `value` = json_set(
  `value`,
  '$.free.maxActiveListings', 10,
  '$.free.maxListingCopies', 10,
  '$.free.maxCopiesPerCard', 1,
  '$.free.maxCardTypes', 10,
  '$.pro.maxActiveListings', 500,
  '$.pro.maxListingCopies', 51,
  '$.pro.maxCopiesPerCard', 4,
  '$.pro.maxCardTypes', 51,
  '$.proAnnual', json('{"durationDays":30,"maxActiveListings":1000,"maxListingCopies":100,"maxCopiesPerCard":4,"maxCardTypes":100,"canAutoRenew":true,"commissionPercent":0.75}'),
  '$.proAnnual.durationDays', 30,
  '$.proAnnual.maxActiveListings', 1000,
  '$.proAnnual.maxListingCopies', 100,
  '$.proAnnual.maxCopiesPerCard', 4,
  '$.proAnnual.maxCardTypes', 100,
  '$.proAnnual.canAutoRenew', json('true'),
  '$.proAnnual.commissionPercent', 0.75
), `updated_at` = CURRENT_TIMESTAMP
WHERE `key` = 'market_policy' AND json_valid(`value`);
