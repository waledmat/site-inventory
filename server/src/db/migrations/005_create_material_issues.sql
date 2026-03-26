CREATE TABLE IF NOT EXISTS material_issues (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id       UUID REFERENCES material_requests(id),
  project_id       UUID NOT NULL REFERENCES projects(id),
  storekeeper_id   UUID NOT NULL REFERENCES users(id),
  receiver_id      UUID REFERENCES users(id),
  issue_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_note_id VARCHAR(100) UNIQUE NOT NULL,
  source           VARCHAR(20) DEFAULT 'request' CHECK (source IN ('request','excel')),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS issue_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id         UUID NOT NULL REFERENCES material_issues(id) ON DELETE CASCADE,
  stock_item_id    UUID REFERENCES stock_items(id),
  item_number      VARCHAR(100),
  description_1    VARCHAR(500) NOT NULL,
  description_2    VARCHAR(500),
  uom              VARCHAR(50) NOT NULL,
  quantity_issued  NUMERIC(12,3) NOT NULL CHECK (quantity_issued > 0)
);

CREATE INDEX IF NOT EXISTS idx_issues_project      ON material_issues(project_id);
CREATE INDEX IF NOT EXISTS idx_issues_storekeeper  ON material_issues(storekeeper_id);
CREATE INDEX IF NOT EXISTS idx_issues_date         ON material_issues(issue_date);
CREATE INDEX IF NOT EXISTS idx_issue_items_issue   ON issue_items(issue_id);
