CREATE TABLE market_disputes (
  id TEXT PRIMARY KEY NOT NULL,
  order_id TEXT NOT NULL UNIQUE REFERENCES checkout_orders(id),
  buyer_id TEXT NOT NULL REFERENCES profiles(id),
  seller_id TEXT NOT NULL REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','UNDER_REVIEW','RESOLVED')),
  reason TEXT NOT NULL,
  affected_items TEXT NOT NULL DEFAULT '[]',
  requested_resolution TEXT NOT NULL CHECK(requested_resolution IN ('REFUND','RESHIP')),
  evidence TEXT NOT NULL DEFAULT '[]',
  seller_response TEXT,
  decision TEXT CHECK(decision IS NULL OR decision IN ('FULL_REFUND','PARTIAL_REFUND','RESHIP','NO_REFUND')),
  decision_note TEXT,
  refund_amount INTEGER NOT NULL DEFAULT 0 CHECK(refund_amount >= 0),
  shipping_refund INTEGER NOT NULL DEFAULT 0 CHECK(shipping_refund >= 0),
  refund_reference TEXT,
  decided_by TEXT REFERENCES profiles(id),
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX market_dispute_status_created ON market_disputes(status,created_at);
CREATE INDEX market_dispute_seller ON market_disputes(seller_id,created_at);
