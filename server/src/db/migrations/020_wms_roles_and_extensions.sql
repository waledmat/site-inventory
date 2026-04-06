-- Migration 020: Extend roles and request status for WMS

-- Widen users.role CHECK to include WMS roles
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN (
    'admin','superuser','storekeeper','requester','coordinator',
    'warehouse_manager','receiver','picker'
  ));

-- Widen material_requests.status CHECK for warehouse workflow
ALTER TABLE material_requests DROP CONSTRAINT IF EXISTS material_requests_status_check;
ALTER TABLE material_requests ADD CONSTRAINT material_requests_status_check
  CHECK (status IN (
    'pending','issued','rejected','escalated',
    'warehouse_requested','warehouse_fulfilled','partially_fulfilled'
  ));

-- Add warehouse_request_id link on material_requests (nullable, set when escalated to warehouse)
ALTER TABLE material_requests
  ADD COLUMN IF NOT EXISTS warehouse_request_id UUID;
