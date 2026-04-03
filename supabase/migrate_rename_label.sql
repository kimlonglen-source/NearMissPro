-- Run this in Supabase SQL Editor to rename the label
UPDATE checkbox_options
SET label = 'Right med, wrong patient on label'
WHERE label = 'Wrong patient details on label'
  AND category = 'error_type';
