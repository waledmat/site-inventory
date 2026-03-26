CREATE TABLE IF NOT EXISTS escalations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID NOT NULL REFERENCES material_requests(id),
  requester_id    UUID NOT NULL REFERENCES users(id),
  coordinator_id  UUID REFERENCES users(id),
  status          VARCHAR(30) DEFAULT 'open' CHECK (status IN ('open','resolved','closed')),
  notes           TEXT,
  resolution      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ
);
