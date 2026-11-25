'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createPublicLoginService,createAdminLoginService,createLoginService}=require('../backend/login-service.cjs');
const password='Phrase de passe pour test multi-comptes';
function fixture(){
 const calls=[];
 const options={
  limiter:{reserve:async()=>true},
  sessions:{issue:async proof=>{calls.push(['issue',proof]);return {token:'test-token',expiresAt:12345};}},
  findAccountByEmail:async email=>({id:email,role:email.split('@')[0],status:'active',emailVerified:true,passwordHash:'test',credentialVersion:1}),
  verifyMfa:async()=>{calls.push(['mfa']);return true;},
  verifyRecovery:async()=>{calls.push(['recovery']);return true;},
  checkPassword:async()=>true
 };
 return {calls,options};
}
const input=role=>({email:role+'@example.test',password,sourceId:'test',mfaCode:'123456'});
test('Public : Coach et Particulier uniquement, même si le client déclare un autre rôle',async()=>{
 const {calls,options}=fixture(),service=createPublicLoginService({...options,allowedRoles:['admin']});
 for(const role of ['coach','individual']){
  assert.equal((await service.login({...input(role),role:'admin'})).status,200);
 }
 assert.equal((await service.login(input('admin'))).status,401);
 assert.deepEqual(calls.map(x=>x[0]),['issue','issue']);
 assert.deepEqual(calls.map(x=>x[1].roleAtVerification),['coach','individual']);
});
test('Admin : Coach et Particulier refusés, MFA exigée',async()=>{
 const {calls,options}=fixture(),service=createAdminLoginService({...options,allowedRoles:['coach']});
 for(const role of ['coach','individual'])assert.equal((await service.login(input(role))).status,401);
 assert.equal((await service.login({...input('admin'),mfaCode:undefined})).status,401);
 assert.equal((await service.login(input('admin'))).status,200);
 assert.deepEqual(calls.map(x=>x[0]),['mfa','issue']);
});
test('Périmètre serveur invalide refusé, périmètre figé à la construction',async()=>{
 const {options}=fixture();
 for(const allowedRoles of [null,[],['unknown'],'admin'])assert.throws(()=>createLoginService({...options,allowedRoles}),TypeError);
 const allowedRoles=['coach'],service=createLoginService({...options,allowedRoles});
 allowedRoles.push('admin');
 assert.equal((await service.login(input('admin'))).status,401);
});
