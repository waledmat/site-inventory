CREATE TABLE IF NOT EXISTS daily_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date     DATE NOT NULL,
  project_id      UUID REFERENCES projects(id),
  user_id         UUID REFERENCES users(id),
  issued_count    INTEGER DEFAULT 0,
  returned_count  INTEGER DEFAULT 0,
  pending_count   INTEGER DEFAULT 0,
  overdue_count   INTEGER DEFAULT 0,
  sent_at         TIMESTAMPTZ,
  channel         VARCHAR(20) DEFAULT 'email'
);

CREATE INDEX IF NOT EXISTS idx_daily_reports_date    ON daily_reports(report_date);
CREATE INDEX IF NOT EXISTS idx_daily_reports_project ON daily_reports(project_id);
