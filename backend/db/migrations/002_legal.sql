-- JSB Manager V36: documents and individual acknowledgements.
-- Apply after 001_auth.sql to a new server database. No legal text is seeded.
BEGIN;
CREATE SCHEMA jsb_legal;
REVOKE ALL ON SCHEMA jsb_legal FROM PUBLIC;

CREATE TABLE jsb_legal.document_types (
 type text PRIMARY KEY CHECK(type IN ('cgu','cgv','privacy'))
);
INSERT INTO jsb_legal.document_types(type) VALUES ('cgu'),('cgv'),('privacy');

CREATE TABLE jsb_legal.drafts (
 id text PRIMARY KEY CHECK(id ~ '^[a-f0-9]{32}$'),
 type text NOT NULL REFERENCES jsb_legal.document_types(type),
 body text NOT NULL CHECK(length(btrim(body))>0 AND octet_length(body)<=262144),
 hash text NOT NULL CHECK(hash ~ '^[a-f0-9]{64}$'),
 created_at bigint NOT NULL CHECK(created_at>=0),
 created_by text NOT NULL REFERENCES jsb_auth.accounts(id) ON DELETE RESTRICT,
 UNIQUE(id,type,hash)
);
CREATE TABLE jsb_legal.published (
 type text NOT NULL REFERENCES jsb_legal.document_types(type),
 version integer NOT NULL CHECK(version>0),
 draft_id text NOT NULL UNIQUE,
 hash text NOT NULL CHECK(hash ~ '^[a-f0-9]{64}$'),
 published_at bigint NOT NULL CHECK(published_at>=0),
 effective_at bigint NOT NULL CHECK(effective_at>=published_at),
 published_by text NOT NULL REFERENCES jsb_auth.accounts(id) ON DELETE RESTRICT,
 PRIMARY KEY(type,version),
 UNIQUE(type,version,hash),
 UNIQUE(type,effective_at),
 FOREIGN KEY(draft_id,type,hash) REFERENCES jsb_legal.drafts(id,type,hash) ON DELETE RESTRICT
);
CREATE INDEX published_effective ON jsb_legal.published(type,effective_at DESC);
CREATE TABLE jsb_legal.acceptances (
 account_id text NOT NULL REFERENCES jsb_auth.accounts(id) ON DELETE RESTRICT,
 type text NOT NULL,
 version integer NOT NULL,
 hash text NOT NULL,
 kind text NOT NULL CHECK((type='cgu' AND kind='acceptance') OR (type='privacy' AND kind='acknowledgement')),
 recorded_at bigint NOT NULL CHECK(recorded_at>=0),
 PRIMARY KEY(account_id,type,version),
 FOREIGN KEY(type,version,hash) REFERENCES jsb_legal.published(type,version,hash) ON DELETE RESTRICT
);

-- Immutable journal. A separate, reviewed retention/anonymization migration is
-- required before production. Do not use ordinary application writes to erase history.
CREATE FUNCTION jsb_legal.reject_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 RAISE EXCEPTION 'Immutable legal record' USING ERRCODE='55000';
END;
$$;
CREATE TRIGGER drafts_immutable BEFORE UPDATE OR DELETE ON jsb_legal.drafts
FOR EACH ROW EXECUTE FUNCTION jsb_legal.reject_mutation();
CREATE TRIGGER published_immutable BEFORE UPDATE OR DELETE ON jsb_legal.published
FOR EACH ROW EXECUTE FUNCTION jsb_legal.reject_mutation();
CREATE TRIGGER acceptances_immutable BEFORE UPDATE OR DELETE ON jsb_legal.acceptances
FOR EACH ROW EXECUTE FUNCTION jsb_legal.reject_mutation();

-- Adapters must lock the document_types row for the relevant type during
-- publication and acceptance, and lock/recheck the account in a consistent
-- order. Check current effective version, exact hash and role in transaction.
-- Schema alone does not implement authorization, current-version checks,
-- commercial activation or safe deletion/retention.
REVOKE ALL ON ALL TABLES IN SCHEMA jsb_legal FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA jsb_legal FROM PUBLIC;
COMMIT;
