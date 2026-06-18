-- Manager's name on each pharmacy. Used for the report greeting,
-- audit log entries, and the salutation in password-reset emails
-- once email infra is added. Existing pharmacies have NULL here
-- (the current manager sets it from Settings -> Pharmacy on first
-- visit after this ships). New pharmacies created via the founder
-- admin or future self-signup are required to supply it.
ALTER TABLE pharmacies
  ADD COLUMN IF NOT EXISTS manager_name TEXT;
