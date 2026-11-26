'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createLoginService,normalizeEmail}=require('../backend/login-service.cjs');
const {createSessions}=require('../backend/sessions.cjs');
const {hashPassword}=require('../backend/passwords.cjs');
const {createLoginLimiter}=require('../backend/login-limiter.cjs');
const PASSWORD='Phrase de passe de test !';
function fixture(){
 const accounts=new Map([
 ['coach@example.test',{id:'coach',role:'coach',status:'active',emailVerified:true,passwordHash:'test-hash'}],
 ['person@example.test',{id:'person',role:'individual',status:'active',emailVerified:true,passwordHash:'test-hash'}],
 ['admin@example.test',{id:'admin',role:'admin',status:'active',emailVerified:true,passwordHash:'test-hash'}]]);
 const calls=[];
 const adapters={limiter:{reserve:async r=>{calls.push(['reserve',r]);return true;}},sessions:{issue:async proof=>{calls.push(['issue',proof]);return {token:'test-token',expiresAt:12345};}},findAccountByEmail:async e=>{calls.push(['lookup',e]);return accounts.get(e);},verifyMfa:async(id,code)=>{calls.push(['mfa',id]);return code==='valid-code';},checkPassword:async(p,h)=>{calls.push(['check',h]);return p===PASSWORD&&h==='test-hash';}};
 const service=createLoginService(adapters);
 return {accounts,calls,adapters,login:(email,password=PASSWORD,more={})=>service.login({email,password,sourceId:'trusted-source',...more})};
}
test('Connexion : e-mail normalisé, quotas avant accès au compte, rôle issu du serveur',async()=>{
 const {login,calls}=fixture();
 for(const email of [' COACH@example.test ','person@example.test']){
  calls.length=0;
  assert.deepEqual(await login(email,PASSWORD,{role:'admin',credentialVerified:false}),{ok:true,status:200,token:'test-token',expiresAt:12345});
  assert.deepEqual(calls.map(c=>c[0]),['reserve','lookup','check','issue']);
  assert.equal(calls[0][1].accountKey,normalizeEmail(email));
  assert.equal(calls[3][1].accountId,email.trim().toLowerCase().split('@')[0]);
  assert.equal(calls[3][1].mfaVerified,false);
 }
});
test('Connexion : erreurs identiques pour compte absent, mot de passe erroné, compte suspendu et e-mail non vérifié',async()=>{
 const {login,accounts,calls}=fixture();
 const failed={ok:false,status:401};
 assert.deepEqual(await login('missing@example.test'),failed);
 assert.deepEqual(calls.find(c=>c[0]==='check'),['check',null]);
 assert.deepEqual(await login('coach@example.test','Un mauvais mot de passe'),failed);
 accounts.get('coach@example.test').status='suspended';
 assert.deepEqual(await login('coach@example.test'),failed);
 accounts.get('person@example.test').emailVerified=false;
 assert.deepEqual(await login('person@example.test'),failed);
 assert.equal(calls.some(c=>c[0]==='issue'),false);
});
test('Connexion : administrateur sans preuve MFA ou avec code erroné refusé',async()=>{
 const {login,calls}=fixture();
 assert.deepEqual(await login('admin@example.test',PASSWORD,{mfaVerified:true}),{ok:false,status:401});
 assert.deepEqual(await login('admin@example.test',PASSWORD,{mfaCode:'bad'}),{ok:false,status:401});
 assert.equal(calls.some(c=>c[0]==='issue'),false);
 assert.equal((await login('admin@example.test',PASSWORD,{mfaCode:'valid-code'})).ok,true);
 assert.deepEqual(calls.find(c=>c[0]==='issue')[1],{accountId:'admin',credentialVerified:true,mfaVerified:true});
});
test('Connexion : quota épuisé, erreurs internes et formats invalides sans divulgation',async()=>{
 const {adapters,calls}=fixture();
 const request={email:'coach@example.test',password:PASSWORD,sourceId:'trusted-source'};
 const limited=createLoginService({...adapters,limiter:{reserve:async()=>false}});
 assert.deepEqual(await limited.login(request),{ok:false,status:429});
 assert.equal(calls.length,0);
 const broken=createLoginService({...adapters,findAccountByEmail:async()=>{throw Error('internal secret');}});
 assert.deepEqual(await broken.login(request),{ok:false,status:503});
 const service=createLoginService(adapters);
 for(const email of [null,'bad','a'.repeat(321)])assert.deepEqual(await service.login({...request,email}),{ok:false,status:401});
 assert.throws(()=>createLoginService({}),TypeError);
});
test('Connexion : intégration réelle hachage, quota et sessions avec adaptateurs mémoire de test',async()=>{
 const passwordHash=await hashPassword(PASSWORD);
 const account={id:'person',role:'individual',status:'active',emailVerified:true,passwordHash};
 const records=new Map();
 const store={insert:async r=>records.set(r.hash,r),find:async h=>records.get(h),remove:async h=>records.delete(h),removeAccount:async()=>records.clear()};
 const sessions=createSessions({store,loadAccount:async id=>id===account.id?account:null});
 const counts=new Map();
 const limiter=createLoginLimiter({secret:Buffer.alloc(32,7),accountLimit:2,store:{async reserve(quotas){if(quotas.some(q=>(counts.get(q.key)||0)>=q.limit))return false;for(const q of quotas)counts.set(q.key,(counts.get(q.key)||0)+1);return true;}}});
 const service=createLoginService({limiter,sessions,findAccountByEmail:async e=>e==='person@example.test'?account:null,verifyMfa:async()=>false});
 const req={email:'person@example.test',password:PASSWORD,sourceId:'trusted-source'};
 assert.equal((await service.login({...req,password:'Une mauvaise phrase de passe'})).status,401);
 const result=await service.login(req);assert.equal(result.ok,true);
 assert.equal((await sessions.resolveSession(result.token)).id,'person');
 assert.equal((await service.login(req)).status,429);
 await sessions.revoke(result.token);assert.equal(await sessions.resolveSession(result.token),null);
});
