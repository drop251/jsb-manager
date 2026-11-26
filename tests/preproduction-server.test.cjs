'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {readConfig,gatewayAccess,createServer}=require('../backend/preproduction-server.cjs');
const key=n=>Buffer.alloc(32,n).toString('base64url');
const env={JSB_ENV:'preproduction',JSB_PUBLIC_ORIGIN:'https://manager.example.test',JSB_ADMIN_ORIGIN:'https://admin.example.test',DATABASE_URL:'postgresql://test:fixture@localhost/jsb_preprod',JSB_QUOTA_KEY:key(1),JSB_DELIVERY_KEY:key(2),JSB_MFA_KEY:key(3),JSB_GATEWAY_KEY:key(4),JSB_DELIVERY_KEY_ID:'mail-ci',JSB_MFA_KEY_ID:'mfa-ci'};
test('Configuration préproduction : mode explicite, base dédiée, domaines et clés indépendantes',()=>{
 const c=readConfig(env);assert.equal(c.port,8080);assert.equal(c.gateway.length,32);
 for(const change of [{JSB_ENV:'production'},{DATABASE_URL:'postgresql://localhost/jsb_ci'},{JSB_PUBLIC_ORIGIN:'http://manager.example.test'},{JSB_ADMIN_ORIGIN:env.JSB_PUBLIC_ORIGIN},{JSB_GATEWAY_KEY:env.JSB_MFA_KEY},{JSB_QUOTA_KEY:'fake'},{JSB_PORT:'0'}])assert.throws(()=>readConfig({...env,...change}));
 const req={socket:{remoteAddress:'127.0.0.1'},headers:{'x-jsb-gateway-proof':env.JSB_GATEWAY_KEY,'x-jsb-client-ip':'192.0.2.10'}};
 assert.equal(gatewayAccess(c.gateway,req),'192.0.2.10');
 assert.equal(gatewayAccess(c.gateway,{...req,socket:{remoteAddress:'192.0.2.10'}}),null);
 for(const change of [{'x-jsb-gateway-proof':key(5)},{'x-jsb-gateway-proof':undefined},{'x-jsb-client-ip':'192.0.2.10, 192.0.2.11'}])assert.equal(gatewayAccess(c.gateway,{...req,headers:{...req.headers,...change}}),null);
});
test('Serveur : démarrage fermé et séparation des hôtes et API',async()=>{
 const config=readConfig(env);
 const pool={query:async sql=>({rows:sql.includes('current_database')?[{name:'jsb_preprod'}]:[]}),connect:async()=>{throw Error('Unexpected SQL');}};
 await assert.rejects(createServer({config,pool:{...pool,query:async()=>({rows:[{name:'production'}]})}}),/Base dédiée/);
 const instance=await createServer({config,pool});
 try{
  await new Promise(resolve=>instance.server.listen(0,'127.0.0.1',resolve));
  const call=(host,path,authorized=true)=>new Promise((resolve,reject)=>{
   const req=http.request({hostname:'127.0.0.1',port:instance.server.address().port,path,headers:{Host:host,...(authorized?{'x-jsb-gateway-proof':env.JSB_GATEWAY_KEY,'x-jsb-client-ip':'192.0.2.10'}:{})}},res=>{let body='';res.setEncoding('utf8');res.on('data',x=>body+=x);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body}));});
   req.on('error',reject);req.end();
  });
  for(const [app,host,other] of [['public','manager.example.test','admin'],['admin','admin.example.test','public']]){
   assert.equal((await call(host,'/',false)).status,403);
   assert.equal((await call(host,'/api/session',false)).status,403);
   assert.equal((await call(host,'/')).headers.location,'/'+app+'/auth.html');
   const r=await call(host,'/'+app+'/auth.html');assert.equal(r.status,200);assert.equal(r.body.includes('id="mfa"'),app==='admin');
   assert.equal((await call(host,'/'+other+'/auth.html')).status,404);
   assert.equal((await call(host,'/api/session')).status,401);
  }
  assert.equal((await call('unknown.example.test','/')).status,421);
 }finally{await instance.dispose();}
});

test('Prévol des deux distributions : séparation, accès fermé, aucune publication',async()=>{
 const {preflight}=require('../scripts/preflight-preproduction.cjs');
 const pool={query:async sql=>({rows:sql.includes('current_database')?[{name:'jsb_preprod'}]:[]}),connect:async()=>{throw Error('Unexpected SQL');}};
 const result=await preflight({config:readConfig(env),pool});
 assert.deepEqual(result,{readyForPrivatePreview:true,excelReader:false,checks:23,externalHttpsVerified:false,productionReady:false});
 await assert.rejects(preflight({config:readConfig(env),pool:{...pool,query:async()=>({rows:[{name:'wrong'}]})}}),/Base dédiée/);
});
