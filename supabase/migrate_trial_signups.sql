-- Trial sign-up interest list.
-- Captured from the public landing page so we can email back to
-- start the actual onboarding. No auth required to insert (the
-- public landing page calls the endpoint directly).
--
-- Cleanup the abandoned/test entries later with:
--   delete from trial_signups where contacted = false and created_at < now() - interval '90 days';

CREATE TABLE IF NOT EXISTS trial_signups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  pharmacy_name TEXT,
  notes TEXT,
  contacted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trial_signups_created
  ON trial_signups(created_at DESC);

-- Grant the service_role full access; nothing else can touch it.
GRANT SELECT, INSERT, UPDATE, DELETE ON trial_signups TO service_role;

ALTER TABLE trial_signups ENABLE ROW LEVEL SECURITY;
