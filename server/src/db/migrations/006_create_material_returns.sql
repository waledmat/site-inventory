CREATE TABLE IF NOT EXISTS material_returns (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_item_id     UUID NOT NULL REFERENCES issue_items(id),
  project_id        UUID NOT NULL REFERENCES projects(id),
  logged_by         UUID NOT NULL REFERENCES users(id),
  quantity_returned NUMERIC(12,3) NOT NULL CHECK (quantity_returned > 0),
  return_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  condition         VARCHAR(20) NOT NULL CHECK (condition IN ('good','damaged','lost')),
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_returns_issue_item ON material_returns(issue_item_id);
CREATE INDEX IF NOT EXISTS idx_returns_project    ON material_returns(project_id);
CREATE INDEX IF NOT EXISTS idx_returns_date       ON material_returns(return_date);
