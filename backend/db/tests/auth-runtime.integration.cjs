'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {randomBytes}=require('node:crypto');
const {Pool}=require('pg');
const {createAuthRuntime}=require('../../auth-runtime.cjs');
const {createDeliveryVault}=require('../../delivery-vault.cjs');
const {createMfaVault}=require('../../mfa-vault.cjs');
const {codeForStep}=require('../../admin-mfa.cjs');
const {hashPassword}=require('../../passwords.cjs');
const publicOrigin='https://manager.example.test',adminOrigin='https://admin.example.test';
const password='Phrase de passe initiale JSB recette !',newPassword='Nouvelle phrase de passe JSB recette !';
const publicEmail='runtime-coach@example.test',adminEmail='runtime-admin@example.test';
const keyset=(name,byte)=>({activeKeyId:name,loadKey:async id=>id===name?Buffer.alloc(32,byte):undefined});
test('Runtime PostgreSQL : parcours HTTP publics et MFA administrateur',async()=>{
 assert.equal(process.env.PGDATABASE,'jsb_ci');
 const pool=new Pool({max:8});let safe=false,server;
 try{
  assert.equal((await pool.query('SELECT current_database() AS name')).rows[0].name,'jsb_ci');safe=true;
  const deliveryKeys=keyset('delivery-ci',11),mfaKeys=keyset('mfa-ci',12);
  const options={pool,publicOrigin,adminOrigin,sourceId:()=> 'runtime-ci',quotaSecret:Buffer.alloc(32,13),deliveryKeys,mfaKeys};
  assert.throws(()=>createAuthRuntime({...options,adminOrigin:publicOrigin}),/distincts/);
  await assert.rejects(createAuthRuntime({...options,mfaKeys:deliveryKeys}).checkReady(),/distinctes/);
  const runtime=createAuthRuntime(options);
  assert.equal(await runtime.checkReady(),true);
  server=http.createServer((req,res)=>(req.headers.host==='admin.example.test'?runtime.adminHandler:runtime.publicHandler)(req,res));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  function request(origin,path,body,cookie){
   const method=body===undefined?'GET':'POST',data=body===undefined?undefined:JSON.stringify(body);
   return new Promise((resolve,reject)=>{
    const req=http.request({host:'127.0.0.1',port:server.address().port,path,method,headers:{Host:new URL(origin).host,...(data===undefined?{}:{Origin:origin,'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}),...(cookie?{Cookie:cookie}:{})}},res=>{
     let raw='';res.setEncoding('utf8');res.on('data',c=>raw+=c);res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(raw),cookie:res.headers['set-cookie']?.[0]?.split(';')[0]}));
    });req.on('error',reject);req.end(data);
   });
  }
  const pub=(path,body,cookie)=>request(publicOrigin,path,body,cookie);
  const adm=(path,body,cookie)=>request(adminOrigin,path,body,cookie);
  const vault=createDeliveryVault(deliveryKeys);
  async function tokenFor(purpose){
   const r=await pool.query('SELECT o.account_id,o.purpose,o.encrypted_payload FROM jsb_auth.delivery_outbox o JOIN jsb_auth.accounts a ON a.id=o.account_id WHERE a.email=$1 AND o.purpose=$2',[publicEmail,purpose]);
   assert.equal(r.rowCount,1);
   const row=r.rows[0];
   return (await vault.decryptDelivery({accountId:row.account_id,purpose:row.purpose,encryptedPayload:row.encrypted_payload})).token;
  }
  assert.equal((await pub('/api/register',{email:publicEmail,password,role:'coach'})).status,202);
  assert.equal((await pub('/api/login',{email:publicEmail,password})).status,401);
  const first=await tokenFor('email-verification');
  assert.equal((await pub('/api/verify-email',{token:first})).status,200);
  const one=await pub('/api/login',{email:publicEmail,password}),two=await pub('/api/login',{email:publicEmail,password});
  assert.equal(one.status,200);assert.equal(two.status,200);assert.notEqual(one.cookie,two.cookie);
  assert.equal((await pub('/api/session',undefined,one.cookie)).body.account.role,'coach');
  assert.equal((await adm('/api/session',undefined,one.cookie.replace('__Host-jsb-public','__Host-jsb-admin'))).status,401);
  assert.equal((await pub('/api/password-reset/request',{email:publicEmail})).status,202);
  const old=await tokenFor('password-reset');
  assert.equal((await pub('/api/password-reset/request',{email:publicEmail})).status,202);
  const latest=await tokenFor('password-reset');assert.notEqual(old,latest);
  assert.equal((await pub('/api/password-reset/confirm',{token:old,password:newPassword})).status,400);
  const results=await Promise.all([pub('/api/password-reset/confirm',{token:latest,password:newPassword}),pub('/api/password-reset/confirm',{token:latest,password:newPassword})]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,400]);
  for(const r of [one,two])assert.equal((await pub('/api/session',undefined,r.cookie)).status,401);
  assert.equal((await pub('/api/login',{email:publicEmail,password})).status,401);
  const fresh=await pub('/api/login',{email:publicEmail,password:newPassword});
  assert.equal(fresh.status,200);assert.equal((await pub('/api/logout',{},fresh.cookie)).status,200);
  assert.equal((await pub('/api/session',undefined,fresh.cookie)).status,401);
  const adminId=randomBytes(16).toString('hex'),factorVersion='ci-v1',secret=randomBytes(20);
  const envelope=await createMfaVault(mfaKeys).seal({accountId:adminId,factorVersion,secret});
  await pool.query("INSERT INTO jsb_auth.accounts(id,email,password_hash,role,status,email_verified,created_at) VALUES ($1,$2,$3,'admin','active',true,$4)",[adminId,adminEmail,await hashPassword(password),Date.now()]);
  await pool.query('INSERT INTO jsb_auth.mfa_factors(account_id,factor_version,encrypted_secret,enabled) VALUES ($1,$2,$3,true)',[adminId,factorVersion,envelope]);
  const code=codeForStep(secret,Math.floor(Date.now()/30000));
  assert.equal((await pub('/api/login',{email:adminEmail,password,mfaCode:code})).status,401);
  assert.equal((await adm('/api/login',{email:adminEmail,password})).status,401);
  const adminResults=await Promise.all([adm('/api/login',{email:adminEmail,password,mfaCode:code}),adm('/api/login',{email:adminEmail,password,mfaCode:code})]);
  assert.deepEqual(adminResults.map(r=>r.status).sort(),[200,401]);
  const signed=adminResults.find(r=>r.status===200);
  assert.equal((await adm('/api/session',undefined,signed.cookie)).body.account.role,'admin');
  assert.equal((await pub('/api/session',undefined,signed.cookie.replace('__Host-jsb-admin','__Host-jsb-public'))).status,401);
  assert.equal((await pub('/api/password-reset/request',{email:adminEmail})).status,202);
  assert.equal((await pool.query('SELECT count(*) AS n FROM jsb_auth.action_tokens WHERE account_id=$1',[adminId])).rows[0].n,'0');
 }finally{
  try{
   if(server)await new Promise(resolve=>server.close(resolve));
   if(safe){await pool.query('DELETE FROM jsb_auth.accounts WHERE email=ANY($1::text[])',[[publicEmail,adminEmail]]);await pool.query('DELETE FROM jsb_auth.quota_events');}
  }finally{await pool.end();}
 }
});
