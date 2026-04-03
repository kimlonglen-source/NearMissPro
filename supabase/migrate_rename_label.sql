-- Run this in Supabase SQL Editor to remove the redundant label
DELETE FROM checkbox_options
WHERE label IN ('Wrong patient details on label', 'Right med, wrong patient on label')
  AND category = 'error_type';
