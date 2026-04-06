-- Migration 021: WMS Supplier master

CREATE TABLE IF NOT EXISTS wms_suppliers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          VARCHAR(50) UNIQUE NOT NULL,
  name          VARCHAR(255) NOT NULL,
  contact_name  VARCHAR(255),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  address       TEXT,
  lead_time_days INTEGER DEFAULT 0,
  is_active     BOOLEAN DEFAULT TRUE,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wms_suppliers_code   ON wms_suppliers(code);
CREATE INDEX IF NOT EXISTS idx_wms_suppliers_active ON wms_suppliers(is_active);
