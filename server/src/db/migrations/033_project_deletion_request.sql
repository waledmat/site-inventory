-- Adds pending-deletion fields so a non-admin (superuser) can request a project
-- deletion that an admin must explicitly approve. Approval flips is_active=false
-- and clears the pending fields.
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS pending_deletion_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pending_deletion_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pending_deletion_reason TEXT;
