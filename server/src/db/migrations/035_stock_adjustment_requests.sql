-- Approval queue for stock adjustments requested by non-admin roles (superuser).
-- Admin can still adjust directly via /stock/adjust; superuser submits a request
-- here, admin approves or rejects. Approval performs the actual adjustment.
CREATE TABLE IF NOT EXISTS stock_adjustment_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_item_id   UUID NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  requested_by    UUID NOT NULL REFERENCES users(id),
  adjustment      NUMERIC(12,3) NOT NULL CHECK (adjustment <> 0),
  reason          TEXT NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by     UUID REFERENCES users(id),
  reviewed_at     TIMESTAMPTZ,
  review_notes    TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sar_status        ON stock_adjustment_requests(status);
CREATE INDEX IF NOT EXISTS idx_sar_requested_by  ON stock_adjustment_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_sar_stock_item    ON stock_adjustment_requests(stock_item_id);
