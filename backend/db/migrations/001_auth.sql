-- JSB Manager V36. Initial PostgreSQL migration; apply only to a new server DB.
-- No seed accounts, real credentials, existing PWA migration or client grants.
BEGIN;
CREATE SCHEMA jsb_auth;
REVOKE ALL ON SCHEMA jsb_auth FROM PUBLIC;

CREATE TABLE jsb_auth.accounts (
 id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{32}$'),
 email text NOT NULL UNIQUE CHECK (email = lower(btrim(email)) AND length(email) BETWEEN 3 AND 254),
 password_hash text NOT NULL CHECK (length(password_hash) BETWEEN 1 AND 100),
 role text NOT NULL CHECK (role IN ('admin','coach','individual')),
 status text NOT NULL CHECK (status IN ('pending','active','suspended','deleted')),
 email_verified boolean NOT NULL DEFAULT false,
 credential_version bigint NOT NULL DEFAULT 1 CHECK (credential_version > 0),
 created_at bigint NOT NULL CHECK (created_at >= 0),
 CHECK (status <> 'active' OR email_verified),
 CHECK (status <> 'pending' OR NOT email_verified)
);

CREATE TABLE jsb_auth.sessions (
 hash text PRIMARY KEY CHECK (hash ~ '^[a-f0-9]{64}$'),
 account_id text NOT NULL REFERENCES jsb_auth.accounts(id) ON DELETE CASCADE,
 role_at_issue text NOT NULL CHECK (role_at_issue IN ('admin','coach','individual')),
 credential_version bigint NOT NULL CHECK (credential_version > 0),
 issued_at bigint NOT NULL CHECK (issued_at >= 0),
 expires_at bigint NOT NULL CHECK (expires_at > issued_at)
);
CREATE INDEX sessions_account ON jsb_auth.sessions(account_id);
CREATE INDEX sessions_expiry ON jsb_auth.sessions(expires_at);

CREATE TABLE jsb_auth.action_tokens (
 purpose text NOT NULL CHECK (purpose IN ('email-verification','password-reset')),
 hash text NOT NULL CHECK (hash ~ '^[a-f0-9]{64}$'),
 account_id text NOT NULL REFERENCES jsb_auth.accounts(id) ON DELETE CASCADE,
 issued_at bigint NOT NULL CHECK (issued_at >= 0),
 expires_at bigint NOT NULL CHECK (expires_at > issued_at),
 PRIMARY KEY (purpose,hash),
 UNIQUE (account_id,purpose)
);
CREATE INDEX action_tokens_expiry ON jsb_auth.action_tokens(expires_at);

CREATE TABLE jsb_auth.mfa_factors (
 account_id text PRIMARY KEY REFERENCES jsb_auth.accounts(id) ON DELETE CASCADE,
 factor_version text NOT NULL CHECK (length(factor_version) BETWEEN 1 AND 256),
 encrypted_secret jsonb NOT NULL CHECK (jsonb_typeof(encrypted_secret) = 'object'),
 enabled boolean NOT NULL DEFAULT false,
 last_step bigint NOT NULL DEFAULT -1 CHECK (last_step >= -1),
 UNIQUE(account_id,factor_version)
);
CREATE TABLE jsb_auth.recovery_codes (
 account_id text NOT NULL,
 factor_version text NOT NULL,
 hash text NOT NULL CHECK (hash ~ '^[a-f0-9]{64}$'),
 PRIMARY KEY(account_id,factor_version,hash),
 FOREIGN KEY(account_id,factor_version) REFERENCES jsb_auth.mfa_factors(account_id,factor_version) ON DELETE CASCADE
);

CREATE TABLE jsb_auth.quota_events (
 bucket text NOT NULL CHECK (bucket ~ '^[a-f0-9]{64}$'),
 event_id bigint GENERATED ALWAYS AS IDENTITY,
 occurred_at bigint NOT NULL CHECK (occurred_at >= 0),
 PRIMARY KEY(bucket,event_id)
);
CREATE INDEX quota_events_window ON jsb_auth.quota_events(bucket,occurred_at);
CREATE INDEX quota_events_expiry ON jsb_auth.quota_events(occurred_at);

CREATE TABLE jsb_auth.delivery_outbox (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 account_id text NOT NULL REFERENCES jsb_auth.accounts(id) ON DELETE CASCADE,
 purpose text NOT NULL CHECK (purpose IN ('email-verification','password-reset')),
 encrypted_payload bytea NOT NULL CHECK (octet_length(encrypted_payload)>0),
 created_at bigint NOT NULL CHECK (created_at>=0),
 expires_at bigint NOT NULL CHECK (expires_at>created_at)
);
CREATE INDEX delivery_outbox_expiry ON jsb_auth.delivery_outbox(expires_at);

REVOKE ALL ON ALL TABLES IN SCHEMA jsb_auth FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA jsb_auth FROM PUBLIC;
COMMIT;
