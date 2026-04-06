-- Phase 3: WMS Dispatch to Sites

CREATE SEQUENCE IF NOT EXISTS wms_do_seq START 1;

CREATE TABLE IF NOT EXISTS wms_dispatch_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number    TEXT UNIQUE NOT NULL,
  project_id      UUID REFERENCES projects(id),
  destination     TEXT,
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'confirmed', 'dispatched', 'cancelled')),
  created_by      UUID REFERENCES users(id),
  confirmed_by    UUID REFERENCES users(id),
  confirmed_at    TIMESTAMPTZ,
  dispatched_by   UUID REFERENCES users(id),
  dispatched_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wms_dispatch_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_order_id   UUID NOT NULL REFERENCES wms_dispatch_orders(id) ON DELETE CASCADE,
  item_master_id      UUID NOT NULL REFERENCES wms_item_master(id),
  bin_id              UUID REFERENCES wms_bins(id),
  qty_requested       NUMERIC NOT NULL CHECK (qty_requested > 0),
  qty_dispatched      NUMERIC NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wms_dispatch_orders_status    ON wms_dispatch_orders(status);
CREATE INDEX IF NOT EXISTS idx_wms_dispatch_orders_project   ON wms_dispatch_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_wms_dispatch_items_order      ON wms_dispatch_items(dispatch_order_id);
CREATE INDEX IF NOT EXISTS idx_wms_dispatch_items_item       ON wms_dispatch_items(item_master_id);
