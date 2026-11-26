'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {renderConfig,createGateway}=require('../backend/render-preproduction.cjs');
const env={JSB_APP:'admin',RENDER_EXTERNAL_URL:'https://admin.onrender.com',JSB_PEER_ORIGIN:'https://coach.onrender.com',DATABASE_URL:'postgresql://test:test@localhost/jsb_preprod',PORT:'10000'};
for(const [i,k] of ['JSB_TESTER_SECRET','JSB_QUOTA_SECRET','JSB_DELIVERY_SECRET','JSB_MFA_SECRET','JSB_GATEWAY_SECRET'].entries())env[k]=Buffer.alloc(32,i+1).toString('base64');
test('Render : origines et clés indépendantes, base de recette obligatoire',()=>{
 const opts=renderConfig(env);
 assert.equal(opts.config.adminOrigin,env.RENDER_EXTERNAL_URL);
 assert.equal(opts.config.publicOrigin,env.JSB_PEER_ORIGIN);
 assert.throws(()=>renderConfig({...env,JSB_PEER_ORIGIN:env.RENDER_EXTERNAL_URL}));
 assert.throws(()=>renderConfig({...env,DATABASE_URL:'postgresql://test:test@localhost/production'}));
 assert.throws(()=>renderConfig({...env,JSB_MFA_SECRET:env.JSB_QUOTA_SECRET}));
 assert.throws(()=>renderConfig({...env,JSB_TESTER_SECRET:''}));
});
test('Render : passerelle privée, refus des preuves injectées, hôte unique',async()=>{
 const opts=renderConfig(env);let calls=0;
 const upstream=http.createServer((req,res)=>{calls++;assert.equal(req.headers.host,opts.host);assert.equal(req.headers['x-jsb-gateway-proof'],opts.config.gateway.toString('base64url'));assert.equal(req.headers['x-jsb-client-ip'],'127.0.0.1');assert.equal(req.headers.authorization,undefined);res.end('proxy');});
 await new Promise(ok=>upstream.listen(0,'127.0.0.1',ok));opts.config.port=upstream.address().port;
 const gate=createGateway(opts);await new Promise(ok=>gate.listen(0,'127.0.0.1',ok));
 // Use an actual HTTP request: Fetch/Undici may normalize or replace Host.
 const request=(path,headers={},method='GET',body)=>new Promise((resolve,reject)=>{
  const req=http.request({hostname:'127.0.0.1',port:gate.address().port,path,method,headers:{Host:opts.host,...headers}},res=>{
   let body='';res.setEncoding('utf8');res.on('data',chunk=>body+=chunk);
   res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text:async()=>body}));res.on('error',reject);
  });
  req.on('error',reject);req.end(body);
 });
 const auth='Basic '+Buffer.from('jsb-testeur:'+env.JSB_TESTER_SECRET).toString('base64');
 try{
  assert.equal((await request('/healthz')).status,200);
  assert.equal((await request('/admin/auth.html')).status,401);
  assert.equal((await request('/admin/auth.html',{'x-jsb-gateway-proof':'fake','x-jsb-client-ip':'8.8.8.8'})).status,401);
  assert.equal((await request('/admin/auth.html',{Authorization:auth,Host:'coach.onrender.com'})).status,421);
  assert.equal(calls,0);
  assert.equal(await (await request('/admin/auth.html',{Authorization:auth,'x-jsb-gateway-proof':'fake','x-jsb-client-ip':'8.8.8.8'})).text(),'proxy');
  assert.equal(calls,1);
  const nav=await request('/admin/auth.html',{Accept:'text/html'});
  assert.equal(nav.status,303);assert.equal(nav.headers.location,'/access');
  const login=await request('/access',{Accept:'text/html'});
  assert.equal(login.status,200);assert.match(login.headers['content-type'],/^text\/html/);assert.equal(login.headers['content-disposition'],'inline');
  assert.match(await login.text(),/<form method="post" action="\/access">/);
  const post=(password,origin='https://'+opts.host)=>{const body=new URLSearchParams({password}).toString();return request('/access',{Origin:origin,'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(body)},'POST',body);};
  assert.equal((await post('incorrect')).status,403);
  assert.equal((await post(env.JSB_TESTER_SECRET,'https://coach.onrender.com')).status,403);
  const success=await post(env.JSB_TESTER_SECRET);assert.equal(success.status,303);
  const setCookie=success.headers['set-cookie'][0];assert.match(setCookie,/; Secure; HttpOnly; SameSite=Lax/);
  const cookie=setCookie.split(';')[0];
  assert.equal((await request('/admin/auth.html',{Cookie:cookie+'x',Accept:'text/html'})).status,303);
  assert.equal(await (await request('/admin/auth.html',{Cookie:cookie})).text(),'proxy');
  assert.equal(calls,2);
 }finally{gate.closeAllConnections();upstream.closeAllConnections();await Promise.all([new Promise(ok=>gate.close(ok)),new Promise(ok=>upstream.close(ok))]);}
});
