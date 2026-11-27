'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomBytes}=require('node:crypto');
const {Pool}=require('pg');
const {createLegalStore,digest}=require('../legal-store.cjs');
test('Documents juridiques : droits, brouillon immuable, version effective, preuve distincte et idempotence',async()=>{
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
  const store=createLegalStore(adapter),coach=owners[0],individual=owners[1],admin=owners[2];
  const draftBody={expectedAccount:admin.id,type:'cgu',body:'Conditions fictives — recette uniquement.'};
  assert.equal((await store.execute(coach,sessions[0],'draft',{...draftBody,expectedAccount:coach.id})).status,403);
  assert.equal((await store.execute(admin,sessions[0],'draft',draftBody)).status,401);
  assert.equal((await store.execute(admin,sessions[2],'draft',{...draftBody,expectedAccount:coach.id})).status,409);
  const drafted=await store.execute(admin,sessions[2],'draft',draftBody);
  assert.equal(drafted.status,200);assert.equal(drafted.draft.hash,digest(draftBody.body));
  const history=await store.execute(admin,sessions[2],'history',{expectedAccount:admin.id,type:'cgu'});
  assert.equal(history.publicationEnabled,false);assert.equal(history.drafts[0].body,draftBody.body);
  assert.equal((await store.execute(coach,sessions[0],'history',{expectedAccount:coach.id,type:'cgu'})).status,403);
  assert.deepEqual((await store.documents()).documents,[]);
  const record={expectedAccount:coach.id,type:'cgu',version:1,hash:drafted.draft.hash,kind:'acceptance',confirmed:true};
  assert.equal((await store.execute(coach,sessions[0],'record',record)).status,409);
  // Only test fixtures are published directly inside the rollback transaction.
  // The actual application deliberately exposes no publication route.
  await conn.query('INSERT INTO jsb_legal.published(type,version,draft_id,hash,published_at,effective_at,published_by) VALUES($1,1,$2,$3,$4,$4,$5)',['cgu',drafted.draft.id,drafted.draft.hash,now,admin.id]);
  assert.equal((await store.documents()).documents[0].body,draftBody.body);
  assert.equal((await store.execute(admin,sessions[2],'record',{...record,expectedAccount:admin.id})).status,403);
  assert.equal((await store.execute(coach,sessions[0],'record',{...record,confirmed:false})).status,400);
  assert.equal((await store.execute(coach,sessions[0],'record',{...record,kind:'acknowledgement'})).status,400);
  assert.equal((await store.execute(coach,sessions[0],'record',{...record,hash:hash()})).status,409);
  const accepted=await store.execute(coach,sessions[0],'record',record);assert.equal(accepted.record.kind,'acceptance');
  assert.deepEqual((await store.execute(coach,sessions[0],'record',record)).record,accepted.record);
  assert.equal((await store.documents(coach)).documents[0].kind,'acceptance');
  assert.equal((await store.documents(individual)).documents[0].kind,null);
  assert.equal((await store.documents()).documents[0].recordedAt,null);
  const privacy=await store.execute(admin,sessions[2],'draft',{...draftBody,type:'privacy',body:'Politique fictive.'});
  await conn.query('INSERT INTO jsb_legal.published(type,version,draft_id,hash,published_at,effective_at,published_by) VALUES($1,1,$2,$3,$4,$4,$5)',['privacy',privacy.draft.id,privacy.draft.hash,now,admin.id]);
  const ack={...record,type:'privacy',hash:privacy.draft.hash,kind:'acknowledgement'};
  assert.equal((await store.execute(coach,sessions[0],'record',{...ack,kind:'acceptance'})).status,400);
  assert.equal((await store.execute(coach,sessions[0],'record',ack)).record.kind,'acknowledgement');
  const next=await store.execute(admin,sessions[2],'draft',{...draftBody,body:'Nouvelle version fictive.'});
  await conn.query('INSERT INTO jsb_legal.published(type,version,draft_id,hash,published_at,effective_at,published_by) VALUES($1,2,$2,$3,$4,$4,$5)',['cgu',next.draft.id,next.draft.hash,now+1,admin.id]);
  assert.equal((await store.execute(coach,sessions[0],'record',record)).status,409);
  const effective=(await store.documents(coach)).documents.find(d=>d.type==='cgu');assert.equal(effective.version,2);assert.equal(effective.recordedAt,null);
  const future=await store.execute(admin,sessions[2],'draft',{...draftBody,body:'Future version fictive.'});
  await conn.query('INSERT INTO jsb_legal.published(type,version,draft_id,hash,published_at,effective_at,published_by) VALUES($1,3,$2,$3,$4,$5,$6)',['cgu',future.draft.id,future.draft.hash,now,now+86400000,admin.id]);
  assert.equal((await store.documents(coach)).documents.find(d=>d.type==='cgu').version,2);
  await conn.query('DELETE FROM jsb_auth.sessions WHERE hash=$1',[sessions[0]]);
  assert.equal((await store.execute(coach,sessions[0],'record',{...record,version:2,hash:next.draft.hash})).status,401);
 }finally{try{if(started)await conn.query('ROLLBACK');}finally{conn.release();await pool.end();}}
});
