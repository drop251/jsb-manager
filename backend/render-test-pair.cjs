'use strict';
const {createHash,randomBytes}=require('node:crypto');
const {normalizeEmail}=require('./login-service.cjs');
const {createMfaVault}=require('./mfa-vault.cjs');
function canonical(v,n){if(typeof v!=='string'||!(/^[A-Za-z0-9_-]+$/).test(v))throw Error('Amorçage invalide');const b=Buffer.from(v,'base64url');if(b.length!==n||b.toString('base64url')!==v)throw Error('Amorçage invalide');return b;}
function validateHash(v){if(typeof v!=='string')throw Error('Amorçage invalide');const [prefix,salt,key,...extra]=v.split('$');if(prefix!=='scrypt-v1'||extra.length)throw Error('Amorçage invalide');canonical(salt,16);canonical(key,32);return v;}
// Explicit, operator-prepared, test-only initialization at startup. No HTTP
// endpoint, no default credentials, no modifications to pre-existing accounts.
async function initializeTestPair({pool,mfaKeys,bundle}){
 if(typeof bundle!=='string'||bundle.length>4096)throw Error('Amorçage invalide');
 const input=JSON.parse(bundle);
 if(input?.schema!=='JSB-PREPROD-PAIR-1'||input.attestation!=='TEST_EMAILS_CONTROLLED')throw Error('Amorçage invalide');
 const adminEmail=normalizeEmail(input.adminEmail),coachEmail=normalizeEmail(input.coachEmail);
 if(!adminEmail||!coachEmail||adminEmail===coachEmail)throw Error('Deux identités distinctes requises');
 const adminHash=validateHash(input.adminHash),coachHash=validateHash(input.coachHash);
 if(adminHash===coachHash)throw Error('Identifiants indépendants requis');
 const secret=canonical(input.totpSecret,20);
 const fingerprint=createHash('sha256').update(bundle).digest('hex');
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  if((await client.query('SELECT current_database() AS name')).rows[0]?.name!=='jsb_preprod')throw Error('Base dédiée requise');
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended('jsb-preprod-first-admin-v1',0))");
  await client.query('LOCK TABLE jsb_auth.accounts IN SHARE ROW EXCLUSIVE MODE');
  await client.query('CREATE TABLE IF NOT EXISTS jsb_deploy.test_pair_receipt (singleton boolean PRIMARY KEY CHECK(singleton), fingerprint text NOT NULL)');
  const previous=(await client.query('SELECT fingerprint FROM jsb_deploy.test_pair_receipt')).rows[0];
  if(previous){
   if(previous.fingerprint!==fingerprint)throw Error('Amorçage déjà consommé');
   await client.query('COMMIT');return 'already-consumed';
  }
  if((await client.query('SELECT 1 FROM jsb_auth.accounts LIMIT 1')).rowCount)throw Error('Base de comptes non vide');
  const adminId=randomBytes(16).toString('hex'),coachId=randomBytes(16).toString('hex'),factorVersion=randomBytes(16).toString('hex');
  const envelope=await createMfaVault(mfaKeys).seal({accountId:adminId,factorVersion,secret});
  const now=Number((await client.query("SELECT floor(extract(epoch FROM clock_timestamp())*1000)::bigint AS ms")).rows[0].ms);
  for(const [id,email,hash,role] of [[adminId,adminEmail,adminHash,'admin'],[coachId,coachEmail,coachHash,'coach']]){
   await client.query("INSERT INTO jsb_auth.accounts(id,email,password_hash,role,status,email_verified,created_at) VALUES ($1,$2,$3,$4,'active',true,$5)",[id,email,hash,role,now]);
  }
  // The operator owns the TOTP seed. First login must demonstrate possession.
  await client.query('INSERT INTO jsb_auth.mfa_factors(account_id,factor_version,encrypted_secret,enabled,last_step) VALUES ($1,$2,$3,true,-1)',[adminId,factorVersion,envelope]);
  await client.query('INSERT INTO jsb_deploy.test_pair_receipt(singleton,fingerprint) VALUES (true,$1)',[fingerprint]);
  await client.query('COMMIT');return 'created';
 }catch(e){try{await client.query('ROLLBACK');}catch{}throw e;}finally{secret.fill(0);client.release();}
}
module.exports={initializeTestPair};
