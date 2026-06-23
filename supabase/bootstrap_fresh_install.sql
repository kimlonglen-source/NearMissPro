-- ============================================================
-- NearMissPro — fresh install bootstrap
-- Paste the entire contents of this file into a NEW Supabase
-- project's SQL Editor and click Run. It creates the schema,
-- applies every migration in order, and seeds the taxonomy.
-- Safe on a fresh project (uses IF NOT EXISTS where possible).
-- ============================================================

-- ── 1. CORE SCHEMA ──
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
  pattern_alerts JSONB DEFAULT '[]',
  trend_data JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE pattern_interventions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  drug_key TEXT NOT NULL,
  drug_label TEXT NOT NULL,
  error_type TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_pattern_interventions_lookup
  ON pattern_interventions(pharmacy_id, drug_key, error_type, created_at DESC);

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
-- DATA API GRANTS (service_role)
--
-- From May 30 2026, Supabase no longer auto-grants new tables in
-- the public schema to API roles. From October 30 2026, the same
-- applies to all existing projects on any new table.
--
-- NearMissPro's Express server uses the service_role key for every
-- database call (server-side only — the client never holds it), so
-- we grant service_role full CRUD on every app table. Anon and
-- authenticated roles get NOTHING — there is no direct client→DB
-- traffic by design.
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON pharmacies            TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON incidents             TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON recommendations       TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON reports               TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON pattern_interventions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON checkbox_options      TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON other_entries         TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON audit_log             TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ============================================================
-- SEED DATA
-- ============================================================

-- Layer 1 workflow-stage chips (see migrate_workflow_stage.sql for full taxonomy).
INSERT INTO checkbox_options (category, group_name, label, sort_order) VALUES
  ('error_step', NULL, 'Script entered into dispensary software',        1),
  ('error_step', NULL, 'Drug picked from shelf',         2),
  ('error_step', NULL, 'Counted / measured',             3),
  ('error_step', NULL, 'Label generated',                4),
  ('error_step', NULL, 'Final check (pharmacist)',       5),
  ('error_step', NULL, 'Bagging / handed to patient',    6),
  ('error_step', NULL, 'Controlled drug dispensing',     7),
  ('error_step', NULL, 'Compliance pack packing',        8);

-- Layer 2 sub-error chips are seeded by migrate_workflow_stage.sql to keep this
-- file readable. Run that migration after creating this schema on a fresh install.

-- "Where caught" options — every option is BEFORE the medication is handed to
-- the patient. If a near-miss reached the patient it's a dispensing error and
-- belongs in a different process (Pharmacy Council notification, CARM, HDC).
-- The Record form's opening gate enforces this so the data stays clean.
INSERT INTO checkbox_options (category, group_name, label, sort_order) VALUES
  ('where_caught', NULL, 'Data entry check', 1),
  ('where_caught', NULL, 'Initial pharmacist check', 2),
  ('where_caught', NULL, 'Final pharmacist check', 3),
  ('where_caught', NULL, 'Technician query', 4);

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

-- ── 2. MIGRATIONS (in order) ──

-- ── migrate_workflow_stage.sql ──
-- ============================================================
-- NearMiss Pro — workflow-stage cascade migration
-- Adds Layer 1 (error_step) + Layer 3 quantity capture columns.
-- Seeds ~85 dispensing-incident chips grouped by workflow stage.
-- Additive and nullable — safe for existing incidents.
-- Run in Supabase SQL Editor against an existing deployment.
-- ============================================================

-- ── Schema additions ────────────────────────────────────────
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS error_step TEXT;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS prescribed_quantity NUMERIC;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS dispensed_quantity NUMERIC;

CREATE INDEX IF NOT EXISTS idx_incidents_step
  ON incidents(pharmacy_id, error_step)
  WHERE error_step IS NOT NULL;

-- ── Clear legacy error_type seeds to avoid duplicates ──────
-- (Safe: checkbox_options is a lookup table, never referenced by FK.)
DELETE FROM checkbox_options WHERE category = 'error_type';
DELETE FROM checkbox_options WHERE category = 'error_step';

-- ── Layer 1: workflow stage chips ──────────────────────────
INSERT INTO checkbox_options (category, group_name, label, sort_order) VALUES
  ('error_step', NULL, 'Script entered into dispensary software',        1),
  ('error_step', NULL, 'Drug picked from shelf',         2),
  ('error_step', NULL, 'Counted / measured',             3),
  ('error_step', NULL, 'Labelling',                      4),
  ('error_step', NULL, 'Bagging / handed to patient',    5),
  ('error_step', NULL, 'Controlled drug dispensing',     6),
  ('error_step', NULL, 'Compliance pack packing',        7);

