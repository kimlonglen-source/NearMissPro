-- Retire the "Patient at collection" where-caught option.
--
-- A near miss is, by definition, an error caught BEFORE the medication is
-- handed to the patient. Anything that reached the patient is a dispensing
-- error and belongs in a different process (Pharmacy Council notification,
-- CARM via Medsafe, HDC if harm). The Record form now enforces this with
-- a gating question; this migration retires the now-invalid option so it
-- can't be selected on existing pharmacies either.
--
-- Strategy:
--   * Mark the option inactive, don't delete it. Historical incidents that
--     reference it stay valid for audit; the form just stops offering it.
--   * Existing incidents are NOT re-tagged. If a pharmacy wants to clean
--     them up, that's a separate manual review (some may legitimately be
--     near misses caught at the counter before handover; some may be
--     dispensing errors that were mis-classified).

UPDATE checkbox_options
   SET active = false
 WHERE category = 'where_caught'
   AND label = 'Patient at collection';
