-- Adds unit_cost (per-UOM cost) to stock_items so the dashboard can compute
-- monetary values for total stock, issued, returned, and pending-return.
ALTER TABLE stock_items
  ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(14,4) DEFAULT 0;