-- ── Layer 2: sub-error chips (grouped by Layer 1 step) ──────
-- group_name = the Layer 1 step label.
-- sort_order < 100 = default-visible (top ~8 per stage).
-- sort_order ≥ 100 = revealed via "More…".

-- Script entered into dispensary software
INSERT INTO checkbox_options (category, group_name, label, sort_order) VALUES
  ('error_type', 'Script entered into dispensary software', 'Wrong patient',                         1),
  ('error_type', 'Script entered into dispensary software', 'Wrong drug entered',                    2),
  ('error_type', 'Script entered into dispensary software', 'Wrong strength entered',                3),
  ('error_type', 'Script entered into dispensary software', 'Wrong directions',                      4),
  ('error_type', 'Script entered into dispensary software', 'Wrong quantity entered',                5),
  ('error_type', 'Script entered into dispensary software', 'Repeat dispensed too early',            6),
  ('error_type', 'Script entered into dispensary software', 'Allergy missed or overridden',          7),
  ('error_type', 'Script entered into dispensary software', 'Interaction missed',                    8),
  ('error_type', 'Script entered into dispensary software', 'Wrong frequency',                     100),
  ('error_type', 'Script entered into dispensary software', 'Wrong route',                         101),
  ('error_type', 'Script entered into dispensary software', 'Repeat overdue (continuity gap)',     102),
  ('error_type', 'Script entered into dispensary software', 'Duplicate therapy missed',            103),
  ('error_type', 'Script entered into dispensary software', 'Renal or hepatic dose adjustment missed', 104),
  ('error_type', 'Script entered into dispensary software', 'Paediatric dose error',               105),
  ('error_type', 'Script entered into dispensary software', 'Geriatric dose error',                106),
  ('error_type', 'Script entered into dispensary software', 'Pregnancy or breastfeeding category missed', 107),
  ('error_type', 'Script entered into dispensary software', 'Pharmac Special Authority not checked', 108),
  ('error_type', 'Script entered into dispensary software', 'Wrong Pharmac brand supplied',        109),
  ('error_type', 'Script entered into dispensary software', 'NHI / HPI mismatch',                  110),
  ('error_type', 'Script entered into dispensary software', 'Wrong subsidy code',                  111),
  ('error_type', 'Script entered into dispensary software', 'PSO treated as patient script',      112),
  ('error_type', 'Script entered into dispensary software', 'NZePS prescription not actioned',    113),
  ('error_type', 'Script entered into dispensary software', 'Out-of-date prescription (>6 months)', 114),
  ('error_type', 'Script entered into dispensary software', 'Forged or altered prescription accepted', 115),
  ('error_type', 'Script entered into dispensary software', 'Verbal or phone order misheard',     116),
  ('error_type', 'Script entered into dispensary software', 'Faxed prescription misread',         117),
  ('error_type', 'Script entered into dispensary software', 'Hospital discharge misinterpreted',  118);

-- Drug picked from shelf
INSERT INTO checkbox_options (category, group_name, label, sort_order) VALUES
  ('error_type', 'Drug picked from shelf', 'Wrong drug — look-alike packaging',     1),
  ('error_type', 'Drug picked from shelf', 'Wrong drug — sound-alike name',         2),
  ('error_type', 'Drug picked from shelf', 'Wrong strength picked',                 3),
  ('error_type', 'Drug picked from shelf', 'Wrong formulation picked',              4),
  ('error_type', 'Drug picked from shelf', 'Expired stock',                         5),
  ('error_type', 'Drug picked from shelf', 'Damaged tablets',                       6),
  ('error_type', 'Drug picked from shelf', 'Wrong brand (bioequivalence)',          7),
  ('error_type', 'Drug picked from shelf', 'Wrong pack size',                       8),
  ('error_type', 'Drug picked from shelf', 'Recalled stock dispensed',            100),
  ('error_type', 'Drug picked from shelf', 'Section 29 documentation issue',      101);

