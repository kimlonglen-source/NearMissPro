-- NearMissPro Database Schema — aligned to spec exactly
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE pharmacies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  manager_email TEXT NOT NULL,
  address TEXT,
  licence_number TEXT,
  manager_pin_hash TEXT,
  manager_pin_enabled BOOLEAN DEFAULT false,
  subscription_status TEXT DEFAULT 'trial',
  trial_ends_at TIMESTAMPTZ DEFAULT (now() + interval '30 days'),
  login_attempts INT DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  error_step TEXT,
  error_types TEXT[] NOT NULL DEFAULT '{}',
  drug_name TEXT,
  dispensed_drug TEXT,
  prescribed_strength TEXT,
  dispensed_strength TEXT,
  correct_formulation TEXT,
  dispensed_formulation TEXT,
  prescribed_quantity NUMERIC,
  dispensed_quantity NUMERIC,
  where_caught TEXT,
  time_of_day TEXT,
  occurred_at TIMESTAMPTZ,
  factors TEXT[] DEFAULT '{}',
  other_entries JSONB DEFAULT '[]',
  notes TEXT,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  edited_at TIMESTAMPTZ,
  edit_reason TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','voided','redacted')),
  flagged_by_staff BOOLEAN DEFAULT false,
  flag_note TEXT,
  flagged_at TIMESTAMPTZ,
  editable_until TIMESTAMPTZ DEFAULT (now() + interval '15 minutes')
);

CREATE TABLE recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  ai_text TEXT NOT NULL,
  manager_outcome TEXT CHECK (manager_outcome IN ('accepted','modified','no_action')),
  manager_text TEXT,
  manager_name TEXT,
  reviewed_at TIMESTAMPTZ,
  private_note TEXT,
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
  locked BOOLEAN DEFAULT false,
  previous_period_summary TEXT,
  period_summary TEXT,
  agenda_items JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE checkbox_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category TEXT NOT NULL,
  group_name TEXT,
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
  review_outcome TEXT DEFAULT 'pending' CHECK (review_outcome IN ('added','dismissed','pending')),
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

CREATE INDEX idx_incidents_pharmacy ON incidents(pharmacy_id, submitted_at DESC);
CREATE INDEX idx_incidents_step ON incidents(pharmacy_id, error_step) WHERE error_step IS NOT NULL;
CREATE INDEX idx_incidents_occurred ON incidents(pharmacy_id, occurred_at DESC) WHERE occurred_at IS NOT NULL;
CREATE INDEX idx_recommendations_incident ON recommendations(incident_id);
CREATE INDEX idx_reports_pharmacy ON reports(pharmacy_id, period_start);
CREATE INDEX idx_other_entries_outcome ON other_entries(review_outcome);
CREATE INDEX idx_audit_pharmacy ON audit_log(pharmacy_id, created_at DESC);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE pharmacies ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE other_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkbox_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY pharmacies_own ON pharmacies FOR ALL
  USING (id = current_setting('app.pharmacy_id', true)::uuid OR current_setting('app.role', true) = 'founder');

CREATE POLICY incidents_own ON incidents FOR ALL
  USING (pharmacy_id = current_setting('app.pharmacy_id', true)::uuid OR current_setting('app.role', true) = 'founder');

CREATE POLICY recommendations_own ON recommendations FOR ALL
  USING (pharmacy_id = current_setting('app.pharmacy_id', true)::uuid OR current_setting('app.role', true) = 'founder');

CREATE POLICY reports_own ON reports FOR ALL
  USING (pharmacy_id = current_setting('app.pharmacy_id', true)::uuid OR current_setting('app.role', true) = 'founder');

CREATE POLICY other_entries_own ON other_entries FOR ALL
  USING (pharmacy_id = current_setting('app.pharmacy_id', true)::uuid OR current_setting('app.role', true) = 'founder');

CREATE POLICY audit_insert ON audit_log FOR INSERT WITH CHECK (true);
CREATE POLICY audit_read ON audit_log FOR SELECT
  USING (pharmacy_id = current_setting('app.pharmacy_id', true)::uuid OR current_setting('app.role', true) = 'founder');

CREATE POLICY checkbox_read ON checkbox_options FOR SELECT USING (true);
CREATE POLICY checkbox_write ON checkbox_options FOR INSERT WITH CHECK (current_setting('app.role', true) = 'founder');
CREATE POLICY checkbox_update ON checkbox_options FOR UPDATE USING (current_setting('app.role', true) = 'founder');

-- ============================================================
-- SEED DATA
-- ============================================================

-- Layer 1 workflow-stage chips (see migrate_workflow_stage.sql for full taxonomy).
INSERT INTO checkbox_options (category, group_name, label, sort_order) VALUES
  ('error_step', NULL, 'Script entered into PMS',        1),
  ('error_step', NULL, 'Drug picked from shelf',         2),
  ('error_step', NULL, 'Counted / measured',             3),
  ('error_step', NULL, 'Label generated',                4),
  ('error_step', NULL, 'Final check (pharmacist)',       5),
  ('error_step', NULL, 'Bagging / handed to patient',    6),
  ('error_step', NULL, 'Controlled drug dispensing',     7),
  ('error_step', NULL, 'Compliance pack packing',        8);

-- Layer 2 sub-error chips are seeded by migrate_workflow_stage.sql to keep this
-- file readable. Run that migration after creating this schema on a fresh install.

INSERT INTO checkbox_options (category, group_name, label, sort_order) VALUES
  ('where_caught', NULL, 'Data entry check', 1),
  ('where_caught', NULL, 'Initial pharmacist check', 2),
  ('where_caught', NULL, 'Final pharmacist check', 3),
  ('where_caught', NULL, 'Technician query', 4),
  ('where_caught', NULL, 'Patient at collection', 5);

INSERT INTO checkbox_options (category, group_name, label, sort_order) VALUES
  ('factor', 'Workload', 'High volume period', 1),
  ('factor', 'Workload', 'Interruption / distraction', 2),
  ('factor', 'Workload', 'Understaffed', 3),
  ('factor', 'Workload', 'System slow / down', 4),
  ('factor', 'Product', 'Similar packaging', 10),
  ('factor', 'Product', 'Similar drug names', 11),
  ('factor', 'Product', 'Illegible prescription', 12),
  ('factor', 'Product', 'Unusual dose / strength', 13),
  ('factor', 'People', 'Script not checked against original', 20),
  ('factor', 'People', 'New staff member', 21),
  ('factor', 'People', 'Unfamiliar drug', 22),
  ('factor', 'People', 'Process not followed', 23),
  ('factor', 'People', 'Communication gap', 24);

-- ============================================================
-- TEST PHARMACY (password: test1234)
-- bcrypt hash of "test1234" with 12 rounds
-- ============================================================

INSERT INTO pharmacies (name, password_hash, manager_email)
VALUES (
  'Test Pharmacy',
  '$2a$12$h62Yg3CO5T7Sd9BFzmFuwOnL1W0BDPXNgDZIsj82q.6VgfVH1oWn6',
  'test@nearmisspro.co.nz'
);
