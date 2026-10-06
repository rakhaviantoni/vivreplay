ALTER TABLE checkout_orders ADD COLUMN seller_net_amount INTEGER;

CREATE TABLE seller_payout_requests (
  id TEXT PRIMARY KEY NOT NULL,
  seller_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bank_account_id TEXT NOT NULL,
  encrypted_bank_details TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'IDR',
  status TEXT NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED','PROCESSING','PAID','FAILED')),
  transaction_reference TEXT,
  failure_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX seller_payout_owner_created ON seller_payout_requests(seller_id,created_at);
CREATE INDEX seller_payout_status_created ON seller_payout_requests(status,created_at);
CREATE UNIQUE INDEX seller_payout_one_open ON seller_payout_requests(seller_id) WHERE status IN ('REQUESTED','PROCESSING');
