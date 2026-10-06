CREATE TABLE IF NOT EXISTS seller_payout_accounts (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  encrypted_details TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS seller_payout_accounts_owner ON seller_payout_accounts(owner_id);
CREATE UNIQUE INDEX IF NOT EXISTS seller_payout_accounts_default ON seller_payout_accounts(owner_id) WHERE is_default=1;
