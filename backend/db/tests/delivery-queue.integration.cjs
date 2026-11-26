'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Pool}=require('pg');
const {randomBytes}=require('node:crypto');
const {createDeliveryStore}=require('../delivery-store.cjs');
const {createDeliveryWorker}=require('../../delivery-worker.cjs');
const {createDeliveryVault}=require('../../delivery-vault.cjs');
const {createHash}=require('node:crypto');
test('File de livraison PostgreSQL : réservation concurrente, reprise et expiration',async()=>{
 assert.equal(process.env.PGDATABASE,'jsb_ci');
 const pool=new Pool({max:8});
 const store=createDeliveryStore(pool),id=randomBytes(16).toString('hex');
 let safe=false;
 try{
  assert.equal((await pool.query('SELECT current_database() AS name')).rows[0].name,'jsb_ci');safe=true;
  const email='queue-fixture@example.test',purpose='email-verification',now=Date.now(),expiry=now+600000;
  // Opaque database fixture only: no usable authentication secret or real email.
  const digest=randomBytes(32).toString('hex');
  await pool.query("INSERT INTO jsb_auth.accounts(id,email,password_hash,role,status,email_verified,created_at) VALUES ($1,$2,'fixture-only','coach','pending',false,$3)",[id,email,now]);
  await pool.query('INSERT INTO jsb_auth.action_tokens(purpose,hash,account_id,issued_at,expires_at) VALUES ($1,$2,$3,$4,$5)',[purpose,digest,id,now,expiry]);
  await pool.query('INSERT INTO jsb_auth.delivery_outbox(account_id,purpose,encrypted_payload,created_at,expires_at) VALUES ($1,$2,$3,$4,$5)',[id,purpose,Buffer.from('opaque-fixture'),now,expiry]);
  const claims=(await Promise.all(Array.from({length:12},()=>store.claim()))).filter(Boolean);
  assert.equal(claims.length,1);
  const first=claims[0];assert.equal(first.accountId,id);assert.equal(first.attempts,1);
  assert.equal(await store.current(first,digest,email),true);
  assert.equal(await store.current(first,'0'.repeat(64),email),false);
  assert.equal(await store.current(first,digest,'other@example.test'),false);
  assert.equal(await store.retry(first),true);
  assert.equal(await store.claim(),null);
  await pool.query('UPDATE jsb_auth.delivery_outbox SET next_attempt_at=0 WHERE account_id=$1',[id]);
  const second=await store.claim();assert.equal(second.attempts,2);assert.notEqual(second.leaseId,first.leaseId);
  assert.equal(await store.finish(first),false);
  assert.equal(await store.current(first,digest,email),false);
  await pool.query('UPDATE jsb_auth.delivery_outbox SET lease_until=0 WHERE account_id=$1',[id]);
  const third=await store.claim();assert.equal(third.attempts,3);
  assert.equal(await store.finish(second),false);
  await pool.query("UPDATE jsb_auth.accounts SET status='suspended' WHERE id=$1",[id]);
  assert.equal(await store.current(third,digest,email),false);
  assert.equal(await store.finish(third),true);
  assert.equal(await store.claim(),null);
  await pool.query('INSERT INTO jsb_auth.delivery_outbox(account_id,purpose,encrypted_payload,created_at,expires_at) VALUES ($1,$2,$3,$4,$5)',[id,purpose,Buffer.from('expired-fixture'),now-2000,now-1000]);
  assert.equal(await store.claim(),null);
  assert.equal(await store.purgeExpired(),1);
  assert.equal((await pool.query('SELECT count(*) AS n FROM jsb_auth.delivery_outbox WHERE account_id=$1',[id])).rows[0].n,'0');
 }finally{try{if(safe)await pool.query('DELETE FROM jsb_auth.accounts WHERE id=$1',[id]);}finally{await pool.end();}}
});

test('File de livraison : traitement intégral avec transport simulé',async()=>{
 assert.equal(process.env.PGDATABASE,'jsb_ci');
 const pool=new Pool({max:4}),id=randomBytes(16).toString('hex');
 let safe=false;
 try{
  assert.equal((await pool.query('SELECT current_database() AS name')).rows[0].name,'jsb_ci');safe=true;
  const email='worker-fixture@example.test',purpose='email-verification',now=Date.now(),expiresAt=now+600000;
  const token=randomBytes(32).toString('base64url');
  const vault=createDeliveryVault({activeKeyId:'fixture',loadKey:async()=>Buffer.alloc(32,71)});
  const encrypted=await vault.encryptDelivery({accountId:id,purpose,email,token,expiresAt});
  await pool.query("INSERT INTO jsb_auth.accounts(id,email,password_hash,role,status,email_verified,created_at) VALUES ($1,$2,'fixture-only','coach','pending',false,$3)",[id,email,now]);
  await pool.query('INSERT INTO jsb_auth.action_tokens(purpose,hash,account_id,issued_at,expires_at) VALUES ($1,$2,$3,$4,$5)',[purpose,createHash('sha256').update(token).digest('hex'),id,now,expiresAt]);
  await pool.query('INSERT INTO jsb_auth.delivery_outbox(account_id,purpose,encrypted_payload,created_at,expires_at) VALUES ($1,$2,$3,$4,$5)',[id,purpose,encrypted,now,expiresAt]);
  const store=createDeliveryStore(pool);let allow=false,accept=false,calls=0,previousId;
  const worker=createDeliveryWorker({store,vault,allowRecipient:async()=>allow,sendMail:async message=>{
   calls++;assert.equal(message.to,email);assert.ok(message.text.includes(token));assert.ok(!message.text.includes('https://'));
   if(previousId)assert.equal(message.deliveryId,previousId);previousId=message.deliveryId;return accept;
  }});
  assert.equal(await worker.runOnce(),'blocked');assert.equal(calls,0);
  await pool.query('UPDATE jsb_auth.delivery_outbox SET next_attempt_at=0 WHERE account_id=$1',[id]);
  allow=true;assert.equal(await worker.runOnce(),'retry');assert.equal(calls,1);
  await pool.query('UPDATE jsb_auth.delivery_outbox SET next_attempt_at=0 WHERE account_id=$1',[id]);
  accept=true;assert.equal(await worker.runOnce(),'sent');assert.equal(calls,2);
  assert.equal(await worker.runOnce(),'idle');
  assert.equal((await pool.query('SELECT count(*) AS n FROM jsb_auth.action_tokens WHERE account_id=$1',[id])).rows[0].n,'1');
 }finally{try{if(safe)await pool.query('DELETE FROM jsb_auth.accounts WHERE id=$1',[id]);}finally{await pool.end();}}
});
