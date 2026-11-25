'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {createVerificationResend}=require('../backend/verification-resend.cjs');
const {createEmailVerificationService}=require('../backend/email-verification.cjs');
function fixture(){
 let now=1000;const accounts=new Map([
 ['coach@example.test',{id:'c',role:'coach',status:'pending',emailVerified:false}],
 ['person@example.test',{id:'p',role:'individual',status:'pending',emailVerified:false}],
 ['active@example.test',{id:'x',role:'coach',status:'active',emailVerified:true}],
 ['suspended@example.test',{id:'s',role:'individual',status:'suspended',emailVerified:false}],
 ['admin@example.test',{id:'a',role:'admin',status:'pending',emailVerified:false}]]);
 const tokens=new Map(),deliveries=[],calls=[];
 const limiter={reserve:async r=>{calls.push(r);return true;}};
 const resend=createVerificationResend({limiter,now:()=>now,ttlMs:100,replacePendingVerification:async r=>{
  const account=accounts.get(r.email);
  if(!account||account.status!=='pending'||account.emailVerified!==false||!['coach','individual'].includes(account.role))return 'ineligible';
  for(const [hash,v] of tokens)if(v.accountId===account.id)tokens.delete(hash);
  tokens.set(r.verification.hash,{...r.verification,accountId:account.id});
  deliveries.push(r.delivery);return 'replaced';
 }});
 const verify=createEmailVerificationService({limiter,now:()=>now,consumeAndActivate:async({hash,now})=>{
  const v=tokens.get(hash),a=v&&[...accounts.values()].find(x=>x.id===v.accountId);
  if(!a||a.status!=='pending'||a.emailVerified||v.issuedAt>now||v.expiresAt<=now)return 'invalid';
  tokens.delete(hash);a.status='active';a.emailVerified=true;return 'activated';
 }});
 return {resend,verify,accounts,tokens,deliveries,calls,advance:n=>now+=n};
}
test('Renvoi : nouveau lien pour chaque profil grand public, ancien lien invalidé',async()=>{
 const {resend,verify,tokens,deliveries,accounts}=fixture();
 for(const email of ['coach@example.test','person@example.test']){
  assert.deepEqual(await resend.resend(email,'source'),{ok:true,status:202});
  const first=deliveries.at(-1).token;
  assert.deepEqual(await resend.resend(email.toUpperCase(),'source'),{ok:true,status:202});
  const second=deliveries.at(-1).token;
  assert.notEqual(first,second);
  assert.equal(tokens.has(createHash('sha256').update(first).digest('hex')),false);
  assert.equal(tokens.has(createHash('sha256').update(second).digest('hex')),true);
  assert.equal((await verify.verify(first,'source')).status,400);
  assert.equal((await verify.verify(second,'source')).status,200);
  assert.equal(accounts.get(email).status,'active');
  assert.equal((await verify.verify(second,'source')).status,400);
 }
});
test('Renvoi : même réponse pour compte absent, actif, suspendu ou admin',async()=>{
 const {resend,deliveries}=fixture();
 for(const email of ['missing@example.test','active@example.test','suspended@example.test','admin@example.test'])
  assert.deepEqual(await resend.resend(email,'source'),{ok:true,status:202});
 assert.equal(deliveries.length,0);
});
test('Renvoi : expiration, limitation et indisponibilité sans divulgation',async()=>{
 const {resend,verify,deliveries,advance}=fixture();
 await resend.resend('coach@example.test','source');advance(100);
 assert.equal((await verify.verify(deliveries[0].token,'source')).status,400);
 assert.equal((await resend.resend('invalid','source')).status,400);
 const limited=createVerificationResend({limiter:{reserve:async()=>false},replacePendingVerification:async()=>{throw Error('unexpected');}});
 assert.equal((await limited.resend('coach@example.test','source')).status,429);
 const broken=createVerificationResend({limiter:{reserve:async()=>true},replacePendingVerification:async()=>{throw Error('secret');}});
 assert.deepEqual(await broken.resend('coach@example.test','source'),{ok:false,status:503});
});
