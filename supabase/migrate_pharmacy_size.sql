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
