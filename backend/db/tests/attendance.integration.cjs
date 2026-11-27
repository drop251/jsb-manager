'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomBytes}=require('node:crypto');
const {Pool}=require('pg');
const {createAttendanceStore}=require('../attendance-store.cjs');
const {empty,normalize,merge}=require('../../../core/attendance-sync.js');
test('Présences PostgreSQL : isolation, concurrence, conflit et relance idempotente',async()=>{
 assert.equal(process.env.PGDATABASE,'jsb_ci');
 const pool=new Pool({max:4}),id=()=>randomBytes(16).toString('hex'),hash=()=>randomBytes(32).toString('hex');
 const owners=['coach','coach','individual','admin'].map(role=>({id:id(),role,authenticated:true,status:'active'})),sessions=owners.map(hash);
 let safe=false;
 try{
  assert.equal((await pool.query('SELECT current_database() AS name')).rows[0].name,'jsb_ci');safe=true;
  const now=Date.now();
  for(let i=0;i<owners.length;i++){
   const a=owners[i];await pool.query("INSERT INTO jsb_auth.accounts(id,email,password_hash,role,status,email_verified,created_at) VALUES($1,$2,'fixture-only',$3,'active',true,$4)",[a.id,a.id+'@example.test',a.role,now]);
   await pool.query('INSERT INTO jsb_auth.sessions(hash,account_id,role_at_issue,credential_version,issued_at,expires_at) VALUES($1,$2,$3,1,$4,$5)',[sessions[i],a.id,a.role,now-1000,now+600000]);
  }
  const store=createAttendanceStore(pool),a=owners[0],b=owners[1],s=sessions[0],body={expectedAccount:a.id};
  const group=id(),slot=id(),member=id(),other=id(),date='2026-11-27';
  const base=normalize({groups:[{id:group,name:'Groupe fictif'}],members:[{id:member,name:'A fictif',groupId:group,active:true},{id:other,name:'B fictif',groupId:group,active:true}],slots:[{id:slot,groupId:group,label:'18h'}],calls:[]});
  const withMark=(memberId,status)=>normalize({...base,calls:[{date,slotId:slot,marks:[{memberId,status}]}]});
  assert.deepEqual((await store.execute(a,s,'read',body)).register,{revision:0,snapshot:empty()});
  for(const i of [2,3])assert.equal((await store.execute(owners[i],sessions[i],'read',{expectedAccount:owners[i].id})).status,403);
  assert.equal((await store.execute(a,sessions[1],'read',body)).status,401);
  assert.equal((await store.execute(a,s,'read',{expectedAccount:b.id})).status,409);
  assert.equal((await store.execute(a,s,'save',{...body,revision:0,snapshot:base})).register.revision,1);
  const local=withMark(member,'present'),remote=withMark(member,'absent');
  const results=await Promise.all([local,remote].map(snapshot=>store.execute(a,s,'save',{...body,revision:1,snapshot})));
  assert.deepEqual(results.map(x=>x.status).sort(),[200,409]);
  const winner=results.find(x=>x.ok).register,loser=results.findIndex(x=>!x.ok);
  assert.equal(winner.revision,2);assert.deepEqual(results[loser].register,winner);
  const retry=await store.execute(a,s,'save',{...body,revision:1,snapshot:winner.snapshot});assert.deepEqual(retry.register,winner);
  assert.deepEqual((await store.execute(b,sessions[1],'read',{expectedAccount:b.id})).register,{revision:0,snapshot:empty()});
  const divergence=merge(base,[local,remote][loser],winner.snapshot);assert.equal(divergence.state,'conflict');
  const chosen=merge(base,[local,remote][loser],winner.snapshot,{[divergence.conflicts[0].key]:'local'});
  const resolved=await store.execute(a,s,'save',{...body,revision:2,snapshot:chosen.snapshot});assert.equal(resolved.register.revision,3);
  assert.equal((await store.execute(a,s,'save',{...body,revision:2,snapshot:winner.snapshot})).status,409);
  await pool.query('DELETE FROM jsb_auth.sessions WHERE hash=$1',[s]);
  assert.equal((await store.execute(a,s,'read',body)).status,401);
 }finally{try{if(safe)await pool.query('DELETE FROM jsb_auth.accounts WHERE id=ANY($1::text[])',[owners.map(x=>x.id)]);}finally{await pool.end();}}
});
