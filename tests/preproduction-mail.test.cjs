'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createPreprodDelivery}=require('../backend/preproduction-mail.cjs');
const fixtureKey=n=>Buffer.alloc(32,n).toString('base64url');
const env={
 JSB_ENV:'preproduction',JSB_PUBLIC_ORIGIN:'https://manager.example.test',JSB_ADMIN_ORIGIN:'https://admin.example.test',
 DATABASE_URL:'postgresql://fixture@localhost/jsb_preprod',
 JSB_QUOTA_KEY:fixtureKey(1),JSB_DELIVERY_KEY:fixtureKey(2),JSB_MFA_KEY:fixtureKey(3),JSB_GATEWAY_KEY:fixtureKey(4),
 JSB_DELIVERY_KEY_ID:'fixture-mail',JSB_MFA_KEY_ID:'fixture-mfa',
 JSB_MAIL_MODE:'resend-test',JSB_MAIL_ALLOWED_RECIPIENTS:'recipient@example.test',JSB_MAIL_FROM:'sender@example.test',
 JSB_RESEND_API_KEY:'not-a-real-provider-key',JSB_MAIL_NAMESPACE:'fixture-deployment-01'
};
test('Messagerie de préproduction : activation explicite et configuration fermée',async()=>{
 let sql=0,network=0;
 const pool={query:async()=>{sql++;return {rows:[],rowCount:0};}};
 const fetchImpl=async()=>{network++;throw Error('Network forbidden in this test');};
 for(const change of [
  {JSB_MAIL_MODE:undefined},{JSB_MAIL_MODE:'production'},{JSB_ENV:'production'},
  {JSB_MAIL_ALLOWED_RECIPIENTS:''},{JSB_MAIL_ALLOWED_RECIPIENTS:'invalid'},
  {JSB_MAIL_ALLOWED_RECIPIENTS:Array.from({length:21},(_,i)=>'fixture'+i+'@example.test').join(',')},
  {JSB_MAIL_FROM:'invalid'},{JSB_RESEND_API_KEY:''},{JSB_MAIL_NAMESPACE:''},
  {DATABASE_URL:'postgresql://fixture@localhost/jsb_ci'}
 ]){
  assert.throws(()=>createPreprodDelivery({env:{...env,...change},pool,fetchImpl}));
 }
 assert.equal(sql,0);assert.equal(network,0);
 const worker=createPreprodDelivery({env,pool,fetchImpl});
 assert.equal(await worker.runOnce(),'idle');
 assert.equal(await worker.purgeExpired(),0);
 assert.equal(sql,2);assert.equal(network,0);
});
