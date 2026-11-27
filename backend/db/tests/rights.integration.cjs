'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomBytes}=require('node:crypto');
const {Pool}=require('pg');
const {createRightsStore}=require('../rights-store.cjs');
test('RGPD : dépôt idempotent, séparation des comptes, transitions et contrôle de révision',async()=>{
 assert.equal(process.env.PGDATABASE,'jsb_ci');
 const pool=new Pool({max:1}),conn=await pool.connect();
 const id=()=>randomBytes(16).toString('hex'),hash=()=>randomBytes(32).toString('hex');
 const owners=['coach','individual','admin'].map(role=>({id:id(),role,authenticated:true,status:'active'})),sessions=owners.map(hash);
 let started=false;
 try{
  assert.equal((await conn.query('SELECT current_database() AS name')).rows[0].name,'jsb_ci');
  await conn.query('BEGIN');started=true;
  const now=Date.now();
  for(let i=0;i<owners.length;i++){
   const a=owners[i];await conn.query("INSERT INTO jsb_auth.accounts(id,email,password_hash,role,status,email_verified,created_at) VALUES($1,$2,'fixture-only',$3,'active',true,$4)",[a.id,a.id+'@example.test',a.role,now]);
   await conn.query('INSERT INTO jsb_auth.sessions(hash,account_id,role_at_issue,credential_version,issued_at,expires_at) VALUES($1,$2,$3,1,$4,$5)',[sessions[i],a.id,a.role,now-1000,now+600000]);
  }
  // Real SQL on one connection. Savepoints replace inner transactions so the
  // immutable journal is never modified or deleted during fixture cleanup.
  const adapter={query:(...args)=>conn.query(...args),connect:async()=>({release(){},async query(sql,params){
   if(sql==='BEGIN')return conn.query('SAVEPOINT legal_operation');
   if(sql==='COMMIT')return conn.query('RELEASE SAVEPOINT legal_operation');
   if(sql==='ROLLBACK'){await conn.query('ROLLBACK TO SAVEPOINT legal_operation');return conn.query('RELEASE SAVEPOINT legal_operation');}
   return conn.query(sql,params);
  }})};
  const store=createRightsStore(adapter),coach=owners[0],individual=owners[1],admin=owners[2];
  const submit={expectedAccount:coach.id,kind:'erasure'};
  assert.equal((await store.execute(coach,sessions[0],'rights-submit',{...submit,kind:'other'})).status,400);
  assert.equal((await store.execute(coach,sessions[0],'rights-submit',{...submit,details:'sensitive'})).status,400);
  assert.equal((await store.execute(coach,sessions[0],'rights-submit',{...submit,expectedAccount:individual.id})).status,409);
  assert.equal((await store.execute(coach,sessions[1],'rights-submit',submit)).status,401);
  assert.equal((await store.execute(admin,sessions[2],'rights-submit',{...submit,expectedAccount:admin.id})).status,403);
  const a=await store.execute(coach,sessions[0],'rights-submit',submit);
  assert.equal(a.status,200);assert.equal(a.request.status,'submitted');assert.equal(a.request.revision,1);
  assert.equal((await store.execute(coach,sessions[0],'rights-submit',submit)).request.id,a.request.id);
  const mine=await store.execute(coach,sessions[0],'rights-mine',{expectedAccount:coach.id});
  assert.equal(mine.requests.length,1);assert.equal(mine.requests[0].id,a.request.id);assert.equal('email' in mine.requests[0],false);
  assert.deepEqual((await store.execute(individual,sessions[1],'rights-mine',{expectedAccount:individual.id})).requests,[]);
  assert.equal((await store.execute(coach,sessions[0],'rights-queue',{expectedAccount:coach.id})).status,403);
  const queue=await store.execute(admin,sessions[2],'rights-queue',{expectedAccount:admin.id});
  assert.equal(queue.requests.length,1);assert.equal(queue.requests[0].accountId,coach.id);
  const update={expectedAccount:admin.id,id:a.request.id,revision:1,status:'in_progress',confirmed:true};
  assert.equal((await store.execute(coach,sessions[0],'rights-update',{...update,expectedAccount:coach.id})).status,403);
  assert.equal((await store.execute(admin,sessions[2],'rights-update',{...update,confirmed:false})).status,400);
  assert.equal((await store.execute(admin,sessions[2],'rights-update',{...update,status:'responded'})).status,409);
  const b=await store.execute(admin,sessions[2],'rights-update',update);
  assert.equal(b.request.status,'in_progress');assert.equal(b.request.revision,2);
  assert.equal((await store.execute(admin,sessions[2],'rights-update',update)).status,409);
  const d=await store.execute(admin,sessions[2],'rights-update',{...update,revision:2,status:'responded'});
  assert.equal(d.request.status,'responded');assert.equal(d.request.revision,3);
  assert.deepEqual((await store.execute(admin,sessions[2],'rights-queue',{expectedAccount:admin.id})).requests,[]);
  assert.equal((await store.execute(coach,sessions[0],'rights-mine',{expectedAccount:coach.id})).requests[0].status,'responded');
  // A response does not itself erase the account, session or business records.
  assert.equal((await conn.query('SELECT status FROM jsb_auth.accounts WHERE id=$1',[coach.id])).rows[0].status,'active');
  assert.equal((await conn.query('SELECT count(*)::int AS n FROM jsb_auth.sessions WHERE account_id=$1',[coach.id])).rows[0].n,1);
  const again=await store.execute(coach,sessions[0],'rights-submit',submit);assert.notEqual(again.request.id,a.request.id);
  await conn.query('DELETE FROM jsb_auth.sessions WHERE hash=$1',[sessions[0]]);
  assert.equal((await store.execute(coach,sessions[0],'rights-mine',{expectedAccount:coach.id})).status,401);
 }finally{if(started)await conn.query('ROLLBACK');conn.release();await pool.end();}
});
