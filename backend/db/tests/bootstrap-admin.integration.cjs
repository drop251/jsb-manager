'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Pool}=require('pg');
const {bootstrapFirstAdmin}=require('../../bootstrap-preprod-admin.cjs');
const {createMfaVault}=require('../../mfa-vault.cjs');
const {codeForStep}=require('../../admin-mfa.cjs');
const {verifyPassword}=require('../../passwords.cjs');
const {createAuthRuntime}=require('../../auth-runtime.cjs');
const keyset=(id,n)=>({activeKeyId:id,loadKey:async key=>key===id?Buffer.alloc(32,n):undefined});
function decodeBase32(value){
 let n=0,bits=0;const bytes=[];
 for(const ch of value){const digit='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(ch);assert.ok(digit>=0);n=(n<<5)|digit;bits+=5;if(bits>=8){bits-=8;bytes.push((n>>>bits)&255);}}
 return Buffer.from(bytes);
}
test('Premier administrateur de préproduction : création atomique et MFA confirmé',async()=>{
 assert.equal(process.env.PGDATABASE,'jsb_preprod');
 const pool=new Pool({max:6});let safe=false;
 try{
  assert.equal((await pool.query('SELECT current_database() AS name')).rows[0].name,'jsb_preprod');safe=true;
  assert.equal((await pool.query('SELECT count(*) AS n FROM jsb_auth.accounts')).rows[0].n,'0');
  const mfaKeys=keyset('bootstrap-mfa-ci',33);
  let shown=false;
  await assert.rejects(bootstrapFirstAdmin({pool:{query:async()=>({rows:[{name:'jsb_ci'}]}),connect:async()=>{}},mfaKeys,email:'admin@example.test',confirmTotp:async()=>{shown=true;return '123456';}}),/Base dédiée/);
  assert.equal(shown,false);
  await assert.rejects(bootstrapFirstAdmin({pool,mfaKeys,email:'admin@example.test',confirmTotp:async()=>''}),/Confirmation MFA refusée/);
  assert.equal((await pool.query('SELECT count(*) AS n FROM jsb_auth.accounts')).rows[0].n,'0');
  async function confirmTotp({uri}){
   const secret=decodeBase32(new URL(uri).searchParams.get('secret'));
   return codeForStep(secret,Math.floor(Date.now()/30000));
  }
  const outcomes=await Promise.allSettled(['admin-a@example.test','admin-b@example.test'].map(email=>bootstrapFirstAdmin({pool,mfaKeys,email,confirmTotp})));
  const success=outcomes.filter(r=>r.status==='fulfilled');
  assert.equal(success.length,1);
  const credential=success[0].value;
  const row=(await pool.query("SELECT a.*,f.encrypted_secret,f.factor_version,f.enabled,f.last_step FROM jsb_auth.accounts a JOIN jsb_auth.mfa_factors f ON f.account_id=a.id")).rows[0];
  assert.equal(row.role,'admin');assert.equal(row.status,'active');assert.equal(row.email_verified,true);assert.equal(row.enabled,true);
  assert.ok(await verifyPassword(credential.password,row.password_hash));
  assert.notEqual(credential.password,row.password_hash);
  const secret=await createMfaVault(mfaKeys).open({accountId:row.id,factorVersion:row.factor_version,envelope:row.encrypted_secret});
  assert.equal(secret.length,20);
  assert.ok(Number(row.last_step)>=Math.floor(Date.now()/30000)-1);
  await assert.rejects(bootstrapFirstAdmin({pool,mfaKeys,email:'extra@example.test',confirmTotp:async()=>{throw Error('Ne doit pas être appelée');}}),/déjà initialisé/);
  const runtime=createAuthRuntime({pool,publicOrigin:'https://manager.example.test',adminOrigin:'https://admin.example.test',sourceId:()=> 'bootstrap-ci',quotaSecret:Buffer.alloc(32,31),deliveryKeys:keyset('bootstrap-delivery-ci',32),mfaKeys});
  assert.equal(await runtime.checkReady(),true);
  assert.equal((await pool.query('SELECT count(*) AS n FROM jsb_auth.accounts')).rows[0].n,'1');
 }finally{try{if(safe)await pool.query("DELETE FROM jsb_auth.accounts WHERE email IN ('admin-a@example.test','admin-b@example.test')");}finally{await pool.end();}}
});
