-- Self-serve pharmacy signup support.
-- Adds the columns we need to track signup applications, plus a
-- one-time token table for the "set your password" link sent on
-- approval. After this migration:
-- * pharmacies.password_hash is nullable (a pending pharmacy has
--   no password yet; it's set after the founder approves and the
--   pharmacy clicks the setup link).
-- * Subscription_status grows two new values: 'pending_approval'
--   for new applications and 'declined' for ones the founder
--   rejects. ('trial', 'active', 'suspended' stay as before.)
-- * New profile columns capture what the pharmacy entered at
--   signup time + the founder's review timestamps.

ALTER TABLE pharmacies ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ;
ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ;
ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS decline_reason TEXT;
ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS signup_notes TEXT;
ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS signup_source TEXT;

CREATE TABLE IF NOT EXISTS password_setup_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_setup_tokens_hash
  ON password_setup_tokens(token_hash);

CREATE INDEX IF NOT EXISTS idx_password_setup_tokens_pharmacy
  ON password_setup_tokens(pharmacy_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON password_setup_tokens TO service_role;
