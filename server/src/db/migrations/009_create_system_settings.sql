CREATE TABLE IF NOT EXISTS system_settings (
  key    VARCHAR(100) PRIMARY KEY,
  value  TEXT NOT NULL
);

INSERT INTO system_settings (key, value) VALUES
  ('daily_report_time', '08:00'),
  ('report_from_email', 'reports@siteinventory.com'),
  ('smtp_host', 'smtp.gmail.com'),
  ('smtp_port', '587'),
  ('smtp_user', ''),
  ('smtp_pass', '')
ON CONFLICT (key) DO NOTHING;
