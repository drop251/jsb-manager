-- Reference catalogues are independent from private training data.
-- No seed content. Publication requires a separately validated import.
BEGIN;
CREATE SCHEMA jsb_catalogue;
REVOKE ALL ON SCHEMA jsb_catalogue FROM PUBLIC;
CREATE TABLE jsb_catalogue.releases (
 discipline text NOT NULL CHECK (discipline IN ('judo','taiso')),
 version text NOT NULL CHECK (version ~ '^[A-Za-z0-9_.-]{1,80}$'),
 source_hash text NOT NULL CHECK (source_hash ~ '^[a-f0-9]{64}$'),
 published_at bigint NOT NULL CHECK (published_at>=0),
 PRIMARY KEY(discipline,version)
);
CREATE TABLE jsb_catalogue.exercises (
 discipline text NOT NULL,
 version text NOT NULL,
 reference text NOT NULL CHECK (length(reference) BETWEEN 1 AND 80),
 name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 250),
 family text NOT NULL CHECK (length(btrim(family)) BETWEEN 1 AND 120),
 PRIMARY KEY(discipline,version,reference),
 FOREIGN KEY(discipline,version) REFERENCES jsb_catalogue.releases(discipline,version)
);
CREATE TABLE jsb_catalogue.current_release (
 discipline text PRIMARY KEY CHECK (discipline IN ('judo','taiso')),
 version text NOT NULL,
 FOREIGN KEY(discipline,version) REFERENCES jsb_catalogue.releases(discipline,version)
);
REVOKE ALL ON ALL TABLES IN SCHEMA jsb_catalogue FROM PUBLIC;
COMMIT;
