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
 const url='http://127.0.0.1:'+gate.address().port;
 const request=(path,headers={})=>fetch(url+path,{headers:{Host:opts.host,...headers}});
 const auth='Basic '+Buffer.from('jsb-testeur:'+env.JSB_TESTER_SECRET).toString('base64');
 try{
  assert.equal((await request('/healthz')).status,200);
  assert.equal((await request('/admin/auth.html')).status,401);
  assert.equal((await request('/admin/auth.html',{'x-jsb-gateway-proof':'fake','x-jsb-client-ip':'8.8.8.8'})).status,401);
  assert.equal((await request('/admin/auth.html',{Authorization:auth,Host:'coach.onrender.com'})).status,421);
  assert.equal(calls,0);
  assert.equal(await (await request('/admin/auth.html',{Authorization:auth,'x-jsb-gateway-proof':'fake','x-jsb-client-ip':'8.8.8.8'})).text(),'proxy');
  assert.equal(calls,1);
 }finally{gate.closeAllConnections();upstream.closeAllConnections();await Promise.all([new Promise(ok=>gate.close(ok)),new Promise(ok=>upstream.close(ok))]);}
});
