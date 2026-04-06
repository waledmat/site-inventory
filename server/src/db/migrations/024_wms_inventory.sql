-- Bin-level stock tracking
CREATE TABLE IF NOT EXISTS wms_bin_stock (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bin_id          UUID NOT NULL REFERENCES wms_bins(id),
  item_master_id  UUID NOT NULL REFERENCES wms_item_master(id),
  qty_on_hand     NUMERIC(12,3) NOT NULL DEFAULT 0,
  qty_reserved    NUMERIC(12,3) NOT NULL DEFAULT 0,
  last_count_date TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bin_id, item_master_id)
);

-- WMS stock ledger
CREATE TABLE IF NOT EXISTS wms_stock_transactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_master_id   UUID NOT NULL REFERENCES wms_item_master(id),
  bin_id           UUID REFERENCES wms_bins(id),
  transaction_type VARCHAR(50) NOT NULL,
  quantity         NUMERIC(12,3) NOT NULL,
  reference_id     UUID,
  reference_type   VARCHAR(50),
  notes            TEXT,
  user_id          UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Stock summary view per item across all bins
CREATE OR REPLACE VIEW wms_stock_summary AS
SELECT
  im.id            AS item_master_id,
  im.item_number,
  im.description_1,
  im.description_2,
  im.category,
  im.uom,
  im.reorder_point,
  im.min_stock_level,
  COALESCE(SUM(bs.qty_on_hand), 0)                              AS total_qty_on_hand,
  COALESCE(SUM(bs.qty_reserved), 0)                            AS total_qty_reserved,
  COALESCE(SUM(bs.qty_on_hand) - SUM(bs.qty_reserved), 0)      AS total_qty_available,
  COUNT(DISTINCT bs.bin_id)                                     AS bin_count
FROM wms_item_master im
LEFT JOIN wms_bin_stock bs ON bs.item_master_id = im.id
WHERE im.is_active = TRUE
GROUP BY im.id, im.item_number, im.description_1, im.description_2,
         im.category, im.uom, im.reorder_point, im.min_stock_level;
