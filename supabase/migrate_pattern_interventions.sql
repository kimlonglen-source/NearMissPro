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
