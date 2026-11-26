'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHash,randomBytes}=require('node:crypto');
const {createPasswordResetService}=require('../backend/password-reset.cjs');
const {createSessions}=require('../backend/sessions.cjs');
const {hashPassword,verifyPassword}=require('../backend/passwords.cjs');
const OLD='Ancienne phrase de passe !',NEXT='Nouvelle phrase de passe !';
async function fixture(){
 let time=1000;
 const passwordHash=await hashPassword(OLD);
 const accounts=new Map(['coach','individual','admin','pending','suspended'].map(role=>[role+'@example.test',{id:role,role:role==='pending'||role==='suspended'?'coach':role,status:role==='pending'?'pending':role==='suspended'?'suspended':'active',emailVerified:role!=='pending',passwordHash}]));
 const records=new Map(),tokens=new Map(),deliveries=[];
 const store={insert:async r=>records.set(r.hash,r),find:async h=>records.get(h),remove:async h=>records.delete(h),removeAccount:async id=>{for(const [h,r] of records)if(r.accountId===id)records.delete(h);}};
 const sessions=createSessions({store,loadAccount:async id=>[...accounts.values()].find(a=>a.id===id),now:()=>time});
 const eligible=a=>a&&a.status==='active'&&a.emailVerified===true&&['coach','individual'].includes(a.role);
 const limiter={reserve:async()=>true};
 const adapters={requestLimiter:limiter,confirmLimiter:limiter,now:()=>time,ttlMs:100,
 replaceReset:async r=>{
  const a=accounts.get(r.email);if(!eligible(a))return 'ineligible';
  for(const [h,v] of tokens)if(v.accountId===a.id)tokens.delete(h);
  tokens.set(r.reset.hash,{...r.reset,accountId:a.id});deliveries.push(r.delivery);return 'created';
 },
 // Single-process test double: synchronous mutation before returning. Production needs a transaction.
 consumeResetAndRevoke:async r=>{
  const v=tokens.get(r.hash),a=v&&[...accounts.values()].find(x=>x.id===v.accountId);
  if(!eligible(a)||v.purpose!==r.purpose||v.issuedAt>r.now||v.expiresAt<=r.now)return 'invalid';
  a.passwordHash=r.passwordHash;
  for(const [h,x] of tokens)if(x.accountId===a.id)tokens.delete(h);
  for(const [h,x] of records)if(x.accountId===a.id)records.delete(h);
  return 'updated';
 }};
 return {accounts,records,tokens,deliveries,sessions,adapters,service:createPasswordResetService(adapters),advance:n=>time+=n};
}
test('Récupération : coach et particulier, hachage et révocation de toutes les sessions du seul compte concerné',async()=>{
 const f=await fixture();
 const coach=await f.sessions.issue({accountId:'coach',credentialVerified:true});
 const coach2=await f.sessions.issue({accountId:'coach',credentialVerified:true});
 const person=await f.sessions.issue({accountId:'individual',credentialVerified:true});
 assert.deepEqual(await f.service.request(' COACH@example.test ','source'),{ok:true,status:202});
 const d=f.deliveries[0],hash=createHash('sha256').update(d.token).digest('hex');
 assert.equal(f.tokens.get(hash).purpose,'password-reset');
 assert.equal(f.tokens.get(hash).expiresAt,1100);
 assert.deepEqual(await f.service.confirm({token:d.token,password:NEXT},'source'),{ok:true,status:200});
 const a=f.accounts.get('coach@example.test');
 assert.equal(await verifyPassword(NEXT,a.passwordHash),true);
 assert.equal(await verifyPassword(OLD,a.passwordHash),false);
 for(const s of [coach,coach2])assert.equal(await f.sessions.resolveSession(s.token),null);
 assert.equal((await f.sessions.resolveSession(person.token)).id,'individual');
 assert.equal((await f.service.confirm({token:d.token,password:OLD},'source')).status,400);
 assert.equal((await f.service.request('individual@example.test','source')).status,202);
 assert.equal((await f.service.confirm({token:f.deliveries.at(-1).token,password:NEXT},'source')).status,200);
 assert.equal(await f.sessions.resolveSession(person.token),null);
});
test('Récupération : réponses identiques pour comptes inconnus, admin, suspendus et non confirmés',async()=>{
 const f=await fixture();
 for(const email of ['unknown','admin','pending','suspended'])assert.deepEqual(await f.service.request(email+'@example.test','source'),{ok:true,status:202});
 assert.equal(f.deliveries.length,0);assert.equal(f.tokens.size,0);
});
test('Récupération : remplacement, expiration, usage unique concurrent et refus des autres types de jetons',async()=>{
 const f=await fixture();
 await f.service.request('coach@example.test','source');const first=f.deliveries.at(-1).token;
 await f.service.request('coach@example.test','source');const second=f.deliveries.at(-1).token;
 assert.notEqual(first,second);
 assert.equal((await f.service.confirm({token:first,password:NEXT},'source')).status,400);
 const other=randomBytes(32).toString('base64url');
 f.tokens.set(createHash('sha256').update(other).digest('hex'),{accountId:'coach',purpose:'email-verification',issuedAt:1000,expiresAt:1100});
 assert.equal((await f.service.confirm({token:other,password:NEXT},'source')).status,400);
 const results=await Promise.all([1,2].map(()=>f.service.confirm({token:second,password:NEXT},'source')));
 assert.equal(results.filter(r=>r.ok).length,1);
 await f.service.request('coach@example.test','source');f.advance(100);
 assert.equal((await f.service.confirm({token:f.deliveries.at(-1).token,password:NEXT},'source')).status,400);
});
test('Récupération : suspension après émission du lien, formats, quotas et stockage indisponible',async()=>{
 const f=await fixture();
 await f.service.request('coach@example.test','source');const token=f.deliveries[0].token;
 f.accounts.get('coach@example.test').status='suspended';
 assert.equal((await f.service.confirm({token,password:NEXT},'source')).status,400);
 assert.equal((await f.service.confirm({token:'bad',password:NEXT},'source')).status,400);
 assert.equal((await f.service.confirm({token,password:'court'},'source')).status,400);
 const limited=createPasswordResetService({...f.adapters,requestLimiter:{reserve:async()=>false},confirmLimiter:{reserve:async()=>false}});
 assert.equal((await limited.request('coach@example.test','source')).status,429);
 assert.equal((await limited.confirm({token,password:NEXT},'source')).status,429);
 const broken=createPasswordResetService({...f.adapters,replaceReset:async()=>{throw Error('secret');},consumeResetAndRevoke:async()=>{throw Error('secret');}});
 assert.deepEqual(await broken.request('coach@example.test','source'),{ok:false,status:503});
 assert.deepEqual(await broken.confirm({token,password:NEXT},'source'),{ok:false,status:503});
});
