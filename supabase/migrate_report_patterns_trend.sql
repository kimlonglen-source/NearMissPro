-- ============================================================
-- NearMiss Pro — add pattern_alerts + trend_data to reports
-- Stores drug+error-type hotspots and weekly incident counts
-- computed at report-generation time, so the Report page can
-- render them without re-running detection logic.
-- Run once in Supabase SQL Editor. Safe to re-run.
-- ============================================================

ALTER TABLE reports ADD COLUMN IF NOT EXISTS pattern_alerts JSONB DEFAULT '[]';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS trend_data     JSONB DEFAULT '[]';
