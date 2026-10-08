ALTER TABLE market_disputes ADD COLUMN ai_analysis TEXT;
ALTER TABLE market_disputes ADD COLUMN ai_analyzed_at TEXT;
ALTER TABLE market_disputes ADD COLUMN ai_model TEXT;
ALTER TABLE market_disputes ADD COLUMN resolution_cost_payer TEXT CHECK(resolution_cost_payer IS NULL OR resolution_cost_payer IN ('SELLER','VIVREPLAY'));
ALTER TABLE market_disputes ADD COLUMN resolution_cost_amount INTEGER NOT NULL DEFAULT 0 CHECK(resolution_cost_amount >= 0);
ALTER TABLE market_disputes ADD COLUMN resolution_cost_reference TEXT;