-- Counted / measured
INSERT INTO checkbox_options (category, group_name, label, sort_order) VALUES
  ('error_type', 'Counted / measured', 'Wrong quantity counted',                    1),
  ('error_type', 'Counted / measured', 'Wrong volume measured (liquid)',            2),
  ('error_type', 'Counted / measured', 'Mixed strengths in same container',         3),
  ('error_type', 'Counted / measured', 'Tablet-splitting error',                    4),
  ('error_type', 'Counted / measured', 'Cross-contamination during counting',     100),
  ('error_type', 'Counted / measured', 'Compounding calculation error',           101),
  ('error_type', 'Counted / measured', 'Wrong diluent or base in compound',       102),
  ('error_type', 'Counted / measured', 'Wrong concentration in compound',         103);

-- Labelling
-- Truly label-specific errors only. Data errors (wrong drug, typo in directions,
-- wrong expiry auto-filled from stock, etc.) originate upstream — log those
-- under "Script entered into dispensary software" or "Drug picked from shelf".
INSERT INTO checkbox_options (category, group_name, label, sort_order) VALUES
  ('error_type', 'Labelling', 'Missing CAL (cautionary advisory label)', 1),
  ('error_type', 'Labelling', 'Wrong CAL applied',                       2),
  ('error_type', 'Labelling', 'Label on wrong item / wrong bottle',      3),
  ('error_type', 'Labelling', 'Missing label entirely',                  4),
  ('error_type', 'Labelling', 'Pharmacist initials missing',           100);

-- Bagging / handed to patient
INSERT INTO checkbox_options (category, group_name, label, sort_order) VALUES
  ('error_type', 'Bagging / handed to patient', 'Wrong patient given the bag',      1),
  ('error_type', 'Bagging / handed to patient', 'Bag mixed up between patients',    2),
  ('error_type', 'Bagging / handed to patient', 'Bag missing an item',              3),
  ('error_type', 'Bagging / handed to patient', 'Bag contains extra item',          4),
  ('error_type', 'Bagging / handed to patient', 'Counselling missed',               5),
  ('error_type', 'Bagging / handed to patient', 'Counselling incorrect',            6),
  ('error_type', 'Bagging / handed to patient', 'New-medicine counselling missed',  7),
  ('error_type', 'Bagging / handed to patient', 'Inhaler or device technique not shown', 8),
  ('error_type', 'Bagging / handed to patient', 'Driving or alcohol warning missed', 100),
  ('error_type', 'Bagging / handed to patient', 'ID not checked for CD pickup',    101);

-- Controlled drug dispensing
INSERT INTO checkbox_options (category, group_name, label, sort_order) VALUES
  ('error_type', 'Controlled drug dispensing', 'CD register entry missed',          1),
  ('error_type', 'Controlled drug dispensing', 'CD second-check skipped',           2),
  ('error_type', 'Controlled drug dispensing', 'CD dispensed early',                3),
  ('error_type', 'Controlled drug dispensing', 'Methadone wrong dose dispensed',    4),
  ('error_type', 'Controlled drug dispensing', 'Methadone observed dose not witnessed', 5),
  ('error_type', 'Controlled drug dispensing', 'CD safe left unlocked',             6),
  ('error_type', 'Controlled drug dispensing', 'CD destroyed without proper witness', 7),
  ('error_type', 'Controlled drug dispensing', 'Out-of-date CD prescription dispensed', 8);

-- Compliance pack packing
INSERT INTO checkbox_options (category, group_name, label, sort_order) VALUES
  ('error_type', 'Compliance pack packing', 'Wrong day / time slot',                       1),
  ('error_type', 'Compliance pack packing', 'Wrong drug in compliance pack',               2),
  ('error_type', 'Compliance pack packing', 'Wrong patient''s compliance pack',            3),
  ('error_type', 'Compliance pack packing', 'Missing dose from compliance pack',           4),
  ('error_type', 'Compliance pack packing', 'Extra dose in compliance pack',               5);

-- ── migrate_pharmacy_size.sql ──
-- Pharmacy size — drives the AI's tone in per-incident recommendations
-- and the period summary so a sole-charge pharmacy doesn't get told to
-- "ask the second pharmacist". Settable from Settings → Pharmacy.
--
-- Values:
--   'sole'                 — one pharmacist on duty (no second checker)
--   'pharmacist_plus_tech' — one pharmacist + one or more techs
--   'multi'                — two or more pharmacists rostered together
--
-- NULL is allowed and treated the same as 'pharmacist_plus_tech' (the
-- generic default the AI used before this column existed).

ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS pharmacy_size TEXT;

