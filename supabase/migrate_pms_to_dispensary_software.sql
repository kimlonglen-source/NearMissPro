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
