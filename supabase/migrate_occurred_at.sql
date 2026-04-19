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
