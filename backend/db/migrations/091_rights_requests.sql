-- Requests for data-subject rights; no automatic deletion or disclosure.
BEGIN;
CREATE TABLE jsb_legal.rights_requests (
 id text PRIMARY KEY CHECK(id ~ '^[a-f0-9]{32}$'),
 account_id text NOT NULL REFERENCES jsb_auth.accounts(id) ON DELETE RESTRICT,
 kind text NOT NULL CHECK(kind IN ('access','rectification','erasure','restriction','objection','portability','withdrawal')),
 status text NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','in_progress','responded')),
 created_at bigint NOT NULL CHECK(created_at>=0),
 updated_at bigint NOT NULL CHECK(updated_at>=created_at),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 handled_by text REFERENCES jsb_auth.accounts(id) ON DELETE RESTRICT,
 CHECK ((status='submitted' AND handled_by IS NULL) OR (status<>'submitted' AND handled_by IS NOT NULL))
);
CREATE UNIQUE INDEX rights_open_request ON jsb_legal.rights_requests(account_id,kind) WHERE status<>'responded';
CREATE INDEX rights_queue ON jsb_legal.rights_requests(status,created_at,id);
REVOKE ALL ON jsb_legal.rights_requests FROM PUBLIC;
COMMIT;
