'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomBytes}=require('node:crypto');
const {createMfaEnrollment}=require('../backend/mfa-enrollment.cjs');
const {createMfaVault}=require('../backend/mfa-vault.cjs');
const {codeForStep,createAdminMfa}=require('../backend/admin-mfa.cjs');
function fixture(){
 let time=300000,pending=null,factor=null,revoked=0,consumed=false;
 const token=randomBytes(32).toString('base64url');
 const grant={id:'grant-a',accountId:'admin-a',email:'admin@example.test',role:'admin',status:'active',emailVerified:true,purpose:'admin-mfa-enrollment',expiresAt:time+600000};
 const vault=createMfaVault({activeKeyId:'key1',loadKey:async()=>Buffer.alloc(32,7)});
 const valid=(r)=>!consumed&&grant.role==='admin'&&grant.status==='active'&&grant.emailVerified===true&&grant.expiresAt>r.now&&r.grantId===grant.id&&r.accountId===grant.accountId;
 const adapters={vault,now:()=>time,ttlMs:60000,limiter:{reserve:async()=>true},
 resolveGrant:async t=>t===token&&!consumed?{...grant}:null,
 savePending:async r=>{if(!valid(r)||factor)return false;pending=r;return true;},
 loadPending:async r=>pending&&r.grantId===pending.grantId&&r.accountId===pending.accountId?pending:null,
 activate:async r=>{
  if(!valid(r)||factor||!pending||pending.expiresAt<=r.now||pending.factorVersion!==r.factorVersion)return false;
  factor={...pending,lastStep:r.step};pending=null;consumed=true;revoked++;return true;
 }};
 const enrollment=createMfaEnrollment(adapters);
 async function code(){const p=pending;const secret=await vault.open({accountId:p.accountId,factorVersion:p.factorVersion,envelope:p.envelope});return codeForStep(secret,Math.floor(time/30000));}
 return {token,grant,vault,adapters,enrollment,code,advance:n=>time+=n,get pending(){return pending;},get factor(){return factor;},get revoked(){return revoked;},get time(){return time;}};
}
test('Configuration MFA : autorisation dédiée, secret chiffré, activation et révocation',async()=>{
 const f=fixture();
 const b=await f.enrollment.begin(f.token,'trusted');
 assert.equal(b.ok,true);assert.equal(b.expiresAt,f.time+60000);
 assert.equal(new URL(b.uri).protocol,'otpauth:');
 assert.equal(f.pending.envelope.format,'aes-256-gcm-v1');
 assert.equal(Object.hasOwn(f.pending,'secret'),false);
 const code=await f.code();
 assert.deepEqual(await f.enrollment.confirm(f.token,code,'trusted'),{ok:true,status:200});
 assert.equal(f.revoked,1);assert.equal(f.pending,null);
 assert.equal((await f.enrollment.begin(f.token,'trusted')).status,401);
 assert.equal((await f.enrollment.confirm(f.token,code,'trusted')).status,401);
 const mfa=createAdminMfa({now:()=>f.time,loadFactor:async()=>({enabled:true,version:f.factor.factorVersion,secret:await f.vault.open({accountId:f.factor.accountId,factorVersion:f.factor.factorVersion,envelope:f.factor.envelope})}),consumeStep:async r=>r.step>f.factor.lastStep});
 assert.equal(await mfa.verifyMfa('admin-a',code),false);
});
test('Configuration MFA : rôles publics, mauvais usage du grant, suspension et e-mail non vérifié refusés',async()=>{
 for(const patch of [{role:'coach'},{role:'individual'},{status:'suspended'},{emailVerified:false},{purpose:'login'}]){
  const f=fixture();Object.assign(f.grant,patch);
  assert.equal((await f.enrollment.begin(f.token,'trusted')).status,401);
  assert.equal(f.pending,null);
 }
 const f=fixture();assert.equal((await f.enrollment.begin(randomBytes(32).toString('base64url'),'trusted')).status,401);
});
test('Configuration MFA : expiration, code invalide et confirmation concurrente unique',async()=>{
 const f=fixture();await f.enrollment.begin(f.token,'trusted');
 assert.equal((await f.enrollment.confirm(f.token,'bad','trusted')).status,400);
 const code=await f.code();f.advance(60000);
 assert.equal((await f.enrollment.confirm(f.token,code,'trusted')).status,400);
 await f.enrollment.begin(f.token,'trusted');const fresh=await f.code();
 const results=await Promise.all(Array.from({length:5},()=>f.enrollment.confirm(f.token,fresh,'trusted')));
 assert.equal(results.filter(r=>r.ok).length,1);assert.equal(f.revoked,1);
});
test('Configuration MFA : autorisation expirée et refus de remplacement d’un facteur actif',async()=>{
 const f=fixture();f.advance(600000);assert.equal((await f.enrollment.begin(f.token,'trusted')).status,401);
 const g=fixture();const denied=createMfaEnrollment({...g.adapters,savePending:async()=>false});
 assert.deepEqual(await denied.begin(g.token,'trusted'),{ok:false,status:403});
});
test('Configuration MFA : limitation des tentatives et indisponibilité sans divulgation',async()=>{
 const f=fixture();
 const limited=createMfaEnrollment({...f.adapters,limiter:{reserve:async()=>false}});
 assert.equal((await limited.begin(f.token,'trusted')).status,429);
 assert.equal((await limited.confirm(f.token,'123456','trusted')).status,429);
 const broken=createMfaEnrollment({...f.adapters,resolveGrant:async()=>{throw Error('secret interne');}});
 assert.deepEqual(await broken.begin(f.token,'trusted'),{ok:false,status:503});
 assert.throws(()=>createMfaEnrollment({}),TypeError);
});
