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
  ('error_step', NULL, 'Script entered into PMS',        1),
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

-- Script entered into PMS
INSERT INTO checkbox_options (category, group_name, label, sort_order) VALUES
  ('error_type', 'Script entered into PMS', 'Wrong patient',                         1),
  ('error_type', 'Script entered into PMS', 'Wrong drug entered',                    2),
  ('error_type', 'Script entered into PMS', 'Wrong strength entered',                3),
  ('error_type', 'Script entered into PMS', 'Wrong directions',                      4),
  ('error_type', 'Script entered into PMS', 'Wrong quantity entered',                5),
  ('error_type', 'Script entered into PMS', 'Repeat dispensed too early',            6),
  ('error_type', 'Script entered into PMS', 'Allergy missed or overridden',          7),
  ('error_type', 'Script entered into PMS', 'Interaction missed',                    8),
  ('error_type', 'Script entered into PMS', 'Wrong frequency',                     100),
  ('error_type', 'Script entered into PMS', 'Wrong route',                         101),
  ('error_type', 'Script entered into PMS', 'Repeat overdue (continuity gap)',     102),
  ('error_type', 'Script entered into PMS', 'Duplicate therapy missed',            103),
  ('error_type', 'Script entered into PMS', 'Renal or hepatic dose adjustment missed', 104),
  ('error_type', 'Script entered into PMS', 'Paediatric dose error',               105),
  ('error_type', 'Script entered into PMS', 'Geriatric dose error',                106),
  ('error_type', 'Script entered into PMS', 'Pregnancy or breastfeeding category missed', 107),
  ('error_type', 'Script entered into PMS', 'Pharmac Special Authority not checked', 108),
  ('error_type', 'Script entered into PMS', 'Wrong Pharmac brand supplied',        109),
  ('error_type', 'Script entered into PMS', 'NHI / HPI mismatch',                  110),
  ('error_type', 'Script entered into PMS', 'Wrong subsidy code',                  111),
  ('error_type', 'Script entered into PMS', 'PSO treated as patient script',      112),
  ('error_type', 'Script entered into PMS', 'NZePS prescription not actioned',    113),
  ('error_type', 'Script entered into PMS', 'Out-of-date prescription (>6 months)', 114),
  ('error_type', 'Script entered into PMS', 'Forged or altered prescription accepted', 115),
  ('error_type', 'Script entered into PMS', 'Verbal or phone order misheard',     116),
  ('error_type', 'Script entered into PMS', 'Faxed prescription misread',         117),
  ('error_type', 'Script entered into PMS', 'Hospital discharge misinterpreted',  118);

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
-- under "Script entered into PMS" or "Drug picked from shelf".
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
  ('error_type', 'Compliance pack packing', 'Wrong day / time slot',                1),
  ('error_type', 'Compliance pack packing', 'Wrong drug in pack',                   2),
  ('error_type', 'Compliance pack packing', 'Wrong patient''s pack',                3),
  ('error_type', 'Compliance pack packing', 'Missing dose from pack',               4),
  ('error_type', 'Compliance pack packing', 'Extra dose in pack',                   5);
