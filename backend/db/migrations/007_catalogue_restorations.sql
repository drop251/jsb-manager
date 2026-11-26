-- Track each change of active release, including a return to a previous version.
BEGIN;
ALTER TABLE jsb_catalogue.current_release ADD COLUMN generation bigint NOT NULL DEFAULT 1 CHECK (generation>0);
CREATE TABLE jsb_catalogue.restorations (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 discipline text NOT NULL,
 previous_version text NOT NULL,
 restored_version text NOT NULL,
 generation bigint NOT NULL CHECK (generation>1),
 actor_id text NOT NULL CHECK (actor_id ~ '^[a-f0-9]{32}$'),
 restored_at bigint NOT NULL CHECK (restored_at>=0),
 reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 500),
 UNIQUE(discipline,generation),
 FOREIGN KEY(discipline,previous_version) REFERENCES jsb_catalogue.releases(discipline,version),
 FOREIGN KEY(discipline,restored_version) REFERENCES jsb_catalogue.publications(discipline,version),
 CHECK (previous_version<>restored_version)
);
REVOKE ALL ON jsb_catalogue.restorations FROM PUBLIC;
COMMIT;
