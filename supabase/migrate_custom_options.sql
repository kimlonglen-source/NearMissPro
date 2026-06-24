-- Pharmacy-wide custom chips for the four record-form sections.
-- When staff use "+ Other" on the form, the typed value is saved here
-- so it appears as a normal chip for everyone in the pharmacy from
-- then on. Capped at 8 per section in the server route.
CREATE TABLE IF NOT EXISTS pharmacy_custom_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  section TEXT NOT NULL CHECK (section IN ('stage','error_type','where_caught','factor')),
  label TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (pharmacy_id, section, label)
);

CREATE INDEX IF NOT EXISTS idx_custom_options_pharmacy
  ON pharmacy_custom_options(pharmacy_id, section);

-- Explicit grant for the API service_role (see migrate_trusted_devices
-- for the why — Supabase doesn't auto-grant new tables when "Automatically
-- expose new tables" is off, which is the recommended secure setting).
GRANT SELECT, INSERT, UPDATE, DELETE ON pharmacy_custom_options TO service_role;
