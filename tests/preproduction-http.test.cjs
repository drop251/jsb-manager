'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {build}=require('../scripts/build-auth-preview.cjs');
const {createPreproductionHandler}=require('../backend/preproduction-http.cjs');
test('Préproduction : origine, contrôle d’accès, intégrité et fichiers strictement isolés',async()=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'jsb-preprod-'));
 const servers=[],releases=new Set();
 try{
  for(const app of ['public','admin']){
   const directory=path.join(temp,app);
   await build(app,directory);
   const server=http.createServer((req,res)=>handler(req,res));servers.push(server);
   await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
   const host='127.0.0.1:'+server.address().port,origin='https://'+host;
   let apiCalls=0,access=true;
   const otherOrigin=app==='admin'?'https://coach.example.test':'https://admin.example.test';
   const options={app,origin,otherOrigin,directory,authorizeAccess:async()=>access,authHandler:async(req,res)=>{apiCalls++;res.writeHead(401,{'Cache-Control':'no-store'});res.end();}};
   const handler=await createPreproductionHandler(options);
   function request(url,{method='GET',headers={}}={}){
    return new Promise((resolve,reject)=>{
     const req=http.request({hostname:'127.0.0.1',port:server.address().port,path:url,method,headers:{Host:host,...headers}},res=>{
      let body='';res.setEncoding('utf8');res.on('data',x=>body+=x);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body}));
     });req.on('error',reject);req.end();
    });
   }
   const entry='/'+app+'/auth.html',other=app==='public'?'admin':'public';
   access=false;
   for(const url of ['/',entry,'/api/session','/switch-workspace'])assert.equal((await request(url)).status,403);
   const refusal=await request(entry);
   assert.equal(refusal.body,'Accès refusé.');
   assert.match(refusal.headers['content-type'],/^text\/plain/);
   assert.match(refusal.headers['cache-control'],/no-store/);
   assert.equal((await request(entry,{method:'HEAD'})).body,'');
   assert.equal((await request('/api/session')).body,'');
   assert.equal(apiCalls,0);
   access=true;
   assert.equal((await request(entry,{headers:{Host:'wrong.test'}})).status,421);
   const redirect=await request('/');assert.equal(redirect.status,302);assert.equal(redirect.headers.location,entry);
   const switched=await request('/switch-workspace');
   assert.equal(switched.status,302);
   assert.equal(switched.headers.location,otherOrigin+'/'+other+'/auth.html');
   assert.equal(switched.headers['set-cookie'],undefined);
   assert.match(switched.headers['cache-control'],/no-store/);
   assert.equal(switched.headers['referrer-policy'],'no-referrer');
   assert.equal((await request('/switch-workspace?next=https://evil.test')).status,404);
   assert.equal((await request('/switch-workspace',{method:'POST'})).status,405);
   assert.equal(apiCalls,0);
   for(const invalid of ['http://other.test','https://other.test/path',origin])await assert.rejects(createPreproductionHandler({...options,otherOrigin:invalid}),TypeError);
   const html=await request(entry);assert.equal(html.status,200);assert.match(html.headers['cache-control'],/no-store/);
   assert.match(html.headers['x-jsb-release'],/^[a-f0-9]{64}$/);
   assert.ok(html.body.includes('<meta name="jsb-release" content="'+html.headers['x-jsb-release']+'">'));
   const head=await request(entry,{method:'HEAD'});
   assert.equal(head.headers['x-jsb-release'],html.headers['x-jsb-release']);
   assert.match(head.headers['cache-control'],/no-store/);
   releases.add(head.headers['x-jsb-release']);
   access=false;assert.equal((await request(entry,{method:'HEAD'})).headers['x-jsb-release'],undefined);access=true;
   assert.match(html.headers['content-security-policy'],/frame-ancestors 'none'/);
   assert.doesNotMatch(html.headers['content-security-policy'],/unsafe-eval/);
   assert.equal(html.body.includes('id="mfa"'),app==='admin');
   assert.match(html.body,/href="\/switch-workspace" target="_blank" rel="noopener noreferrer"/);
   assert.equal((await request(entry,{method:'HEAD'})).body,'');
   assert.equal((await request('/shared/auth-client.mjs')).status,200);
   assert.equal((await request('/shared/edge-swipe.js')).status,200);
   for(const url of ['/shared/legal-content.mjs','/shared/legal-ui.mjs'])assert.equal((await request(url)).status,200);
   access=false;assert.equal((await request('/shared/edge-swipe.js')).status,403);access=true;
   for(const url of ['/public/offline.html','/public/offline.mjs','/public/offline-vault.mjs','/public/attendance-vault.mjs','/public/attendance-ui.mjs','/shared/attendance-sync.js','/public/offline-sw.js'])assert.equal((await request(url)).status,app==='public'?200:404);
   for(const url of ['/'+other+'/auth.html','/index.html','/manifest.json','/backend/auth-runtime.cjs','/../backend/auth-runtime.cjs','/%2e%2e/backend/auth-runtime.cjs',entry+'?x=1'])assert.equal((await request(url)).status,404);
   assert.equal((await request(entry,{method:'POST'})).status,405);
   assert.equal((await request('/api/session')).status,401);assert.equal(apiCalls,1);
   await fs.appendFile(path.join(directory,app,'auth.html'),'tamper');
   await assert.rejects(createPreproductionHandler(options),/Intégrité/);
   await assert.rejects(createPreproductionHandler({...options,authorizeAccess:undefined}),TypeError);
  }
  assert.equal(releases.size,2);
 }finally{
  for(const server of servers)await new Promise(resolve=>server.close(resolve));
  await fs.rm(temp,{recursive:true,force:true});
 }
});
