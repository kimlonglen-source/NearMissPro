-- Per-pharmacy allowed-IP list. When non-empty, staff and manager
-- logins must originate from one of these IPs — keeps the account
-- usable inside the dispensary only, blocking home / mobile-data
-- access. Founder login (/api/auth/founder/login) is never IP-
-- restricted, so we can always recover from a lockout.
--
-- Empty array = no restriction (default for existing and new
-- pharmacies — opt-in feature).

ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS allowed_ips TEXT[] DEFAULT '{}';
