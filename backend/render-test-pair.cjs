'use strict';
const {createHash,randomBytes}=require('node:crypto');
const {normalizeEmail}=require('./login-service.cjs');
const {createMfaVault}=require('./mfa-vault.cjs');
// Codes fixes uniquement : jamais le contenu du lot ni les messages PostgreSQL.
function bootstrapError(code){const e=new Error('Amorçage refusé');e.jsbBootstrapCode=code;return e;}
function canonical(v,n){if(typeof v!=='string'||!(/^[A-Za-z0-9_-]+$/).test(v))throw Error('Amorçage invalide');const b=Buffer.from(v,'base64url');if(b.length!==n||b.toString('base64url')!==v)throw Error('Amorçage invalide');return b;}
function validateHash(v){if(typeof v!=='string')throw Error('Amorçage invalide');const [prefix,salt,key,...extra]=v.split('$');if(prefix!=='scrypt-v1'||extra.length)throw Error('Amorçage invalide');canonical(salt,16);canonical(key,32);return v;}
// Explicit, operator-prepared, test-only initialization at startup. No HTTP
// endpoint, no default credentials, no modifications to pre-existing accounts.
async function initializeTestPair({pool,mfaKeys,bundle}){
 if(typeof bundle!=='string'||!bundle.trim()||bundle.length>4096)throw bootstrapError('BUNDLE_SIZE');
 let input;
 try{input=JSON.parse(bundle);}catch{throw bootstrapError('BUNDLE_JSON');}
 if(input?.schema!=='JSB-PREPROD-PAIR-1'||input.attestation!=='TEST_EMAILS_CONTROLLED')throw bootstrapError('BUNDLE_SCHEMA');
 const adminEmail=normalizeEmail(input.adminEmail),coachEmail=normalizeEmail(input.coachEmail);
 if(!adminEmail||!coachEmail||adminEmail===coachEmail)throw bootstrapError('BUNDLE_EMAILS');
 let adminHash,coachHash;
 try{adminHash=validateHash(input.adminHash);coachHash=validateHash(input.coachHash);}catch{throw bootstrapError('BUNDLE_PASSWORD_HASH');}
 if(adminHash===coachHash)throw bootstrapError('BUNDLE_PASSWORD_HASH');
 let secret;
 try{secret=canonical(input.totpSecret,20);}catch{throw bootstrapError('BUNDLE_TOTP');}
 const fingerprint=createHash('sha256').update(bundle).digest('hex');
 let client,stage='DB_CONNECT';
 try{
  client=await pool.connect();
  stage='DB_TRANSACTION';
  await client.query('BEGIN');
  if((await client.query('SELECT current_database() AS name')).rows[0]?.name!=='jsb_preprod')throw Error('Base dédiée requise');
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended('jsb-preprod-first-admin-v1',0))");
  stage='DB_LOCK';
  await client.query('LOCK TABLE jsb_auth.accounts IN SHARE ROW EXCLUSIVE MODE');
  stage='DB_RECEIPT';
  await client.query('CREATE TABLE IF NOT EXISTS jsb_deploy.test_pair_receipt (singleton boolean PRIMARY KEY CHECK(singleton), fingerprint text NOT NULL)');
  const previous=(await client.query('SELECT fingerprint FROM jsb_deploy.test_pair_receipt')).rows[0];
  if(previous){
   if(previous.fingerprint!==fingerprint){const e=bootstrapError('ALREADY_CONSUMED');e.message='Amorçage déjà consommé';throw e;}
   await client.query('COMMIT');return 'already-consumed';
  }
  stage='DB_ACCOUNT_CHECK';
  if((await client.query('SELECT 1 FROM jsb_auth.accounts LIMIT 1')).rowCount)throw bootstrapError('ACCOUNTS_EXIST');
  const adminId=randomBytes(16).toString('hex'),coachId=randomBytes(16).toString('hex'),factorVersion=randomBytes(16).toString('hex');
  stage='MFA_ENCRYPTION';
  const envelope=await createMfaVault(mfaKeys).seal({accountId:adminId,factorVersion,secret});
  stage='DB_INSERT_ACCOUNTS';
  const now=Number((await client.query("SELECT floor(extract(epoch FROM clock_timestamp())*1000)::bigint AS ms")).rows[0].ms);
  for(const [id,email,hash,role] of [[adminId,adminEmail,adminHash,'admin'],[coachId,coachEmail,coachHash,'coach']]){
   await client.query("INSERT INTO jsb_auth.accounts(id,email,password_hash,role,status,email_verified,created_at) VALUES ($1,$2,$3,$4,'active',true,$5)",[id,email,hash,role,now]);
  }
  // The operator owns the TOTP seed. First login must demonstrate possession.
  stage='DB_INSERT_MFA';
  await client.query('INSERT INTO jsb_auth.mfa_factors(account_id,factor_version,encrypted_secret,enabled,last_step) VALUES ($1,$2,$3,true,-1)',[adminId,factorVersion,envelope]);
  stage='DB_FINALIZE';
  await client.query('INSERT INTO jsb_deploy.test_pair_receipt(singleton,fingerprint) VALUES (true,$1)',[fingerprint]);
  await client.query('COMMIT');return 'created';
 }catch(e){try{if(client)await client.query('ROLLBACK');}catch{}throw e.jsbBootstrapCode?e:bootstrapError(stage);}finally{secret.fill(0);if(client)client.release();}
}
module.exports={initializeTestPair};
