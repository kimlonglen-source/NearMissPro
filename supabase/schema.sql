-- NearMissPro Supabase Schema
-- Phase 1: Core tables with Row-Level Security

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE user_role AS ENUM ('staff', 'manager', 'founder');
CREATE TYPE incident_status AS ENUM ('draft', 'submitted', 'reviewed', 'archived');
CREATE TYPE dispensary_stage AS ENUM ('data_entry', 'dispensing', 'labelling');
CREATE TYPE error_type AS ENUM (
  'wrong_drug', 'wrong_dose', 'wrong_formulation', 'wrong_patient',
  'wrong_quantity', 'wrong_label', 'wrong_directions', 'omission', 'other'
);
CREATE TYPE detection_point AS ENUM (
  'data_entry_check', 'dispensing_check', 'labelling_check',
  'final_check', 'patient_counselling', 'after_collection', 'other'
);
CREATE TYPE time_of_day AS ENUM ('morning', 'midday', 'afternoon', 'evening');

CREATE TABLE pharmacies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  nzbn TEXT,
  address TEXT,
  city TEXT,
  region TEXT,
  pharmacy_code TEXT UNIQUE NOT NULL,
  manager_pin TEXT,
  is_active BOOLEAN DEFAULT true,
  subscription_status TEXT DEFAULT 'trial',
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'founder',
  mfa_secret TEXT,
  mfa_enabled BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pharmacy_id UUID REFERENCES pharmacies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE checkbox_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pharmacy_id UUID REFERENCES pharmacies(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  group_name TEXT,
  label TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  is_default BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  status incident_status DEFAULT 'submitted',
  dispensary_stage dispensary_stage NOT NULL,
  error_types error_type[] NOT NULL DEFAULT '{}',
  prescribed_drug TEXT,
  dispensed_drug TEXT,
  prescribed_strength TEXT,
  dispensed_strength TEXT,
  prescribed_formulation TEXT,
  dispensed_formulation TEXT,
  detection_point detection_point NOT NULL,
  time_of_day time_of_day NOT NULL,
  contributing_factors UUID[] DEFAULT '{}',
  notes TEXT,
  reported_by TEXT DEFAULT 'Staff',
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE other_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
  pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  recommendation_text TEXT NOT NULL,
  model_used TEXT DEFAULT 'claude-sonnet-4-6',
  prompt_tokens INT,
  completion_tokens INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  report_month DATE NOT NULL,
  pdf_url TEXT,
  s3_key TEXT,
  incident_count INT DEFAULT 0,
  generated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_incidents_pharmacy ON incidents(pharmacy_id);
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incidents_created ON incidents(created_at DESC);
CREATE INDEX idx_incidents_pharmacy_date ON incidents(pharmacy_id, created_at DESC);
CREATE INDEX idx_sessions_token ON sessions(token_hash);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
CREATE INDEX idx_checkbox_options_pharmacy ON checkbox_options(pharmacy_id, category);
CREATE INDEX idx_reports_pharmacy_month ON reports(pharmacy_id, report_month);
CREATE INDEX idx_recommendations_incident ON recommendations(incident_id);

ALTER TABLE pharmacies ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkbox_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE other_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY pharmacy_staff_read ON pharmacies
  FOR SELECT USING (
    id = current_setting('app.pharmacy_id', true)::uuid
    OR current_setting('app.role', true) = 'founder'
  );

CREATE POLICY pharmacy_founder_manage ON pharmacies
  FOR ALL USING (current_setting('app.role', true) = 'founder');

CREATE POLICY incidents_pharmacy_read ON incidents
  FOR SELECT USING (
    pharmacy_id = current_setting('app.pharmacy_id', true)::uuid
    OR current_setting('app.role', true) = 'founder'
  );

CREATE POLICY incidents_pharmacy_insert ON incidents
  FOR INSERT WITH CHECK (
    pharmacy_id = current_setting('app.pharmacy_id', true)::uuid
  );

CREATE POLICY incidents_pharmacy_update ON incidents
  FOR UPDATE USING (
    pharmacy_id = current_setting('app.pharmacy_id', true)::uuid
    OR current_setting('app.role', true) = 'founder'
  );

CREATE POLICY recommendations_pharmacy ON recommendations
  FOR ALL USING (
    pharmacy_id = current_setting('app.pharmacy_id', true)::uuid
    OR current_setting('app.role', true) = 'founder'
  );

CREATE POLICY reports_pharmacy ON reports
  FOR ALL USING (
    pharmacy_id = current_setting('app.pharmacy_id', true)::uuid
    OR current_setting('app.role', true) = 'founder'
  );

CREATE POLICY checkbox_options_read ON checkbox_options
  FOR SELECT USING (
    pharmacy_id = current_setting('app.pharmacy_id', true)::uuid
    OR pharmacy_id IS NULL
    OR current_setting('app.role', true) = 'founder'
  );

CREATE POLICY checkbox_options_manage ON checkbox_options
  FOR ALL USING (
    current_setting('app.role', true) IN ('manager', 'founder')
  );

CREATE POLICY other_entries_read ON other_entries
  FOR SELECT USING (
    incident_id IN (
      SELECT id FROM incidents
      WHERE pharmacy_id = current_setting('app.pharmacy_id', true)::uuid
    )
    OR current_setting('app.role', true) = 'founder'
  );

CREATE POLICY other_entries_insert ON other_entries
  FOR INSERT WITH CHECK (
    incident_id IN (
      SELECT id FROM incidents
      WHERE pharmacy_id = current_setting('app.pharmacy_id', true)::uuid
    )
  );

CREATE POLICY sessions_own ON sessions
  FOR ALL USING (
    pharmacy_id = current_setting('app.pharmacy_id', true)::uuid
    OR user_id = current_setting('app.user_id', true)::uuid
  );

INSERT INTO checkbox_options (pharmacy_id, category, group_name, label, sort_order) VALUES
  (NULL, 'error_type', 'Data entry', 'Wrong patient selected', 1),
  (NULL, 'error_type', 'Data entry', 'Wrong drug entered', 2),
  (NULL, 'error_type', 'Data entry', 'Wrong dose entered', 3),
  (NULL, 'error_type', 'Data entry', 'Wrong quantity entered', 4),
  (NULL, 'error_type', 'Data entry', 'Wrong directions entered', 5),
  (NULL, 'error_type', 'Data entry', 'Interaction/allergy missed', 6),
  (NULL, 'error_type', 'Dispensing', 'Wrong drug picked', 10),
  (NULL, 'error_type', 'Dispensing', 'Wrong strength picked', 11),
  (NULL, 'error_type', 'Dispensing', 'Wrong formulation picked', 12),
  (NULL, 'error_type', 'Dispensing', 'Wrong quantity counted', 13),
  (NULL, 'error_type', 'Dispensing', 'Expired product picked', 14),
  (NULL, 'error_type', 'Dispensing', 'Wrong generic brand', 15),
  (NULL, 'error_type', 'Labelling', 'Wrong label applied', 20),
  (NULL, 'error_type', 'Labelling', 'Wrong directions on label', 21),
  (NULL, 'error_type', 'Labelling', 'Wrong patient on label', 22),
  (NULL, 'error_type', 'Labelling', 'Auxiliary labels missing', 23),
  (NULL, 'error_type', 'Labelling', 'Label not attached', 24);

INSERT INTO checkbox_options (pharmacy_id, category, group_name, label, sort_order) VALUES
  (NULL, 'detection_point', NULL, 'During data entry', 1),
  (NULL, 'detection_point', NULL, 'During dispensing', 2),
  (NULL, 'detection_point', NULL, 'During labelling', 3),
  (NULL, 'detection_point', NULL, 'At final check', 4),
  (NULL, 'detection_point', NULL, 'At patient counselling', 5),
  (NULL, 'detection_point', NULL, 'After collection', 6);

INSERT INTO checkbox_options (pharmacy_id, category, group_name, label, sort_order) VALUES
  (NULL, 'contributing_factor', 'Workload', 'High prescription volume', 1),
  (NULL, 'contributing_factor', 'Workload', 'Understaffed', 2),
  (NULL, 'contributing_factor', 'Workload', 'Interruptions/distractions', 3),
  (NULL, 'contributing_factor', 'Workload', 'Time pressure', 4),
  (NULL, 'contributing_factor', 'Workload', 'End of shift fatigue', 5),
  (NULL, 'contributing_factor', 'Product', 'Look-alike packaging', 10),
  (NULL, 'contributing_factor', 'Product', 'Sound-alike names', 11),
  (NULL, 'contributing_factor', 'Product', 'Similar strengths available', 12),
  (NULL, 'contributing_factor', 'Product', 'Shelf placement', 13),
  (NULL, 'contributing_factor', 'Product', 'Manufacturer change', 14),
  (NULL, 'contributing_factor', 'People', 'Inexperienced staff', 20),
  (NULL, 'contributing_factor', 'People', 'Unfamiliar medication', 21),
  (NULL, 'contributing_factor', 'People', 'Communication breakdown', 22),
  (NULL, 'contributing_factor', 'People', 'Training gap', 23),
  (NULL, 'contributing_factor', 'People', 'Handwriting legibility', 24);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_pharmacies_updated BEFORE UPDATE ON pharmacies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_incidents_updated BEFORE UPDATE ON incidents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
