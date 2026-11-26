'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomBytes}=require('node:crypto');
const {createAdminRecovery}=require('../backend/admin-recovery.cjs');
const {createLoginService}=require('../backend/login-service.cjs');
function fixture(){
 const token=randomBytes(32).toString('base64url');
 const proof={id:'proof',accountId:'a',factorVersion:'v1',role:'admin',status:'active',emailVerified:true,purpose:'admin-recovery-provision',passwordVerified:true,totpVerified:true,issuedAt:1000,expiresAt:2000};
 let hashes=new Set(),used=false,version='v1',active=true,issues=0;
 const limiter={reserve:async()=>true};
 const recovery=createAdminRecovery({secret:Buffer.alloc(32,9),now:()=>1000,limiter,
 resolveProof:async t=>t===token&&!used?proof:null,
 replaceCodes:async r=>{if(used||!active||r.accountId!=='a'||r.factorVersion!==version)return false;used=true;hashes=new Set(r.hashes);return true;},
 loadFactor:async id=>id==='a'?{enabled:active,version}:null,
 consumeCode:async r=>active&&r.accountId==='a'&&r.factorVersion===version&&hashes.delete(r.hash)});
 const login=createLoginService({limiter,verifyMfa:async()=>false,verifyRecovery:recovery.verifyRecovery,checkPassword:async p=>p==='Phrase de passe valide !',findAccountByEmail:async e=>e==='admin@example.test'?{id:'a',role:'admin',status:'active',emailVerified:true}:null,sessions:{issue:async()=>{issues++;return {token:'test-session',expiresAt:9999};}}});
 return {token,proof,recovery,login,get hashes(){return hashes;},get issues(){return issues;},rotate:()=>version='v2',suspend:()=>active=false};
}
test('Secours : dix codes uniques, empreintes seules et consommation concurrente unique',async()=>{
 const f=fixture(),r=await f.recovery.provision(f.token,'source');
 assert.equal(r.status,200);assert.equal(new Set(r.codes).size,10);assert.equal(f.hashes.size,10);
 for(const c of r.codes){assert.match(c,/^[A-F0-9]{8}(?:-[A-F0-9]{8}){3}$/);assert.equal(f.hashes.has(c),false);}
 const results=await Promise.all(Array.from({length:5},()=>f.recovery.verifyRecovery('a',r.codes[0].toLowerCase())));
 assert.equal(results.filter(Boolean).length,1);assert.equal(f.hashes.size,9);
 assert.equal((await f.recovery.provision(f.token,'source')).status,401);
});
test('Secours : génération refusée sans preuve récente de mot de passe et TOTP',async()=>{
 for(const patch of [{role:'coach'},{role:'individual'},{totpVerified:false},{passwordVerified:false},{expiresAt:1000},{purpose:'login'},{status:'suspended'}]){
  const f=fixture();Object.assign(f.proof,patch);assert.equal((await f.recovery.provision(f.token,'source')).status,401);
 }
});
test('Secours : connexion exige le mot de passe et consomme le code une fois',async()=>{
 const f=fixture(),r=await f.recovery.provision(f.token,'source'),code=r.codes[0];
 const req={email:'admin@example.test',password:'Phrase de passe valide !',sourceId:'source',mfaCode:code};
 assert.equal((await f.login.login({...req,password:'Mauvaise phrase de passe !'})).status,401);assert.equal(f.hashes.size,10);
 assert.equal((await f.login.login(req)).status,200);assert.equal(f.hashes.size,9);
 assert.equal((await f.login.login(req)).status,401);assert.equal(f.issues,1);
});
test('Secours : isolation de compte, rotation du facteur et suspension',async()=>{
 const f=fixture(),r=await f.recovery.provision(f.token,'source');
 assert.equal(await f.recovery.verifyRecovery('other',r.codes[0]),false);
 f.rotate();assert.equal(await f.recovery.verifyRecovery('a',r.codes[0]),false);
 f.suspend();assert.equal(await f.recovery.verifyRecovery('a',r.codes[1]),false);
});
