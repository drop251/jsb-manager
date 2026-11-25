'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHash,randomBytes}=require('node:crypto');
const {createEmailVerificationService}=require('../backend/email-verification.cjs');
const {createRegistrationService}=require('../backend/registration-service.cjs');
function fixture(){
 let time=1000;const accounts=new Map(),tokens=new Map(),delivery=[];
 const limiter={reserve:async()=>true};
 const registration=createRegistrationService({limiter,now:()=>time,verificationTtlMs:100,createPendingAccount:async r=>{
  if([...accounts.values()].some(a=>a.email===r.account.email))return 'duplicate';
  accounts.set(r.account.id,r.account);tokens.set(r.verification.hash,r.verification);delivery.push(r.delivery);return 'created';
 }});
 // Atomic in this single-process test double; production requires a DB transaction.
 const consumeAndActivate=async({hash,now})=>{
  const v=tokens.get(hash),a=v&&accounts.get(v.accountId);
  if(!v||!a||v.issuedAt>now||v.expiresAt<=now||a.status!=='pending'||a.emailVerified!==false||!['coach','individual'].includes(a.role))return 'invalid';
  tokens.delete(hash);a.emailVerified=true;a.status='active';return 'activated';
 };
 const verification=createEmailVerificationService({consumeAndActivate,limiter,now:()=>time});
 const register=async role=>{assert.equal((await registration.register({role,email:role+'@example.test',password:'Phrase de passe de test !'},'trusted')).status,202);return delivery.at(-1);};
 return {register,verification,accounts,tokens,advance:n=>time+=n};
}
test('Confirmation e-mail : coach et particulier activés uniquement par leur jeton valide',async()=>{
 const {register,verification,accounts}=fixture();
 for(const role of ['coach','individual']){
  const d=await register(role),a=accounts.get(d.accountId);
  assert.equal(a.status,'pending');assert.equal(a.emailVerified,false);
  assert.deepEqual(await verification.verify(d.token,'trusted'),{ok:true,status:200});
  assert.equal(a.status,'active');assert.equal(a.emailVerified,true);assert.equal(a.role,role);assert.deepEqual(a.clubIds,[]);
  assert.deepEqual(await verification.verify(d.token,'trusted'),{ok:false,status:400});
 }
});
test('Confirmation e-mail : refus des jetons inconnus, expirés et malformés',async()=>{
 const {register,verification,accounts,advance}=fixture();
 const d=await register('coach');
 for(const token of [null,'invalid',randomBytes(32).toString('base64url')])assert.equal((await verification.verify(token,'trusted')).status,400);
 advance(100);assert.equal((await verification.verify(d.token,'trusted')).status,400);
 assert.equal(accounts.get(d.accountId).status,'pending');
});
test('Confirmation e-mail : consommation concurrente unique',async()=>{
 const {register,verification}=fixture();const d=await register('individual');
 const results=await Promise.all(Array.from({length:5},()=>verification.verify(d.token,'trusted')));
 assert.equal(results.filter(r=>r.ok).length,1);assert.equal(results.filter(r=>r.status===400).length,4);
});
test('Confirmation e-mail : impossibilité de réactiver un compte suspendu ou de créer des droits admin',async()=>{
 const {register,verification,accounts}=fixture();const d=await register('coach'),a=accounts.get(d.accountId);
 a.status='suspended';assert.equal((await verification.verify(d.token,'trusted')).status,400);
 a.status='pending';a.role='admin';assert.equal((await verification.verify(d.token,'trusted')).status,400);
 assert.equal(a.emailVerified,false);
});
test('Confirmation e-mail : empreinte seule transmise au stockage, quotas et erreurs sans divulgation',async()=>{
 const token=randomBytes(32).toString('base64url');let call;
 const service=createEmailVerificationService({limiter:{reserve:async()=>true},now:()=>1000,consumeAndActivate:async args=>{call=args;return 'invalid';}});
 assert.equal((await service.verify(token,'trusted')).status,400);
 assert.deepEqual(call,{hash:createHash('sha256').update(token).digest('hex'),now:1000});
 const limited=createEmailVerificationService({limiter:{reserve:async()=>false},consumeAndActivate:async()=>{throw Error('unexpected');}});
 assert.equal((await limited.verify(token,'trusted')).status,429);
 const broken=createEmailVerificationService({limiter:{reserve:async()=>true},consumeAndActivate:async()=>{throw Error('secret');}});
 assert.deepEqual(await broken.verify(token,'trusted'),{ok:false,status:503});
});
