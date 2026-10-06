CREATE TABLE IF NOT EXISTS shipping_quote_cache (
  cache_key TEXT PRIMARY KEY,
  quote_json TEXT,
  expires_at INTEGER NOT NULL DEFAULT 0,
  lease_until INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS shipping_quote_cache_expiry ON shipping_quote_cache(expires_at);
