CREATE TABLE IF NOT EXISTS stock_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  project_number      VARCHAR(100),
  wbs_request_no      VARCHAR(100),
  category            VARCHAR(50) CHECK (category IN ('CH','DC','SPARE')),
  item_number         VARCHAR(100),
  description_1       VARCHAR(500) NOT NULL,
  description_2       VARCHAR(500),
  uom                 VARCHAR(50) NOT NULL,
  qty_requested       NUMERIC(12,3) DEFAULT 0,
  qty_on_hand         NUMERIC(12,3) DEFAULT 0,
  qty_pending_warehouse NUMERIC(12,3) DEFAULT 0,
  contract_no         VARCHAR(100),
  qty_issued          NUMERIC(12,3) DEFAULT 0,
  qty_returned        NUMERIC(12,3) DEFAULT 0,
  qty_pending_return  NUMERIC(12,3) DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_project ON stock_items(project_id);
CREATE INDEX IF NOT EXISTS idx_stock_item_number ON stock_items(item_number);
CREATE INDEX IF NOT EXISTS idx_stock_description ON stock_items USING gin(to_tsvector('english', description_1 || ' ' || COALESCE(description_2,'')));
