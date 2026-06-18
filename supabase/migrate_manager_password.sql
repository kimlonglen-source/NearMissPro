-- Separate password for the manager role. The pharmacy_password
-- (column: password_hash) is shared by the whole team and gates
-- entry to the app. The manager_password (this new column) gates
-- the elevated role and is held only by the pharmacist-in-charge.
--
-- Existing pharmacies have NULL here. The server treats NULL as
-- "fall back to the pharmacy password" so existing pharmacies are
-- not locked out — the UI then nags the manager to set a separate
-- one via Settings.
ALTER TABLE pharmacies
  ADD COLUMN IF NOT EXISTS manager_password_hash TEXT;
