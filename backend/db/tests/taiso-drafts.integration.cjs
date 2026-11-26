'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomBytes}=require('node:crypto');
const {Pool}=require('pg');
const {createTaisoDraftStore}=require('../taiso-draft-store.cjs');
test('Brouillons privés : propriétaire, révision, concurrence, catalogue ancien, révocation',async()=>{
 assert.equal(process.env.PGDATABASE,'jsb_ci');
 const pool=new Pool({max:4});let safe=false;
 const id=()=>randomBytes(16).toString('hex'),hash=()=>randomBytes(32).toString('hex');
 const owners=[{id:id(),role:'coach',authenticated:true,status:'active'},{id:id(),role:'individual',authenticated:true,status:'active'}],digests=[hash(),hash()];
 const version='private-draft-fixture';
 try{
  assert.equal((await pool.query('SELECT current_database() AS name')).rows[0].name,'jsb_ci');safe=true;
  const now=Date.now();
  for(let i=0;i<owners.length;i++){
   const a=owners[i];
   await pool.query("INSERT INTO jsb_auth.accounts(id,email,password_hash,role,status,email_verified,created_at) VALUES ($1,$2,'fixture-only',$3,'active',true,$4)",[a.id,a.id+'@example.test',a.role,now]);
   await pool.query('INSERT INTO jsb_auth.sessions(hash,account_id,role_at_issue,credential_version,issued_at,expires_at) VALUES ($1,$2,$3,1,$4,$5)',[digests[i],a.id,a.role,now-1000,now+600000]);
  }
  await pool.query("INSERT INTO jsb_catalogue.releases(discipline,version,source_hash,published_at) VALUES ('taiso',$1,$2,$3)",[version,hash(),now]);
  await pool.query("INSERT INTO jsb_catalogue.current_release(discipline,version) VALUES ('taiso',$1)",[version]);
  const store=createTaisoDraftStore(pool),a=owners[0],b=owners[1],s=digests[0];
  const prepared={settings:{version,generation:'1'},draft:{discipline:'taiso',version,generation:'1',requiresCoachReview:true}};
  const request={expectedAccount:a.id,title:'Fixture'};
  assert.equal((await store.execute({...a,role:'admin'},s,'save',request,prepared)).status,403);
  assert.equal((await store.execute(a,digests[1],'save',request,prepared)).status,401);
  assert.equal((await store.execute(a,s,'save',{...request,expectedAccount:b.id},prepared)).status,409);
  const created=await store.execute(a,s,'save',request,prepared);
  assert.equal(created.status,200);assert.equal(created.saved.revision,1);
  const key=created.saved.id;
  assert.equal((await store.execute(b,digests[1],'read',{expectedAccount:b.id,id:key})).status,409);
  assert.equal((await store.execute(b,digests[1],'list',{expectedAccount:b.id})).total,0);
  assert.equal((await store.execute(a,s,'read',{expectedAccount:a.id,id:key})).draft.stale,false);
  const updates=await Promise.all(['A','B'].map(title=>store.execute(a,s,'save',{...request,title,id:key,revision:1},prepared)));
  assert.deepEqual(updates.map(x=>x.status).sort(),[200,409]);
  assert.equal((await store.execute(a,s,'list',{expectedAccount:a.id})).total,1);
  // Validation attestation must be separate, and never approve an incomplete draft.
  assert.equal((await store.execute(a,s,'validate',{expectedAccount:a.id,id:key,revision:2,confirmed:true})).status,400);
  const completed={...prepared,draft:{...prepared.draft,missing:[],organizationPending:false,phases:Array.from({length:5},(_,i)=>({exercises:[{reference:'fixture-'+i}],unallocatedMinutes:0,blocks:i===2?[{organization:{state:'budgeted'}}]:[]}))}};
  const complete=await store.execute(a,s,'save',{...request,title:'Complete fixture'},completed);
  assert.equal(complete.status,200);assert.equal(complete.saved.validatedAt,null);
  const confirm={expectedAccount:a.id,id:complete.saved.id,revision:1,confirmed:true};
  assert.equal((await store.execute(a,s,'validate',{...confirm,confirmed:false})).status,400);
  assert.equal((await store.execute(b,digests[1],'validate',{...confirm,expectedAccount:b.id})).status,409);
  const approved=await store.execute(a,s,'validate',confirm);
  assert.equal(approved.status,200);assert.equal(approved.saved.revision,2);assert.ok(Number(approved.saved.validatedAt)>0);
  assert.equal((await store.execute(a,s,'validate',confirm)).status,409);
  const changed=await store.execute(a,s,'save',{...request,id:complete.saved.id,revision:2},completed);
  assert.equal(changed.saved.validatedAt,null);
  assert.equal((await store.execute(a,s,'delete',{expectedAccount:a.id,id:complete.saved.id,revision:3})).status,200);
  await pool.query("UPDATE jsb_catalogue.current_release SET generation=2 WHERE discipline='taiso' AND version=$1",[version]);
  assert.equal((await store.execute(a,s,'read',{expectedAccount:a.id,id:key})).draft.stale,true);
  assert.equal((await store.execute(a,s,'save',{...request,id:key,revision:2},prepared)).status,409);
  assert.equal((await store.execute(a,s,'delete',{expectedAccount:a.id,id:key,revision:1})).status,409);
  assert.equal((await store.execute(b,digests[1],'delete',{expectedAccount:b.id,id:key,revision:2})).status,409);
  assert.equal((await store.execute(a,s,'delete',{expectedAccount:a.id,id:key,revision:2})).status,200);
  await pool.query('DELETE FROM jsb_auth.sessions WHERE hash=$1',[s]);
  assert.equal((await store.execute(a,s,'list',{expectedAccount:a.id})).status,401);
 }finally{
  try{if(safe){await pool.query('DELETE FROM jsb_auth.accounts WHERE id=ANY($1::text[])',[owners.map(x=>x.id)]);await pool.query("DELETE FROM jsb_catalogue.current_release WHERE discipline='taiso' AND version=$1",[version]);await pool.query("DELETE FROM jsb_catalogue.releases WHERE discipline='taiso' AND version=$1",[version]);}}
  finally{await pool.end();}
 }
});
