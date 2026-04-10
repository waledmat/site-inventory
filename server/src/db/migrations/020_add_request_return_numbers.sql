-- Sequential reference numbers for requests and returns
-- Issues already have DN-YYYY-NNNN via dn_seq

CREATE SEQUENCE IF NOT EXISTS req_seq START 1;
CREATE SEQUENCE IF NOT EXISTS ret_seq START 1;

ALTER TABLE material_requests ADD COLUMN IF NOT EXISTS request_number VARCHAR(20) UNIQUE;
ALTER TABLE material_returns  ADD COLUMN IF NOT EXISTS return_number  VARCHAR(20) UNIQUE;

CREATE INDEX IF NOT EXISTS idx_requests_number ON material_requests(request_number);
CREATE INDEX IF NOT EXISTS idx_returns_number  ON material_returns(return_number);

-- Track the year each sequence was last used (for annual reset logic in app)
INSERT INTO system_settings (key, value)
  VALUES ('req_seq_year', EXTRACT(YEAR FROM NOW())::TEXT),
         ('ret_seq_year', EXTRACT(YEAR FROM NOW())::TEXT)
  ON CONFLICT (key) DO NOTHING;
