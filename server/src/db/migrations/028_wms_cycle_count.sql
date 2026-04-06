-- Phase 4: WMS Cycle Counting

CREATE SEQUENCE IF NOT EXISTS wms_cc_seq START 1;

CREATE TABLE IF NOT EXISTS wms_cycle_counts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  count_number  TEXT UNIQUE NOT NULL,
  zone_id       UUID REFERENCES wms_zones(id),   -- NULL = count all bins
  notes         TEXT,
  status        TEXT NOT NULL DEFAULT 'open'
                CHECK (status IN ('open', 'counting', 'completed', 'cancelled')),
  created_by    UUID REFERENCES users(id),
  completed_by  UUID REFERENCES users(id),
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wms_cycle_count_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_count_id  UUID NOT NULL REFERENCES wms_cycle_counts(id) ON DELETE CASCADE,
  bin_id          UUID NOT NULL REFERENCES wms_bins(id),
  item_master_id  UUID NOT NULL REFERENCES wms_item_master(id),
  expected_qty    NUMERIC NOT NULL DEFAULT 0,
  counted_qty     NUMERIC,                        -- NULL = not yet counted
  notes           TEXT,
  counted_by      UUID REFERENCES users(id),
  counted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wms_cycle_counts_status   ON wms_cycle_counts(status);
CREATE INDEX IF NOT EXISTS idx_wms_cc_items_count        ON wms_cycle_count_items(cycle_count_id);
CREATE INDEX IF NOT EXISTS idx_wms_cc_items_bin          ON wms_cycle_count_items(bin_id);
