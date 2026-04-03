-- NearMissPro Database Schema
-- Aligned to Product Specification v4.0

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('staff', 'manager', 'founder');
CREATE TYPE incident_status AS ENUM ('active', 'voided', 'redacted');
CREATE TYPE manager_outcome AS ENUM ('accepted', 'modified', 'no_action');
CREATE TYPE review_outcome AS ENUM ('added', 'dismissed', 'pending');

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE pharmacies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,            -- used as username for staff login
  password_hash TEXT NOT NULL,           -- bcrypt hashed
  manager_email TEXT NOT NULL,
  address TEXT,
  licence_number TEXT,
  manager_pin_hash TEXT,                 -- bcrypt hashed, nullable
  manager_pin_enabled BOOLEAN DEFAULT false,
  subscription_status TEXT DEFAULT 'trial',
  trial_ends_at TIMESTAMPTZ DEFAULT (now() + interval '30 days'),
  login_attempts INT DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE founder_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  mfa_secret TEXT NOT NULL,
  login_attempts INT DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  error_types TEXT[] NOT NULL DEFAULT '{}',
  drug_name TEXT,
  dispensed_drug TEXT,                   -- wrong drug swap
  prescribed_strength TEXT,
  dispensed_strength TEXT,               -- wrong dose swap
  correct_formulation TEXT,
  dispensed_formulation TEXT,            -- wrong formulation swap
  where_caught TEXT,
  time_of_day TEXT,
  factors TEXT[] DEFAULT '{}',
  other_entries JSONB DEFAULT '[]',      -- [{category, text}]
  notes TEXT,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  edited_at TIMESTAMPTZ,
  edit_reason TEXT,
  status incident_status DEFAULT 'active',
  void_reason TEXT,
  flagged_by_staff BOOLEAN DEFAULT false,
  flag_note TEXT,
  editable_until TIMESTAMPTZ DEFAULT (now() + interval '15 minutes'),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  ai_text TEXT NOT NULL,
  manager_outcome manager_outcome,
  manager_text TEXT,
  manager_note TEXT,                     -- private, not in report
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT now(),
  generated_by TEXT,
  pdf_url TEXT,
  s3_key TEXT,
  locked BOOLEAN DEFAULT false,
  previous_summary TEXT,                 -- editable AI summary of last period
  previous_summary_edited BOOLEAN DEFAULT false,
  period_summary TEXT,                   -- editable AI summary of this period
  period_summary_edited BOOLEAN DEFAULT false,
  meeting_agenda JSONB DEFAULT '[]',     -- [{text, edited}]
  meeting_agenda_edited BOOLEAN DEFAULT false,
  incident_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE checkbox_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category TEXT NOT NULL,                -- 'error_type', 'where_caught', 'factor'
  group_name TEXT,                       -- 'Data entry', 'Dispensing', 'Labelling', 'Workload', 'Product', 'People'
  label TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_by_founder BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE other_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  text TEXT NOT NULL,
  reviewed_by_founder BOOLEAN DEFAULT false,
  review_outcome review_outcome DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pharmacy_id UUID REFERENCES pharmacies(id),
  action TEXT NOT NULL,
  performed_by TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_incidents_pharmacy ON incidents(pharmacy_id);
CREATE INDEX idx_incidents_pharmacy_date ON incidents(pharmacy_id, submitted_at DESC);
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_recommendations_incident ON recommendations(incident_id);
CREATE INDEX idx_recommendations_pharmacy ON recommendations(pharmacy_id);
CREATE INDEX idx_reports_pharmacy ON reports(pharmacy_id, period_start);
CREATE INDEX idx_other_entries_pharmacy ON other_entries(pharmacy_id);
CREATE INDEX idx_other_entries_outcome ON other_entries(review_outcome);
CREATE INDEX idx_audit_log_pharmacy ON audit_log(pharmacy_id, created_at DESC);
CREATE INDEX idx_checkbox_options_category ON checkbox_options(category, sort_order);

-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================

ALTER TABLE pharmacies ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE other_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Pharmacies: own row only; founder sees all
CREATE POLICY pharmacies_own ON pharmacies
  FOR ALL USING (
    id = current_setting('app.pharmacy_id', true)::uuid
    OR current_setting('app.role', true) = 'founder'
  );

-- Incidents: own pharmacy only; founder sees all
CREATE POLICY incidents_own ON incidents
  FOR ALL USING (
    pharmacy_id = current_setting('app.pharmacy_id', true)::uuid
    OR current_setting('app.role', true) = 'founder'
  );

