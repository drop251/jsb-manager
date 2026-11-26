'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {createAuthHttpHandler}=require('../backend/auth-http.cjs');
const tokenA='a'.repeat(43),tokenB='b'.repeat(43),adminToken='c'.repeat(43);
async function fixture(app,run){
 const actors=new Map([[tokenA,{id:'coach-a',role:'coach',status:'active',authenticated:true}],[tokenB,{id:'individual-b',role:'individual',status:'active',authenticated:true}],[adminToken,{id:'admin-a',role:'admin',status:'active',authenticated:true}]]);
 const calls=[],revoked=[];let handler;
 const server=http.createServer((req,res)=>handler(req,res));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const host='127.0.0.1:'+server.address().port,origin='https://'+host;
 const accepted=(...args)=>{calls.push(args);return {ok:true,status:202}};
 handler=createAuthHttpHandler({app,origin,sourceId:()=> 'trusted-source',
  loginService:{login:async input=>{calls.push(['login',input]);if(input.password!=='valid')return {ok:false,status:401};return {ok:true,status:200,token:input.email==='admin@example.test'?adminToken:tokenB,expiresAt:60000};}},
  sessions:{resolveSession:async token=>actors.get(token),revoke:async token=>{revoked.push(token);actors.delete(token);}},
  registration:{register:(...args)=>accepted('register',...args)},verification:{verify:(...args)=>accepted('verify',...args)},resend:{resend:(...args)=>accepted('resend',...args)},
  passwordReset:{request:(...args)=>accepted('resetRequest',...args),confirm:(...args)=>accepted('resetConfirm',...args)},now:()=>1000});
 const request=(path,{method='GET',body,headers={}}={})=>new Promise((resolve,reject)=>{
  const data=body===undefined?undefined:typeof body==='string'?body:JSON.stringify(body);
  const req=http.request({host:'127.0.0.1',port:server.address().port,path,method,headers:{Host:host,...(method==='POST'?{Origin:origin,'Content-Type':'application/json'}:{}),...(data!==undefined?{'Content-Length':Buffer.byteLength(data)}:{}),...headers}},res=>{
   let raw='';res.setEncoding('utf8');res.on('data',c=>raw+=c);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:JSON.parse(raw)}));
  });req.on('error',reject);req.end(data);
 });
 try{await run({request,calls,revoked,origin});}finally{await new Promise(resolve=>server.close(resolve));}
}
test('HTTP public : session, changement de compte et révocation locale sans fuite du jeton',async()=>fixture('public',async({request,calls,revoked})=>{
 const headers={Cookie:'__Host-jsb-public='+tokenA};
 const before=await request('/api/session',{headers});
 assert.deepEqual(before.body,{ok:true,account:{id:'coach-a',role:'coach'}});
 assert.match(before.headers['cache-control'],/no-store/);
 const failed=await request('/api/login',{method:'POST',headers,body:{email:'b@example.test',password:'bad'}});
 assert.equal(failed.status,401);assert.deepEqual(revoked,[]);
 const switched=await request('/api/login',{method:'POST',headers,body:{email:'b@example.test',password:'valid',sourceId:'forged',role:'admin',mfaCode:'ignored'}});
 assert.equal(switched.status,200);assert.deepEqual(switched.body,{ok:true,account:{id:'individual-b',role:'individual'}});
 assert.deepEqual(calls.at(-1),['login',{email:'b@example.test',password:'valid',sourceId:'trusted-source'}]);
 assert.deepEqual(revoked,[tokenA]);
 assert.match(switched.headers['set-cookie'][0],/^__Host-jsb-public=b{43}; Path=\/; Secure; HttpOnly; SameSite=Strict; Max-Age=59$/);
 assert.equal((await request('/api/session',{headers})).status,401);
 const next={Cookie:'__Host-jsb-public='+tokenB};
 const logout=await request('/api/logout',{method:'POST',body:{},headers:next});
 assert.equal(logout.status,200);assert.match(logout.headers['set-cookie'][0],/Max-Age=0$/);
 assert.deepEqual(revoked,[tokenA,tokenB]);
}));
test('HTTP : isolation des origines, rôles, méthodes et cookies',async()=>{
 await fixture('public',async({request,calls,revoked})=>{
  assert.equal((await request('/api/session',{headers:{Cookie:'__Host-jsb-public='+adminToken}})).status,401);
  assert.equal((await request('/api/session',{headers:{Cookie:'__Host-jsb-admin='+tokenA}})).status,401);
  assert.equal((await request('/api/session',{headers:{Cookie:'__Host-jsb-public='+tokenA+'; __Host-jsb-public='+tokenB}})).status,401);
  for(const headers of [{Origin:'https://other.example'},{Origin:''},{'Sec-Fetch-Site':'same-site'},{Host:'evil.example'}]){
   const r=await request('/api/login',{method:'POST',headers,body:{}});assert.ok([403,421].includes(r.status));
  }
  assert.equal((await request('/api/login')).status,405);
  assert.equal((await request('/api/verify-email?token=secret',{method:'POST',body:{}})).status,404);
  assert.equal((await request('/api/login',{method:'POST',body:'{'})).status,400);
  assert.equal((await request('/api/login',{method:'POST',body:[],headers:{'Content-Type':'text/plain'}})).status,415);
  assert.equal((await request('/api/login',{method:'POST',body:{x:'x'.repeat(9000)}})).status,413);
  assert.deepEqual(calls,[]);assert.deepEqual(revoked,[]);
  const wrong=await request('/api/login',{method:'POST',body:{email:'admin@example.test',password:'valid'}});
  assert.equal(wrong.status,503);assert.equal(wrong.headers['set-cookie'],undefined);
 });
 await fixture('admin',async({request,calls})=>{
  assert.equal((await request('/api/session',{headers:{Cookie:'__Host-jsb-admin='+tokenA}})).status,401);
  assert.equal((await request('/api/register',{method:'POST',body:{}})).status,404);
  assert.equal((await request('/api/password-reset/request',{method:'POST',body:{}})).status,404);
  const r=await request('/api/login',{method:'POST',body:{email:'admin@example.test',password:'valid',mfaCode:'123456'}});
  assert.equal(r.status,200);assert.match(r.headers['set-cookie'][0],/^__Host-jsb-admin=/);assert.equal(calls[0][1].mfaCode,'123456');
 });
});
test('HTTP public : transmission minimale vers les services de compte',async()=>fixture('public',async({request,calls})=>{
 const inputs=[['/api/register',{email:'a@example.test',password:'valid',role:'coach',sourceId:'fake'}],['/api/verify-email',{token:tokenA}],['/api/resend-verification',{email:'a@example.test'}],['/api/password-reset/request',{email:'a@example.test'}],['/api/password-reset/confirm',{token:tokenA,password:'valid'}]];
 for(const [path,body] of inputs){const r=await request(path,{method:'POST',body});assert.equal(r.status,202);assert.deepEqual(r.body,{ok:true});assert.equal(r.headers['set-cookie'],undefined);}
 assert.deepEqual(calls,[['register',{email:'a@example.test',password:'valid',role:'coach'},'trusted-source'],['verify',tokenA,'trusted-source'],['resend','a@example.test','trusted-source'],['resetRequest','a@example.test','trusted-source'],['resetConfirm',{token:tokenA,password:'valid'},'trusted-source']]);
}));
