-- Migration 023: Warehouse location hierarchy (Zone -> Rack -> Shelf -> Bin)

CREATE TABLE IF NOT EXISTS wms_zones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(20) UNIQUE NOT NULL,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wms_racks (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id  UUID NOT NULL REFERENCES wms_zones(id) ON DELETE CASCADE,
  code     VARCHAR(20) NOT NULL,
  name     VARCHAR(100),
  UNIQUE (zone_id, code)
);

CREATE TABLE IF NOT EXISTS wms_shelves (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rack_id  UUID NOT NULL REFERENCES wms_racks(id) ON DELETE CASCADE,
  code     VARCHAR(20) NOT NULL,
  name     VARCHAR(100),
  UNIQUE (rack_id, code)
);

CREATE TABLE IF NOT EXISTS wms_bins (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shelf_id  UUID NOT NULL REFERENCES wms_shelves(id) ON DELETE CASCADE,
  code      VARCHAR(20) NOT NULL,
  full_code VARCHAR(100) UNIQUE NOT NULL,
  max_qty   NUMERIC(12,3),
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE (shelf_id, code)
);

CREATE INDEX IF NOT EXISTS idx_wms_racks_zone    ON wms_racks(zone_id);
CREATE INDEX IF NOT EXISTS idx_wms_shelves_rack  ON wms_shelves(rack_id);
CREATE INDEX IF NOT EXISTS idx_wms_bins_shelf    ON wms_bins(shelf_id);
CREATE INDEX IF NOT EXISTS idx_wms_bins_fullcode ON wms_bins(full_code);
CREATE INDEX IF NOT EXISTS idx_wms_bins_active   ON wms_bins(is_active);
