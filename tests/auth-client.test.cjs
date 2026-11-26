'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const load=()=>import('../apps/shared/auth-client.mjs');
const origin='https://manager.example.test';
const coach={id:'a',role:'coach'},individual={id:'b',role:'individual'};
function fixture(responses,{allowedRoles=['coach','individual'],locks}={}){
 const calls=[],transitions=[];
 const options={origin,allowedRoles,locks:locks===undefined?{request:async(name,options,fn)=>{transitions.push([name,options]);return fn();}}:locks,fetchImpl:async(url,options)=>{
  calls.push({url,options});const next=responses.shift();if(!next)throw Error('Requête imprévue');
  if(next instanceof Error)throw next;
  return new Response(JSON.stringify(next.body),{status:next.status,headers:{'Content-Type':next.type||'application/json'}});
 }};
 return {options,calls,transitions};
}
const ok=account=>({status:200,body:{ok:true,account}}),denied={status:401,body:{ok:false}};
test('Client : session confirmée après connexion, transport même origine et sans stockage',async()=>{
 const {createAuthClient}=await load(),f=fixture([ok(coach),ok(coach)]);
 const c=createAuthClient(f.options);
 assert.deepEqual(await c.login({email:'a@example.test',password:'secret',role:'admin',token:'fake'}),{ok:true,account:coach});
 assert.deepEqual(f.calls.map(x=>x.url),[origin+'/api/login',origin+'/api/session']);
 assert.deepEqual(JSON.parse(f.calls[0].options.body),{email:'a@example.test',password:'secret'});
 for(const {options} of f.calls){assert.equal(options.credentials,'same-origin');assert.equal(options.mode,'same-origin');assert.equal(options.cache,'no-store');assert.equal(options.redirect,'error');}
 assert.deepEqual(f.transitions,[['jsb-auth-transition-v1',{mode:'exclusive'}]]);
});
test('Client : refus de connexion, quota, déconnexion confirmée',async()=>{
 const {createAuthClient}=await load(),f=fixture([denied,{status:429,body:{ok:false}},{status:200,body:{ok:true}},denied]);
 const c=createAuthClient(f.options);
 assert.deepEqual(await c.login({}),{ok:false,status:401});
 assert.deepEqual(await c.login({}),{ok:false,status:429});
 assert.deepEqual(await c.logout(),{ok:true});
 assert.equal(f.transitions.length,3);
});
test('Client : échec fermé en cas de rôle interdit, changement concurrent ou API indisponible',async()=>{
 const {createAuthClient}=await load();
 for(const responses of [[ok({id:'z',role:'admin'})],[ok(coach),ok(individual)],[ok(coach),denied],[new Error('offline')],[{status:200,body:{ok:true,account:coach},type:'text/html'}]]){
  await assert.rejects(createAuthClient(fixture(responses).options).login({}));
 }
 const f=fixture([ok(coach)],{locks:null});
 await assert.rejects(createAuthClient(f.options).login({}),/verrouillage/);
 assert.equal(f.calls.length,0);
 assert.throws(()=>createAuthClient({...f.options,origin:'http://manager.example.test'}),TypeError);
});
test('Client : session administrateur et code MFA, refus des profils publics',async()=>{
 const {createAuthClient}=await load(),admin={id:'x',role:'admin'},f=fixture([ok(admin),ok(admin),ok(coach)],{allowedRoles:['admin']});
 const c=createAuthClient(f.options);
 assert.deepEqual(await c.login({email:'admin@example.test',password:'secret',mfaCode:'123456'}),{ok:true,account:admin});
 assert.equal(JSON.parse(f.calls[0].options.body).mfaCode,'123456');
 await assert.rejects(c.session(),/Identité/);
});
