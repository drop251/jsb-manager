-- Private Taïso drafts: no grants to PUBLIC and no administrative API.
BEGIN;
CREATE SCHEMA jsb_private;
REVOKE ALL ON SCHEMA jsb_private FROM PUBLIC;
CREATE TABLE jsb_private.taiso_drafts (
 owner_id text NOT NULL REFERENCES jsb_auth.accounts(id) ON DELETE CASCADE,
 id text NOT NULL CHECK (id ~ '^[a-f0-9]{32}$'),
 revision integer NOT NULL DEFAULT 1 CHECK (revision>0),
 title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 120),
 catalogue_version text NOT NULL CHECK (catalogue_version ~ '^[A-Za-z0-9_.-]{1,80}$'),
 catalogue_generation bigint NOT NULL CHECK (catalogue_generation>0),
 settings jsonb NOT NULL CHECK (jsonb_typeof(settings)='object' AND octet_length(settings::text)<=16384),
 snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot)='object' AND octet_length(snapshot::text)<=524288),
 created_at bigint NOT NULL CHECK (created_at>=0),
 updated_at bigint NOT NULL CHECK (updated_at>=created_at),
 PRIMARY KEY(owner_id,id)
);
CREATE INDEX taiso_drafts_order ON jsb_private.taiso_drafts(owner_id,updated_at DESC,id);
REVOKE ALL ON ALL TABLES IN SCHEMA jsb_private FROM PUBLIC;
COMMIT;
