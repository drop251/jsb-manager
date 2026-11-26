'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createSessions}=require('../backend/sessions.cjs');
const {createRequestGuard}=require('../backend/request-guard.cjs');
function fixture(){
 let clock=1000;
 const accounts=new Map([
 ['a',{id:'a',role:'admin',status:'active'}],
 ['c',{id:'c',role:'coach',status:'active',clubIds:['club-a']}],
 ['p',{id:'p',role:'individual',status:'active'}]]);
 const records=new Map();
 const store={insert:async r=>{if(records.has(r.hash))throw Error('duplicate');records.set(r.hash,r);},find:async h=>records.get(h),remove:async h=>records.delete(h),removeAccount:async id=>{for(const [h,r] of records)if(r.accountId===id)records.delete(h);}};
 const sessions=createSessions({store,loadAccount:async id=>accounts.get(id),now:()=>clock,ttlMs:100,adminTtlMs:20});
 return {accounts,records,sessions,advance:n=>clock+=n};
}
test('Sessions : jetons aléatoires distincts, stockage de leur empreinte uniquement',async()=>{
 const {sessions,records}=fixture();
 const a=await sessions.issue({accountId:'c',credentialVerified:true});
 const b=await sessions.issue({accountId:'c',credentialVerified:true});
 assert.match(a.token,/^[A-Za-z0-9_-]{43}$/);assert.notEqual(a.token,b.token);
 assert.equal(records.size,2);
 for(const [hash,r] of records){assert.match(hash,/^[a-f0-9]{64}$/);assert.equal(r.hash,hash);assert.ok(!JSON.stringify(r).includes(a.token));assert.ok(!JSON.stringify(r).includes(b.token));}
 assert.equal((await sessions.resolveSession(a.token)).role,'coach');
});
test('Sessions : identité réelle et preuve préalable obligatoires, MFA admin obligatoire',async()=>{
 const {sessions}=fixture();
 for(const proof of [null,{}, {accountId:'c'}, {accountId:'absent',credentialVerified:true},{accountId:'a',credentialVerified:true}])assert.equal(await sessions.issue(proof),null);
 const p=await sessions.issue({accountId:'p',credentialVerified:true,role:'admin'});
 assert.equal((await sessions.resolveSession(p.token)).role,'individual');
 const a=await sessions.issue({accountId:'a',credentialVerified:true,mfaVerified:true});
 assert.equal((await sessions.resolveSession(a.token)).role,'admin');
 assert.ok(a.expiresAt<p.expiresAt);
});
test('Sessions : expiration stricte, tokens malformés, déconnexion individuelle et globale',async()=>{
 const {sessions,advance,records}=fixture();
 const a=await sessions.issue({accountId:'a',credentialVerified:true,mfaVerified:true});
 const c=await sessions.issue({accountId:'c',credentialVerified:true});
 const c2=await sessions.issue({accountId:'c',credentialVerified:true});
 const p=await sessions.issue({accountId:'p',credentialVerified:true});
 advance(20);
 assert.equal(await sessions.resolveSession(a.token),null);
 assert.ok(await sessions.resolveSession(c.token));
 for(const t of [null,'x','a'.repeat(500),'a'.repeat(43)])assert.equal(await sessions.resolveSession(t),null);
 await sessions.revoke(c.token);assert.equal(await sessions.resolveSession(c.token),null);
 assert.ok(await sessions.resolveSession(c2.token));
 await sessions.revokeAccount('c');assert.equal(await sessions.resolveSession(c2.token),null);
 assert.ok(await sessions.resolveSession(p.token));
 advance(80);assert.equal(await sessions.resolveSession(p.token),null);assert.equal(records.size,0);
});
test('Sessions : suspension, suppression, changement de rôle et révocation du club',async()=>{
 const {sessions,accounts}=fixture();
 const c=await sessions.issue({accountId:'c',credentialVerified:true});
 const guard=createRequestGuard({resolveSession:sessions.resolveSession,resolveScope:async()=>({clubId:'club-a'})});
 const request={sessionToken:c.token,route:{resource:'attendance',action:'read'},resourceId:'entry'};
 assert.equal((await guard(request)).status,200);
 accounts.get('c').clubIds=[];assert.equal((await guard(request)).status,403);
 accounts.get('c').status='suspended';assert.equal((await guard(request)).status,401);
 accounts.get('c').status='active';assert.equal(await sessions.resolveSession(c.token),null);
 const p=await sessions.issue({accountId:'p',credentialVerified:true});
 accounts.get('p').role='admin';assert.equal(await sessions.resolveSession(p.token),null);
 accounts.get('p').role='individual';
 const p2=await sessions.issue({accountId:'p',credentialVerified:true});
 accounts.delete('p');assert.equal(await sessions.resolveSession(p2.token),null);
});
test('Sessions : dépendances et durées invalides refusées',()=>{
 assert.throws(()=>createSessions({}),TypeError);
 const store={insert(){},find(){},remove(){},removeAccount(){}},loadAccount=()=>null;
 assert.throws(()=>createSessions({store,loadAccount,ttlMs:0}),RangeError);
 assert.throws(()=>createSessions({store,loadAccount,ttlMs:10,adminTtlMs:11}),RangeError);
});
