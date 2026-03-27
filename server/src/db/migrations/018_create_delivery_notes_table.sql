-- Delivery notes tracking table (links to material_issues)
CREATE TABLE IF NOT EXISTS delivery_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dn_number VARCHAR(50) UNIQUE NOT NULL,
  issue_id UUID REFERENCES material_issues(id) ON DELETE CASCADE,
  issued_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dn_issue_idx ON delivery_notes(issue_id);
CREATE INDEX IF NOT EXISTS dn_number_idx ON delivery_notes(dn_number);

-- Update dn_seq to restart per year (reset yearly via app logic, not DB)
-- Also update the format: DN-YYYY-NNNN (was DN-YYYYMMDD-NNNN)