-- Recommendations: own pharmacy; founder sees all
CREATE POLICY recommendations_own ON recommendations
  FOR ALL USING (
    pharmacy_id = current_setting('app.pharmacy_id', true)::uuid
    OR current_setting('app.role', true) = 'founder'
  );

-- Reports: own pharmacy; founder sees all
CREATE POLICY reports_own ON reports
  FOR ALL USING (
    pharmacy_id = current_setting('app.pharmacy_id', true)::uuid
    OR current_setting('app.role', true) = 'founder'
  );

-- Other entries: own pharmacy; founder sees all
CREATE POLICY other_entries_own ON other_entries
  FOR ALL USING (
    pharmacy_id = current_setting('app.pharmacy_id', true)::uuid
    OR current_setting('app.role', true) = 'founder'
  );

-- Audit log: INSERT only for all roles; SELECT for founder only
CREATE POLICY audit_log_insert ON audit_log
  FOR INSERT WITH CHECK (true);

CREATE POLICY audit_log_read ON audit_log
  FOR SELECT USING (
    pharmacy_id = current_setting('app.pharmacy_id', true)::uuid
    OR current_setting('app.role', true) = 'founder'
  );

-- No UPDATE or DELETE on audit_log — immutable by design

-- checkbox_options: readable by all, writable by founder only
ALTER TABLE checkbox_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY checkbox_options_read ON checkbox_options
  FOR SELECT USING (true);
CREATE POLICY checkbox_options_write ON checkbox_options
  FOR INSERT WITH CHECK (current_setting('app.role', true) = 'founder');
CREATE POLICY checkbox_options_update ON checkbox_options
  FOR UPDATE USING (current_setting('app.role', true) = 'founder');

-- ============================================================
-- SEED DATA
-- ============================================================

-- Error types — Data entry
INSERT INTO checkbox_options (category, group_name, label, sort_order) VALUES
  ('error_type', 'Data entry', 'Wrong patient', 1),
  ('error_type', 'Data entry', 'Repeat dispensed early', 2);

-- Error types — Dispensing
INSERT INTO checkbox_options (category, group_name, label, sort_order) VALUES
  ('error_type', 'Dispensing', 'Wrong drug', 10),
  ('error_type', 'Dispensing', 'Wrong dose', 11),
  ('error_type', 'Dispensing', 'Wrong quantity', 12),
  ('error_type', 'Dispensing', 'Wrong formulation', 13),
  ('error_type', 'Dispensing', 'Expired medication', 14);

-- Error types — Labelling
INSERT INTO checkbox_options (category, group_name, label, sort_order) VALUES
  ('error_type', 'Labelling', 'Wrong patient details on label', 20),
  ('error_type', 'Labelling', 'Wrong directions on label', 21),
  ('error_type', 'Labelling', 'CAL missing or incorrect', 22),
  ('error_type', 'Labelling', 'Label on wrong item', 23);

-- Where caught
INSERT INTO checkbox_options (category, group_name, label, sort_order) VALUES
  ('where_caught', NULL, 'Data entry check', 1),
  ('where_caught', NULL, 'Initial pharmacist check', 2),
  ('where_caught', NULL, 'Final pharmacist check', 3),
  ('where_caught', NULL, 'Technician query', 4),
  ('where_caught', NULL, 'Patient at collection', 5);

-- Factors — Workload
INSERT INTO checkbox_options (category, group_name, label, sort_order) VALUES
  ('factor', 'Workload', 'High volume period', 1),
  ('factor', 'Workload', 'Interruption / distraction', 2),
  ('factor', 'Workload', 'Understaffed', 3),
  ('factor', 'Workload', 'System slow / down', 4);

-- Factors — Product
INSERT INTO checkbox_options (category, group_name, label, sort_order) VALUES
  ('factor', 'Product', 'Similar packaging', 10),
  ('factor', 'Product', 'Similar drug names', 11),
  ('factor', 'Product', 'Illegible prescription', 12),
  ('factor', 'Product', 'Unusual dose / strength', 13);

-- Factors — People
INSERT INTO checkbox_options (category, group_name, label, sort_order) VALUES
  ('factor', 'People', 'Script not checked against original', 20),
  ('factor', 'People', 'New staff member', 21),
  ('factor', 'People', 'Unfamiliar drug', 22),
  ('factor', 'People', 'Process not followed', 23),
  ('factor', 'People', 'Communication gap', 24);

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_pharmacies_updated BEFORE UPDATE ON pharmacies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
