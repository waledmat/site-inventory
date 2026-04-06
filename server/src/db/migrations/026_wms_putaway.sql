-- Putaway tasks created when a GRN is confirmed
CREATE TABLE IF NOT EXISTS wms_putaway_tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_item_id   UUID NOT NULL REFERENCES wms_grn_items(id),
  item_master_id UUID NOT NULL REFERENCES wms_item_master(id),
  bin_id        UUID REFERENCES wms_bins(id),
  qty_to_putaway NUMERIC(12,3) NOT NULL,
  qty_putaway    NUMERIC(12,3) NOT NULL DEFAULT 0,
  status        VARCHAR(20) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','in_progress','completed')),
  assigned_to   UUID REFERENCES users(id),
  completed_by  UUID REFERENCES users(id),
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
