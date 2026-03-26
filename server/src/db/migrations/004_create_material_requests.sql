CREATE SEQUENCE IF NOT EXISTS dn_seq START 1;

CREATE TABLE IF NOT EXISTS material_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id),
  requester_id    UUID NOT NULL REFERENCES users(id),
  status          VARCHAR(30) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','issued','rejected','escalated')),
  rejection_reason TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS request_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id          UUID NOT NULL REFERENCES material_requests(id) ON DELETE CASCADE,
  stock_item_id       UUID REFERENCES stock_items(id),
  item_number         VARCHAR(100),
  description_1       VARCHAR(500) NOT NULL,
  description_2       VARCHAR(500),
  uom                 VARCHAR(50) NOT NULL,
  quantity_requested  NUMERIC(12,3) NOT NULL CHECK (quantity_requested > 0)
);

CREATE INDEX IF NOT EXISTS idx_requests_project    ON material_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_requests_requester  ON material_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_requests_status     ON material_requests(status);
