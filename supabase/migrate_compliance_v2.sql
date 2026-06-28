-- Compliance hardening v2: self-serve deletion requests + CQI report
-- enrichments (last-meeting review and next-review date).
--
-- Pharmacy Council Standard 1.8 (CQI) expects the period report to
-- show evidence that actions from the previous review were followed
-- up, and to document a forward-looking review cadence. Privacy Act
-- 2020 expects pharmacies to be able to ask for account deletion
-- without contacting us by email.

-- 1. Account-deletion requests on pharmacies.
ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ;
ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS deletion_requested_by TEXT;

-- 2. Report enrichments for the CQI loop.
ALTER TABLE reports ADD COLUMN IF NOT EXISTS last_meeting_review TEXT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS next_review_date DATE;
