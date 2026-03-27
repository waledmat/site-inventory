CREATE TABLE IF NOT EXISTS stock_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_item_id UUID REFERENCES stock_items(id) ON DELETE SET NULL,
  transaction_type VARCHAR(30) NOT NULL,  -- issue, return, adjustment, initial_load
  quantity NUMERIC NOT NULL,
  reference_id VARCHAR(100),
  reference_type VARCHAR(50),  -- issue, return, adjustment
  notes TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS stock_tx_item_idx ON stock_transactions(stock_item_id);
CREATE INDEX IF NOT EXISTS stock_tx_created_idx ON stock_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS stock_tx_type_idx ON stock_transactions(transaction_type);
