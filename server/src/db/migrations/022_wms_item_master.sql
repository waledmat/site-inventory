-- Migration 022: WMS Item master (shared product catalog)

CREATE TABLE IF NOT EXISTS wms_item_master (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_number     VARCHAR(100) UNIQUE NOT NULL,
  description_1   VARCHAR(500) NOT NULL,
  description_2   VARCHAR(500),
  category        VARCHAR(50) CHECK (category IN ('CH','DC','SPARE','GENERAL')),
  uom             VARCHAR(50) NOT NULL,
  reorder_point   NUMERIC(12,3) DEFAULT 0,
  min_stock_level NUMERIC(12,3) DEFAULT 0,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_item_master_number ON wms_item_master(item_number);
CREATE INDEX IF NOT EXISTS idx_item_master_active ON wms_item_master(is_active);
CREATE INDEX IF NOT EXISTS idx_item_master_desc
  ON wms_item_master USING gin(
    to_tsvector('english', description_1 || ' ' || COALESCE(description_2,''))
  );

-- Link existing stock_items to item master (nullable for backward compatibility)
ALTER TABLE stock_items
  ADD COLUMN IF NOT EXISTS item_master_id UUID REFERENCES wms_item_master(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stock_items_master ON stock_items(item_master_id);
