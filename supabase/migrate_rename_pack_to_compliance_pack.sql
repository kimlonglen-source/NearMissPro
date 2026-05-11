-- Rename "pack" → "compliance pack" in the compliance-pack error-type
-- labels so it's clear we're talking about blister/dosette packs and
-- not delivery bags. Updates the lookup table AND any historical
-- incidents that already reference the old label.
--
-- Safe to run more than once.

UPDATE checkbox_options
   SET label = 'Wrong drug in compliance pack'
 WHERE category = 'error_type'
   AND group_name = 'Compliance pack packing'
   AND label = 'Wrong drug in pack';

UPDATE checkbox_options
   SET label = 'Wrong patient''s compliance pack'
 WHERE category = 'error_type'
   AND group_name = 'Compliance pack packing'
   AND label = 'Wrong patient''s pack';

UPDATE checkbox_options
   SET label = 'Missing dose from compliance pack'
 WHERE category = 'error_type'
   AND group_name = 'Compliance pack packing'
   AND label = 'Missing dose from pack';

UPDATE checkbox_options
   SET label = 'Extra dose in compliance pack'
 WHERE category = 'error_type'
   AND group_name = 'Compliance pack packing'
   AND label = 'Extra dose in pack';

-- Rewrite the error_types array on any historical incidents so old
-- entries display with the new wording too.
UPDATE incidents
   SET error_types = array_replace(error_types, 'Wrong drug in pack', 'Wrong drug in compliance pack')
 WHERE 'Wrong drug in pack' = ANY(error_types);

UPDATE incidents
   SET error_types = array_replace(error_types, 'Wrong patient''s pack', 'Wrong patient''s compliance pack')
 WHERE 'Wrong patient''s pack' = ANY(error_types);

UPDATE incidents
   SET error_types = array_replace(error_types, 'Missing dose from pack', 'Missing dose from compliance pack')
 WHERE 'Missing dose from pack' = ANY(error_types);

UPDATE incidents
   SET error_types = array_replace(error_types, 'Extra dose in pack', 'Extra dose in compliance pack')
 WHERE 'Extra dose in pack' = ANY(error_types);
