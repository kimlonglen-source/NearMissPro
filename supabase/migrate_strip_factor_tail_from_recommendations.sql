-- One-off cleanup. The earlier stub-recommendation generator appended
-- "Contributing factors: X, Y." to every recommendation, which just
-- restated data shown elsewhere on the report and added no fix-action.
-- The generator no longer does this. This migration strips the same
-- tail from records already saved so they stop showing the redundant
-- line in the printed report.
--
-- Only ai_text is touched. manager_text (the pharmacist's own
-- modified version) is left alone — that's their professional text,
-- not ours to rewrite.
--
-- Safe to re-run. Idempotent because the pattern matches the appended
-- tail; once stripped, the regex no longer matches.

UPDATE recommendations
   SET ai_text = regexp_replace(ai_text, '\s*Contributing factors?:\s*[^.]+\.\s*$', '')
 WHERE ai_text ~ 'Contributing factors?:\s*[^.]+\.\s*$';
