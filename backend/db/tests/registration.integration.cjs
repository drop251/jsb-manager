'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {Pool}=require('pg');
const {createRegistrationStore}=require('../registration-store.cjs');
const {createDeliveryVault}=require('../../delivery-vault.cjs');
const {createRegistrationService}=require('../../registration-service.cjs');
const {createEmailVerificationService}=require('../../email-verification.cjs');
const {createVerificationResend}=require('../../verification-resend.cjs');
const {createAuthStore}=require('../auth-store.cjs');
const {createSessions}=require('../../sessions.cjs');
const {createLoginService}=require('../../login-service.cjs');
const PASSWORD='Phrase de passe inscription PostgreSQL !';
const email='registration-integration@example.test';
const limiter={reserve:async()=>true};
test('PostgreSQL : inscription, livraison chiffrée, rotation et activation unique',async()=>{
 assert.equal(process.env.PGDATABASE,'jsb_ci');
 const pool=new Pool({max:6});
 let safe=false;
 try{
  assert.equal((await pool.query('SELECT current_database() AS name')).rows[0].name,'jsb_ci');safe=true;
  const vault=createDeliveryVault({activeKeyId:'ci',loadKey:async()=>Buffer.alloc(32,4)});
  const store=createRegistrationStore({pool,encryptDelivery:vault.encryptDelivery});
  const register=createRegistrationService({limiter,createPendingAccount:store.createPendingAccount});
  const verify=createEmailVerificationService({limiter,consumeAndActivate:store.consumeAndActivate});
  const resend=createVerificationResend({limiter,replacePendingVerification:store.replacePendingVerification});
  const auth=createAuthStore(pool);
  const sessions=createSessions({store:auth.store,loadAccount:auth.loadAccount});
  const login=createLoginService({limiter,sessions,findAccountByEmail:auth.findAccountByEmail,verifyMfa:async()=>false});
  const req={email,password:PASSWORD,role:'coach'};
  assert.equal((await register.register({...req,role:'admin'},'ci')).status,400);
  const duplicates=await Promise.all([register.register(req,'ci'),register.register(req,'ci')]);
  assert.ok(duplicates.every(r=>r.status===202));
  const a=await auth.findAccountByEmail(email);
  assert.equal(a.status,'pending');assert.equal(a.emailVerified,false);assert.equal(a.role,'coach');
  assert.notEqual(a.passwordHash,PASSWORD);
  assert.equal((await login.login({...req,sourceId:'ci'})).status,401);
  async function message(){
   const rows=(await pool.query('SELECT account_id,purpose,encrypted_payload FROM jsb_auth.delivery_outbox WHERE account_id=$1',[a.id])).rows;
   assert.equal(rows.length,1);
   const row=rows[0],p=await vault.decryptDelivery({accountId:row.account_id,purpose:row.purpose,encryptedPayload:row.encrypted_payload});
   assert.equal(p.email,email);assert.equal(row.encrypted_payload.includes(p.token),false);
   const tokens=(await pool.query('SELECT hash FROM jsb_auth.action_tokens WHERE account_id=$1',[a.id])).rows;
   assert.equal(tokens.length,1);assert.equal(tokens[0].hash,createHash('sha256').update(p.token).digest('hex'));
   return p;
  }
  const first=await message();
  assert.equal((await resend.resend(email,'ci')).status,202);
  const second=await message();assert.notEqual(first.token,second.token);
  assert.equal((await verify.verify(first.token,'ci')).status,400);
  const results=await Promise.all(Array.from({length:4},()=>verify.verify(second.token,'ci')));
  assert.equal(results.filter(r=>r.status===200).length,1);
  assert.equal(results.filter(r=>r.status===400).length,3);
  assert.equal((await auth.findAccountByEmail(email)).status,'active');
  assert.equal((await login.login({...req,sourceId:'ci'})).status,200);
  assert.equal((await resend.resend(email,'ci')).status,202);
  for(const table of ['action_tokens','delivery_outbox']){
   const r=await pool.query('SELECT count(*) AS n FROM jsb_auth.'+table+' WHERE account_id=$1',[a.id]);
   assert.equal(Number(r.rows[0].n),0);
  }
  const failing=createRegistrationStore({pool,encryptDelivery:async()=>{throw Error('test failure');}});
  const broken=createRegistrationService({limiter,createPendingAccount:failing.createPendingAccount});
  assert.equal((await broken.register({...req,email:'rollback-registration@example.test',role:'individual'},'ci')).status,503);
  assert.equal(await auth.findAccountByEmail('rollback-registration@example.test'),null);
 }finally{
  try{if(safe)await pool.query('DELETE FROM jsb_auth.accounts WHERE email=ANY($1::text[])',[[email,'rollback-registration@example.test']]);}finally{await pool.end();}
 }
});
