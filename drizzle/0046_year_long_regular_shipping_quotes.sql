UPDATE shipping_quote_cache
SET quote_json = json_set(
      quote_json,
      '$.regularExpiresAt',
      max(
        COALESCE(CAST(json_extract(quote_json, '$.regularExpiresAt') AS INTEGER), 0),
        CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) + 31536000000
      )
    ),
    expires_at = max(
      COALESCE(CAST(json_extract(quote_json, '$.regularExpiresAt') AS INTEGER), 0),
      CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) + 31536000000,
      COALESCE(CAST(json_extract(quote_json, '$.instantExpiresAt') AS INTEGER), 0)
    )
WHERE quote_json IS NOT NULL
  AND json_valid(quote_json)
  AND EXISTS (
    SELECT 1
    FROM json_each(quote_json, '$.pricing') AS rate
    WHERE json_extract(rate.value, '$.courier_code') NOT IN ('grab', 'gojek')
  );
