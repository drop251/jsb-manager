-- Journal de publication distinct des données utilisateur.
BEGIN;
CREATE TABLE jsb_catalogue.publications (
 discipline text NOT NULL,
 version text NOT NULL,
 previous_version text,
 actor_id text NOT NULL CHECK (actor_id ~ '^[a-f0-9]{32}$'),
 published_at bigint NOT NULL CHECK (published_at>=0),
 exercise_count integer NOT NULL CHECK (exercise_count BETWEEN 1 AND 2000),
 PRIMARY KEY(discipline,version),
 FOREIGN KEY(discipline,version) REFERENCES jsb_catalogue.releases(discipline,version),
 FOREIGN KEY(discipline,previous_version) REFERENCES jsb_catalogue.releases(discipline,version),
 CHECK (previous_version IS NULL OR previous_version<>version)
);
REVOKE ALL ON jsb_catalogue.publications FROM PUBLIC;
COMMIT;