-- ── migrate_pms_to_dispensary_software.sql ──
-- ============================================================
-- NearMiss Pro — rename "PMS" → "dispensary software"
-- Updates existing data so old incidents match the new UI label.
-- Run once in Supabase SQL Editor against your live deployment.
-- Safe to re-run (no-op if already applied).
-- ============================================================

-- Update the option chip stored in checkbox_options
UPDATE checkbox_options
SET label = 'Script entered into dispensary software'
WHERE category = 'error_step'
  AND label = 'Script entered into PMS';

UPDATE checkbox_options
SET group_name = 'Script entered into dispensary software'
WHERE category = 'error_type'
  AND group_name = 'Script entered into PMS';

-- Update any existing incidents that stored the old value
UPDATE incidents
SET error_step = 'Script entered into dispensary software'
WHERE error_step = 'Script entered into PMS';

-- ── migrate_rename_label.sql ──
-- Run this in Supabase SQL Editor to remove the redundant label
DELETE FROM checkbox_options
WHERE label IN ('Wrong patient details on label', 'Right med, wrong patient on label')
  AND category = 'error_type';

-- ── migrate_rename_pack_to_compliance_pack.sql ──
-- Rename "pack" → "compliance pack" in the compliance-pack error-type
-- labels so it's clear we're talking about blister/dosette packs and
-- not delivery bags. Updates the lookup table AND any historical
-- incidents that already reference the old label.
--
-- Safe to run more than once.

UPDATE checkbox_options
   SET label = 'Wrong drug in compliance pack'
 WHERE category = 'error_type'
   AND group_name = 'Compliance pack packing'
   AND label = 'Wrong drug in pack';

UPDATE checkbox_options
   SET label = 'Wrong patient''s compliance pack'
 WHERE category = 'error_type'
   AND group_name = 'Compliance pack packing'
   AND label = 'Wrong patient''s pack';

UPDATE checkbox_options
   SET label = 'Missing dose from compliance pack'
 WHERE category = 'error_type'
   AND group_name = 'Compliance pack packing'
   AND label = 'Missing dose from pack';

UPDATE checkbox_options
   SET label = 'Extra dose in compliance pack'
 WHERE category = 'error_type'
   AND group_name = 'Compliance pack packing'
   AND label = 'Extra dose in pack';

-- Rewrite the error_types array on any historical incidents so old
-- entries display with the new wording too.
UPDATE incidents
   SET error_types = array_replace(error_types, 'Wrong drug in pack', 'Wrong drug in compliance pack')
 WHERE 'Wrong drug in pack' = ANY(error_types);

UPDATE incidents
   SET error_types = array_replace(error_types, 'Wrong patient''s pack', 'Wrong patient''s compliance pack')
 WHERE 'Wrong patient''s pack' = ANY(error_types);

UPDATE incidents
   SET error_types = array_replace(error_types, 'Missing dose from pack', 'Missing dose from compliance pack')
 WHERE 'Missing dose from pack' = ANY(error_types);

UPDATE incidents
   SET error_types = array_replace(error_types, 'Extra dose in pack', 'Extra dose in compliance pack')
 WHERE 'Extra dose in pack' = ANY(error_types);

-- ── migrate_strip_factor_tail_from_recommendations.sql ──
-- One-off cleanup. The earlier stub-recommendation generator appended
-- "Contributing factors: X, Y." to every recommendation, which just
-- restated data shown elsewhere on the report and added no fix-action.
-- The generator no longer does this. This migration strips the same
-- tail from records already saved so they stop showing the redundant
-- line in the printed report.
--
-- Only ai_text is touched. manager_text (the pharmacist's own
-- modified version) is left alone — that's their professional text,
-- not ours to rewrite.
--
-- Safe to re-run. Idempotent because the pattern matches the appended
-- tail; once stripped, the regex no longer matches.

UPDATE recommendations
   SET ai_text = regexp_replace(ai_text, '\s*Contributing factors?:\s*[^.]+\.\s*$', '')
 WHERE ai_text ~ 'Contributing factors?:\s*[^.]+\.\s*$';

