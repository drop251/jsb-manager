-- Fiches pédagogiques rattachées à la version et à la discipline.
-- NULL = fiche synthétique existante, jamais présentée comme fiche complète.
BEGIN;
ALTER TABLE jsb_catalogue.exercises
 ADD COLUMN pedagogical_details jsonb,
 ADD CONSTRAINT pedagogical_details_object CHECK (
  pedagogical_details IS NULL OR
  (jsonb_typeof(pedagogical_details)='object' AND octet_length(pedagogical_details::text)<=32768)
 );
COMMIT;
