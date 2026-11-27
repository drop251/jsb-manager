'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomBytes}=require('node:crypto');
const {Pool}=require('pg');
const {createRightsStore}=require('../rights-store.cjs');
const {createPersonalExport}=require('../personal-export.cjs');
const {closeTestAccount}=require('../account-closure.cjs');
const {hashPassword}=require('../../passwords.cjs');
test('RGPD : export personnel réauthentifié et clôture de compte fictif contrôlée',async()=>{
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
   if(sql.startsWith('BEGIN'))return conn.query('SAVEPOINT legal_operation');
   if(sql==='COMMIT')return conn.query('RELEASE SAVEPOINT legal_operation');
   if(sql==='ROLLBACK'){await conn.query('ROLLBACK TO SAVEPOINT legal_operation');return conn.query('RELEASE SAVEPOINT legal_operation');}
   return conn.query(sql,params);
  }})};
  const store=createRightsStore(adapter),exporter=createPersonalExport(adapter),coach=owners[0],individual=owners[1],admin=owners[2];
  const password='Mot de passe de recette uniquement';
  const stored=await hashPassword(password);
  await conn.query('UPDATE jsb_auth.accounts SET password_hash=$2 WHERE id=$1',[coach.id,stored]);
  const body={expectedAccount:coach.id,password};
  assert.equal((await exporter.execute(admin,sessions[2],{...body,expectedAccount:admin.id})).status,403);
  assert.equal((await exporter.execute(coach,sessions[0],{...body,expectedAccount:individual.id})).status,409);
  assert.equal((await exporter.execute(coach,sessions[0],{...body,password:'Autre phrase de recette'})).status,401);
  assert.equal((await exporter.execute(coach,sessions[1],body)).status,401);
  const rights=(await store.execute(coach,sessions[0],'rights-submit',{expectedAccount:coach.id,kind:'erasure'})).request;
  await conn.query('INSERT INTO jsb_private.attendance_registers(owner_id,revision,snapshot,updated_at) VALUES($1,1,$2,$3)',[coach.id,JSON.stringify({groups:[],members:[],slots:[],calls:[]}),now]);
  const result=await exporter.execute(coach,sessions[0],body);assert.equal(result.status,200);
  assert.equal(result.export.account.id,coach.id);assert.equal(result.export.sessions.length,1);assert.equal(result.export.rightsRequests[0].id,rights.id);
  const json=JSON.stringify(result.export);for(const secret of [stored,password,sessions[0],individual.id,admin.id])assert.equal(json.includes(secret),false);
  assert.equal(Object.hasOwn(result.export,'attendance'),false);
  const opts={accountId:coach.id,requestId:rights.id,revision:1,expectedDatabase:'jsb_ci'};
  await assert.rejects(closeTestAccount(adapter,opts),/non confirmée/);
  const progress=(await store.execute(admin,sessions[2],'rights-update',{expectedAccount:admin.id,id:rights.id,revision:1,status:'in_progress',confirmed:true})).request;
  const responded=(await store.execute(admin,sessions[2],'rights-update',{expectedAccount:admin.id,id:rights.id,revision:progress.revision,status:'responded',confirmed:true})).request;
  opts.revision=responded.revision;
  await assert.rejects(closeTestAccount(adapter,{...opts,apply:true}),/invalides/);
  await assert.rejects(closeTestAccount(adapter,{...opts,expectedDatabase:'jsb_preprod'}),/Base dédiée/);
  const preview=await closeTestAccount(adapter,opts);assert.equal(preview.mode,'preview');assert.equal(preview.counts['jsb_auth.sessions'],1);assert.equal(preview.counts['jsb_private.attendance_registers'],1);
  assert.equal((await conn.query('SELECT status FROM jsb_auth.accounts WHERE id=$1',[coach.id])).rows[0].status,'active');
  const closed=await closeTestAccount(adapter,{...opts,apply:true,approved:true});assert.equal(closed.mode,'applied');assert.equal(closed.retained.rights_requests,1);
  const account=(await conn.query('SELECT status,email,password_hash,email_verified FROM jsb_auth.accounts WHERE id=$1',[coach.id])).rows[0];
  assert.equal(account.status,'deleted');assert.match(account.email,/@invalid\.invalid$/);assert.notEqual(account.password_hash,stored);assert.equal(account.email_verified,false);
  assert.equal((await conn.query('SELECT count(*)::int AS n FROM jsb_auth.sessions WHERE account_id=$1',[coach.id])).rows[0].n,0);
  assert.equal((await conn.query('SELECT count(*)::int AS n FROM jsb_private.attendance_registers WHERE owner_id=$1',[coach.id])).rows[0].n,0);
  assert.equal((await conn.query('SELECT status FROM jsb_auth.accounts WHERE id=$1',[individual.id])).rows[0].status,'active');
  assert.equal((await exporter.execute(coach,sessions[0],body)).status,401);
 }finally{if(started)await conn.query('ROLLBACK');conn.release();await pool.end();}
});
