'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomBytes}=require('node:crypto');
const {Pool}=require('pg');
const {technicalRetention}=require('../technical-retention.cjs');
test('Purge technique : simulation, expiration réelle, bail actif et conservation des comptes',async()=>{
 assert.equal(process.env.PGDATABASE,'jsb_ci');
 const pool=new Pool({max:1}),conn=await pool.connect(),id=()=>randomBytes(16).toString('hex'),hash=()=>randomBytes(32).toString('hex');
 let started=false;
 try{
  assert.equal((await conn.query('SELECT current_database() AS name')).rows[0].name,'jsb_ci');
  await conn.query('BEGIN');started=true;
  const now=Date.now(),a=id(),b=id(),s1=hash(),s2=hash(),bucket=hash();
  for(const owner of [a,b])await conn.query("INSERT INTO jsb_auth.accounts(id,email,password_hash,role,status,email_verified,created_at) VALUES($1,$2,'fixture-only','coach','active',true,$3)",[owner,owner+'@example.test',now-200000000]);
  for(const [owner,s,expires] of [[a,s1,now-1000],[b,s2,now+600000]])await conn.query("INSERT INTO jsb_auth.sessions(hash,account_id,role_at_issue,credential_version,issued_at,expires_at) VALUES($1,$2,'coach',1,$3,$4)",[s,owner,now-10000,expires]);
  for(const [owner,expires] of [[a,now-1000],[b,now+600000]])await conn.query("INSERT INTO jsb_auth.action_tokens(purpose,hash,account_id,issued_at,expires_at) VALUES('password-reset',$1,$2,$3,$4)",[hash(),owner,now-10000,expires]);
  for(const [owner,expires] of [[a,now-1000],[b,now+600000]])await conn.query("INSERT INTO jsb_auth.delivery_outbox(account_id,purpose,encrypted_payload,created_at,expires_at) VALUES($1,'password-reset',$2,$3,$4)",[owner,Buffer.from('fixture'),now-10000,expires]);
  await conn.query("INSERT INTO jsb_auth.delivery_outbox(account_id,purpose,encrypted_payload,created_at,expires_at,lease_id,lease_until) VALUES($1,'password-reset',$2,$3,$4,$5,$6)",[a,Buffer.from('fixture'),now-10000,now-1000,id(),now+600000]);
  await conn.query('INSERT INTO jsb_auth.quota_events(bucket,occurred_at) VALUES($1,$2),($1,$3)',[bucket,now-90000000,now-1000]);
  const adapter={connect:async()=>({release(){},async query(sql,params){if(sql==='BEGIN')return conn.query('SAVEPOINT retention_operation');if(sql==='COMMIT')return conn.query('RELEASE SAVEPOINT retention_operation');if(sql==='ROLLBACK'){await conn.query('ROLLBACK TO SAVEPOINT retention_operation');return conn.query('RELEASE SAVEPOINT retention_operation');}return conn.query(sql,params);}})};
  const expected={sessions:1,delivery_outbox:1,action_tokens:1,quota_events:1};
  assert.deepEqual(await technicalRetention(adapter,{expectedDatabase:'jsb_ci'}),{mode:'preview',counts:expected});
  assert.equal((await conn.query('SELECT count(*)::int AS n FROM jsb_auth.sessions')).rows[0].n,2);
  await assert.rejects(technicalRetention(adapter,{expectedDatabase:'jsb_preprod',apply:true}),/Base dédiée/);
  assert.deepEqual(await technicalRetention(adapter,{expectedDatabase:'jsb_ci',apply:true}),{mode:'applied',counts:expected});
  assert.deepEqual(await technicalRetention(adapter,{expectedDatabase:'jsb_ci'}),{mode:'preview',counts:{sessions:0,delivery_outbox:0,action_tokens:0,quota_events:0}});
  assert.equal((await conn.query('SELECT count(*)::int AS n FROM jsb_auth.accounts')).rows[0].n,2);
  assert.equal((await conn.query('SELECT hash FROM jsb_auth.sessions')).rows[0].hash,s2);
  assert.equal((await conn.query('SELECT count(*)::int AS n FROM jsb_auth.action_tokens')).rows[0].n,1);
  assert.equal((await conn.query('SELECT count(*)::int AS n FROM jsb_auth.delivery_outbox')).rows[0].n,2);
  assert.equal((await conn.query('SELECT count(*)::int AS n FROM jsb_auth.quota_events')).rows[0].n,1);
 }finally{if(started)await conn.query('ROLLBACK');conn.release();await pool.end();}
});
