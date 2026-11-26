'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {createRegistrationService}=require('../backend/registration-service.cjs');
const {verifyPassword}=require('../backend/passwords.cjs');
const PASSWORD='Phrase de passe de test !';
function fixture(){
 const records=new Map(),deliveries=[],calls=[];
 const service=createRegistrationService({now:()=>1000,limiter:{reserve:async r=>{calls.push(r);return true;}},createPendingAccount:async r=>{
  if(records.has(r.account.email))return 'duplicate';
  records.set(r.account.email,{account:r.account,verification:r.verification});deliveries.push(r.delivery);return 'created';
 }});
 return {records,deliveries,calls,register:(input)=>service.register(input,'trusted-source')};
}
test('Inscription : coach et particulier uniquement, compte en attente, aucun privilège injecté',async()=>{
 const {register,records,deliveries,calls}=fixture();
 for(const role of ['coach','individual']){
  const email=role+'@example.test';
  assert.deepEqual(await register({email:' '+email.toUpperCase()+' ',password:PASSWORD,role,status:'active',emailVerified:true,clubIds:['other'],id:'admin'}),{ok:true,status:202});
  const {account,verification}=records.get(email);
  assert.equal(account.role,role);assert.equal(account.status,'pending');assert.equal(account.emailVerified,false);assert.deepEqual(account.clubIds,[]);
  assert.notEqual(account.id,'admin');assert.equal(await verifyPassword(PASSWORD,account.passwordHash),true);
  const delivery=deliveries.at(-1);assert.match(delivery.token,/^[A-Za-z0-9_-]{43}$/);
  assert.equal(verification.hash,createHash('sha256').update(delivery.token).digest('hex'));assert.equal(verification.expiresAt,1000+30*60*1000);
  assert.equal(verification.accountId,account.id);assert.equal(calls.at(-1).accountKey,email);
  assert.ok(!JSON.stringify(records.get(email)).includes(delivery.token));
 }
});
test('Inscription : admin, rôles inconnus et entrées invalides refusés avant stockage',async()=>{
 const {register,records,calls}=fixture();
 for(const input of [null,{email:'a@example.test',password:PASSWORD,role:'admin'},{email:'a@example.test',password:PASSWORD,role:'__proto__'},{email:'bad',password:PASSWORD,role:'coach'},{email:'a@example.test',password:'court',role:'individual'}])assert.deepEqual(await register(input),{ok:false,status:400});
 assert.equal(records.size,0);assert.equal(calls.length,0);
});
test('Inscription : réponse identique pour doublon et création, aucune modification du compte existant',async()=>{
 const {register,records,deliveries}=fixture();
 const input={email:'coach@example.test',password:PASSWORD,role:'coach'};
 const first=await register(input),original=JSON.stringify(records.get(input.email));
 assert.deepEqual(await register({...input,role:'individual',password:'Une autre phrase de passe !'}),first);
 assert.equal(JSON.stringify(records.get(input.email)),original);assert.equal(deliveries.length,1);
});
test('Inscription : limitation et indisponibilité du stockage sans divulgation',async()=>{
 const input={email:'a@example.test',password:PASSWORD,role:'coach'};
 const limited=createRegistrationService({limiter:{reserve:async()=>false},createPendingAccount:async()=>{throw Error('ne doit pas être appelé');}});
 assert.deepEqual(await limited.register(input,'trusted'),{ok:false,status:429});
 const broken=createRegistrationService({limiter:{reserve:async()=>true},createPendingAccount:async()=>{throw Error('secret interne');}});
 assert.deepEqual(await broken.register(input,'trusted'),{ok:false,status:503});
});
