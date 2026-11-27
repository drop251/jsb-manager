-- Private coach workspace for attendance; no shared club memberships or production data.
BEGIN;
CREATE TABLE jsb_private.attendance_registers (
 owner_id text PRIMARY KEY REFERENCES jsb_auth.accounts(id) ON DELETE CASCADE,
 revision integer NOT NULL CHECK (revision>0),
 snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot)='object' AND octet_length(snapshot::text)<=350000),
 updated_at bigint NOT NULL CHECK (updated_at>=0)
);
REVOKE ALL ON jsb_private.attendance_registers FROM PUBLIC;
COMMIT;
