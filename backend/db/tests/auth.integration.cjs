'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createAuthStore}=require('../auth-store.cjs');
const {createSessions}=require('../../sessions.cjs');
const {createLoginService}=require('../../login-service.cjs');
const {hashPassword}=require('../../passwords.cjs');
const {Pool}=require('pg');
const ID='a123456789abcdef0123456789abcdef';
const PASSWORD='Phrase de passe de recette PostgreSQL !';
test('PostgreSQL : connexion réelle, sessions persistantes et révocation par version',async()=>{
 assert.equal(process.env.PGDATABASE,'jsb_ci','Base de recette exclusivement');
 const pool=new Pool({max:4});
 try{
  assert.equal((await pool.query('SELECT current_database() AS name')).rows[0].name,'jsb_ci');
  const passwordHash=await hashPassword(PASSWORD);
  await pool.query("INSERT INTO jsb_auth.accounts(id,email,password_hash,role,status,email_verified,created_at) VALUES ($1,$2,$3,'coach','active',true,1000)",[ID,'session-integration@example.test',passwordHash]);
  const auth=createAuthStore(pool);
  const sessions=createSessions({store:auth.store,loadAccount:auth.loadAccount});
  const login=createLoginService({limiter:{reserve:async()=>true},sessions,findAccountByEmail:auth.findAccountByEmail,verifyMfa:async()=>false});
  const request={email:'session-integration@example.test',password:PASSWORD,sourceId:'ci'};
  const first=await login.login(request);assert.equal(first.ok,true);
  const actor=await sessions.resolveSession(first.token);
  assert.equal(actor.id,ID);assert.equal(actor.role,'coach');assert.deepEqual(actor.clubIds,[]);
  const persisted=await pool.query('SELECT hash,credential_version FROM jsb_auth.sessions WHERE account_id=$1',[ID]);
  assert.equal(persisted.rowCount,1);assert.notEqual(persisted.rows[0].hash,first.token);assert.equal(Number(persisted.rows[0].credential_version),1);
  // A password check already in flight must not mint a session with newer credentials.
  const racing=createLoginService({limiter:{reserve:async()=>true},sessions,findAccountByEmail:auth.findAccountByEmail,verifyMfa:async()=>false,checkPassword:async()=>{
   await pool.query('UPDATE jsb_auth.accounts SET credential_version=credential_version+1 WHERE id=$1',[ID]);return true;
  }});
  assert.equal((await racing.login(request)).status,401);
  assert.equal(await sessions.resolveSession(first.token),null);
  const second=await login.login(request);assert.equal(second.ok,true);
  await sessions.revoke(second.token);assert.equal(await sessions.resolveSession(second.token),null);
  const third=await login.login(request);assert.equal(third.ok,true);
  await pool.query("UPDATE jsb_auth.accounts SET status='suspended',credential_version=credential_version+1 WHERE id=$1",[ID]);
  assert.equal(await sessions.resolveSession(third.token),null);
  assert.equal((await login.login(request)).status,401);
 }finally{
  try{await pool.query('DELETE FROM jsb_auth.accounts WHERE id=$1',[ID]);}finally{await pool.end();}
 }
});
