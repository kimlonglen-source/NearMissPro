-- Password reset tokens for self-service recovery via email.
-- Token itself never lives in the database — we store the hash so a
-- read-only leak of this table doesn't let an attacker mint resets.
-- Tokens are one-time use (used_at is set) and expire after 60 min.
-- password_type tells the reset endpoint which password to update
-- (the shared pharmacy password used by all staff, or the manager
-- password held by the pharmacist-in-charge).
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  password_type TEXT NOT NULL CHECK (password_type IN ('pharmacy', 'manager')),
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_hash
  ON password_reset_tokens(token_hash);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_pharmacy
  ON password_reset_tokens(pharmacy_id, created_at DESC);
