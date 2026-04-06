-- Sequences for auto-numbering
CREATE SEQUENCE IF NOT EXISTS wms_po_seq  START 1000 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS wms_grn_seq START 1000 INCREMENT 1;

-- Purchase Orders
CREATE TABLE IF NOT EXISTS wms_purchase_orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number     VARCHAR(50) UNIQUE NOT NULL,
  supplier_id   UUID NOT NULL REFERENCES wms_suppliers(id),
  status        VARCHAR(20) NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','sent','partial','received','cancelled')),
  expected_date DATE,
  notes         TEXT,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- PO line items
CREATE TABLE IF NOT EXISTS wms_po_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id          UUID NOT NULL REFERENCES wms_purchase_orders(id) ON DELETE CASCADE,
  item_master_id UUID NOT NULL REFERENCES wms_item_master(id),
  qty_ordered    NUMERIC(12,3) NOT NULL,
  qty_received   NUMERIC(12,3) NOT NULL DEFAULT 0,
  unit_cost      NUMERIC(12,4),
  notes          TEXT
);

-- Goods Receipt Notes
CREATE TABLE IF NOT EXISTS wms_grn (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_number    VARCHAR(50) UNIQUE NOT NULL,
  po_id         UUID REFERENCES wms_purchase_orders(id),
  supplier_id   UUID NOT NULL REFERENCES wms_suppliers(id),
  received_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status        VARCHAR(20) NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','confirmed')),
  notes         TEXT,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- GRN line items
CREATE TABLE IF NOT EXISTS wms_grn_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id         UUID NOT NULL REFERENCES wms_grn(id) ON DELETE CASCADE,
  po_item_id     UUID REFERENCES wms_po_items(id),
  item_master_id UUID NOT NULL REFERENCES wms_item_master(id),
  qty_received   NUMERIC(12,3) NOT NULL,
  condition      VARCHAR(20) DEFAULT 'good' CHECK (condition IN ('good','damaged','quarantine')),
  notes          TEXT
);
