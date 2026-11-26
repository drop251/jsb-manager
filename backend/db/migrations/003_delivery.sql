-- Delivery leases are short-lived and do not contain plaintext tokens.
BEGIN;
ALTER TABLE jsb_auth.delivery_outbox
 ADD COLUMN attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 10),
 ADD COLUMN next_attempt_at bigint NOT NULL DEFAULT 0 CHECK (next_attempt_at>=0),
 ADD COLUMN lease_id text CHECK (lease_id ~ '^[a-f0-9]{32}$'),
 ADD COLUMN lease_until bigint CHECK (lease_until>=0),
 ADD CONSTRAINT delivery_lease_pair CHECK ((lease_id IS NULL)=(lease_until IS NULL));
CREATE INDEX delivery_outbox_ready ON jsb_auth.delivery_outbox(next_attempt_at,id);
COMMIT;
