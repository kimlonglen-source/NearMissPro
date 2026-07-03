-- Per-pharmacy AI switch. When a pharmacy turns AI off in
-- Settings → Pharmacy, the server skips every external AI call for them
-- and falls back to the built-in NZ-grounded recommendations and period
-- summary — nothing about their near misses leaves the system.
--
-- Defaults to TRUE (AI on) so existing pharmacies keep the feature. The
-- server also treats a missing/failed lookup as "on", so this migration
-- is safe to apply before or after deploying the code.

ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN NOT NULL DEFAULT TRUE;
