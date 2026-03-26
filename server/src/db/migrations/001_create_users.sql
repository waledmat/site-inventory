CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(255) NOT NULL,
  role           VARCHAR(50) NOT NULL CHECK (role IN ('admin','storekeeper','requester','superuser','coordinator')),
  email          VARCHAR(255) UNIQUE NOT NULL,
  phone          VARCHAR(50),
  password_hash  TEXT NOT NULL,
  position       VARCHAR(255),
  authorized_by  UUID REFERENCES users(id),
  is_active      BOOLEAN DEFAULT TRUE,
  notify_email   BOOLEAN DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
