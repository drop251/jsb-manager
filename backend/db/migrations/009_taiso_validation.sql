-- Validation explicitly attested by the owner; edits invalidate the attestation.
BEGIN;
ALTER TABLE jsb_private.taiso_drafts
 ADD COLUMN validated_at bigint CHECK (validated_at IS NULL OR validated_at>=0);
COMMIT;
