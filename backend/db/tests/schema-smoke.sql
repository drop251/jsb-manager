-- Transactional integration smoke tests. Only synthetic fixtures; rollback all.
BEGIN;
INSERT INTO jsb_auth.accounts(id,email,password_hash,role,status,email_verified,created_at)
VALUES ('11111111111111111111111111111111','admin@example.test','test-only','admin','active',true,1000),
('22222222222222222222222222222222','coach@example.test','test-only','coach','active',true,1000);
DO $$
BEGIN
 BEGIN
  INSERT INTO jsb_auth.accounts(id,email,password_hash,role,status,email_verified,created_at)
  VALUES ('33333333333333333333333333333333','coach@example.test','test-only','individual','active',true,1000);
  RAISE EXCEPTION 'Duplicate email accepted';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
 BEGIN
  INSERT INTO jsb_auth.accounts(id,email,password_hash,role,status,email_verified,created_at)
  VALUES ('33333333333333333333333333333333','pending@example.test','test-only','individual','active',false,1000);
  RAISE EXCEPTION 'Unverified active account accepted';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
END $$;
INSERT INTO jsb_auth.sessions(hash,account_id,role_at_issue,credential_version,issued_at,expires_at)
VALUES (repeat('a',64),'22222222222222222222222222222222','coach',1,1000,2000);
INSERT INTO jsb_legal.drafts(id,type,body,hash,created_at,created_by)
VALUES ('44444444444444444444444444444444','cgu','Synthetic test document',repeat('b',64),1000,'11111111111111111111111111111111');
INSERT INTO jsb_legal.published(type,version,draft_id,hash,published_at,effective_at,published_by)
VALUES ('cgu',1,'44444444444444444444444444444444',repeat('b',64),1000,1100,'11111111111111111111111111111111');
INSERT INTO jsb_legal.acceptances(account_id,type,version,hash,kind,recorded_at)
VALUES ('22222222222222222222222222222222','cgu',1,repeat('b',64),'acceptance',1200);
DO $$
BEGIN
 BEGIN
  UPDATE jsb_legal.published SET effective_at=1300 WHERE type='cgu' AND version=1;
  RAISE EXCEPTION 'Published version mutable';
 EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
 END;
 BEGIN
  DELETE FROM jsb_legal.acceptances;
  RAISE EXCEPTION 'Acceptance mutable';
 EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
 END;
 BEGIN
  INSERT INTO jsb_legal.acceptances(account_id,type,version,hash,kind,recorded_at)
  VALUES ('11111111111111111111111111111111','cgu',1,repeat('c',64),'acceptance',1200);
  RAISE EXCEPTION 'Wrong hash accepted';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;
 BEGIN
  INSERT INTO jsb_legal.acceptances(account_id,type,version,hash,kind,recorded_at)
  VALUES ('22222222222222222222222222222222','cgu',1,repeat('b',64),'acceptance',1300);
  RAISE EXCEPTION 'Duplicate acceptance accepted';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
END $$;
ROLLBACK;
