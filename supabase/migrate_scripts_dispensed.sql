-- Near-miss rate denominator. The manager enters the total number of
-- scripts dispensed for the period (from their dispensary software)
-- when generating the report. The summary then shows the near-miss
-- rate ("24 of 8,200 scripts — 0.29%"), which is the number
-- pharmacies actually benchmark against period to period.
ALTER TABLE reports ADD COLUMN IF NOT EXISTS scripts_dispensed INTEGER;
