-- Auto-generated number for stock adjustments (ADJ-YYYY-NNNN), shown in
-- transaction history and on the request queue.
CREATE SEQUENCE IF NOT EXISTS adj_seq START 1;

ALTER TABLE stock_adjustment_requests
  ADD COLUMN IF NOT EXISTS adjustment_no VARCHAR(40);

CREATE INDEX IF NOT EXISTS idx_sar_adjustment_no ON stock_adjustment_requests(adjustment_no);