-- ── migrate_retire_patient_collection.sql ──
-- Retire the "Patient at collection" where-caught option.
--
-- A near miss is, by definition, an error caught BEFORE the medication is
-- handed to the patient. Anything that reached the patient is a dispensing
-- error and belongs in a different process (Pharmacy Council notification,
-- CARM via Medsafe, HDC if harm). The Record form now enforces this with
-- a gating question; this migration retires the now-invalid option so it
-- can't be selected on existing pharmacies either.
--
-- Strategy:
--   * Mark the option inactive, don't delete it. Historical incidents that
--     reference it stay valid for audit; the form just stops offering it.
--   * Existing incidents are NOT re-tagged. If a pharmacy wants to clean
--     them up, that's a separate manual review (some may legitimately be
--     near misses caught at the counter before handover; some may be
--     dispensing errors that were mis-classified).

UPDATE checkbox_options
   SET active = false
 WHERE category = 'where_caught'
   AND label = 'Patient at collection';

-- ── migrate_pattern_interventions.sql ──
-- ============================================================
-- NearMiss Pro — pattern interventions
-- Shared intervention log per (drug, error_type) pattern. When a
-- staff member sees the hotspot warning on the Record form, they
-- see prior entries and can add their own. Surfaces in the monthly
-- report's Pattern alerts section.
-- Run once in Supabase SQL Editor. Safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS pattern_interventions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  drug_key TEXT NOT NULL,     -- lowercased + trimmed drug_name for case-insensitive match
  drug_label TEXT NOT NULL,   -- original casing, first recorded, for display
  error_type TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pattern_interventions_lookup
  ON pattern_interventions(pharmacy_id, drug_key, error_type, created_at DESC);

-- ── migrate_report_patterns_trend.sql ──
-- ============================================================
-- NearMiss Pro — add pattern_alerts + trend_data to reports
-- Stores drug+error-type hotspots and weekly incident counts
-- computed at report-generation time, so the Report page can
-- render them without re-running detection logic.
-- Run once in Supabase SQL Editor. Safe to re-run.
-- ============================================================

ALTER TABLE reports ADD COLUMN IF NOT EXISTS pattern_alerts JSONB DEFAULT '[]';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS trend_data     JSONB DEFAULT '[]';

-- ── migrate_occurred_at.sql ──
-- ============================================================
-- NearMiss Pro — Phase 7: time of actual occurrence
-- ============================================================
-- Adds a nullable occurred_at column so staff can log an incident later
-- than when it happened (e.g. dispensary was slammed at the time).
--
-- Readers fall back to submitted_at when occurred_at is NULL, so existing
-- incidents behave exactly as before. New submissions can opt into the
-- separate "when it actually happened" timestamp.
--
-- Additive and safe — run in Supabase SQL Editor against an existing
-- deployment alongside the earlier migrate_workflow_stage.sql.
-- ============================================================

ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_incidents_occurred
  ON incidents(pharmacy_id, occurred_at DESC)
  WHERE occurred_at IS NOT NULL;

-- ── migrate_pharmacy_allowed_ips.sql ──
-- Per-pharmacy allowed-IP list. When non-empty, staff and manager
-- logins must originate from one of these IPs — keeps the account
-- usable inside the dispensary only, blocking home / mobile-data
-- access. Founder login (/api/auth/founder/login) is never IP-
-- restricted, so we can always recover from a lockout.
--
-- Empty array = no restriction (default for existing and new
-- pharmacies — opt-in feature).

ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS allowed_ips TEXT[] DEFAULT '{}';

-- ── migrate_manager_password.sql ──
-- Separate password for the manager role. The pharmacy_password
-- (column: password_hash) is shared by the whole team and gates
-- entry to the app. The manager_password (this new column) gates
-- the elevated role and is held only by the pharmacist-in-charge.
--
-- Existing pharmacies have NULL here. The server treats NULL as
-- "fall back to the pharmacy password" so existing pharmacies are
-- not locked out — the UI then nags the manager to set a separate
-- one via Settings.
ALTER TABLE pharmacies
  ADD COLUMN IF NOT EXISTS manager_password_hash TEXT;

-- ── migrate_manager_name.sql ──
-- Manager's name on each pharmacy. Used for the report greeting,
-- audit log entries, and the salutation in password-reset emails
-- once email infra is added. Existing pharmacies have NULL here
-- (the current manager sets it from Settings -> Pharmacy on first
-- visit after this ships). New pharmacies created via the founder
-- admin or future self-signup are required to supply it.
ALTER TABLE pharmacies
  ADD COLUMN IF NOT EXISTS manager_name TEXT;

-- ── migrate_custom_options.sql ──
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

-- ── migrate_trial_signups.sql ──
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

-- ── migrate_password_reset_tokens.sql ──
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

-- ── migrate_trusted_devices.sql ──
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
