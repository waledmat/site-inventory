-- One report per (date, project). Required for ON CONFLICT upsert in dailyReport.service.js.
DO $$ BEGIN
  -- Collapse any pre-existing duplicates first, keeping the most recent row.
  DELETE FROM daily_reports a
  USING daily_reports b
  WHERE a.report_date = b.report_date
    AND a.project_id  = b.project_id
    AND a.ctid < b.ctid;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'daily_reports_date_project_unique'
  ) THEN
    ALTER TABLE daily_reports
      ADD CONSTRAINT daily_reports_date_project_unique UNIQUE (report_date, project_id);
  END IF;
END $$;
