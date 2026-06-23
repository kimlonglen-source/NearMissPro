-- Device verification ("trust this device") for staff login.
--
-- trusted_devices: once a device has been approved via email,
-- subsequent logins from the same browser go straight through.
-- The deviceId stored in browser localStorage is hashed before
-- being saved here so a read-only leak of this table doesn't let
-- an attacker reuse a device approval.
--
-- device_verification_requests: pending approvals. A login attempt
-- from an unrecognised device generates a one-time token and a row
-- here, then sends an email to the pharmacy email with an approve
-- link. The link consumes the token (used_at) and promotes the
-- device into trusted_devices.

CREATE TABLE IF NOT EXISTS trusted_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  device_id_hash TEXT NOT NULL,
  device_label TEXT,
  first_approved_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (pharmacy_id, device_id_hash)
);

CREATE INDEX IF NOT EXISTS idx_trusted_devices_lookup
  ON trusted_devices(pharmacy_id, device_id_hash);

CREATE TABLE IF NOT EXISTS device_verification_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  device_id_hash TEXT NOT NULL,
  device_label TEXT,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_verifications_hash
  ON device_verification_requests(token_hash);
