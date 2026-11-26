'use strict';
const http=require('node:http');
const {timingSafeEqual,createHash,createHmac}=require('node:crypto');
const {readConfig,createServer}=require('./preproduction-server.cjs');
const {migrate}=require('../scripts/render-preprod-migrate.cjs');
const MAX=6*1024*1024;
function renderConfig(env){
 if(!['admin','public'].includes(env.JSB_APP))throw Error('Application requise');
 function origin(v){const u=new URL(v);if(u.origin!==v||u.protocol!=='https:'||!u.hostname.endsWith('.onrender.com'))throw Error('Origine Render requise');return v;}
 const self=origin(env.RENDER_EXTERNAL_URL),peer=origin(env.JSB_PEER_ORIGIN);
 if(self===peer)throw Error('Origines distinctes requises');
 function key(name){const v=env[name];if(typeof v!=='string')throw Error('Secret absent');const b=Buffer.from(v,'base64');if(b.length!==32||b.toString('base64')!==v)throw Error('Secret Render invalide');return b.toString('base64url');}
 const gate=key('JSB_TESTER_SECRET');
 const config=readConfig({...env,JSB_ENV:'preproduction',JSB_PORT:'8081',JSB_PUBLIC_ORIGIN:env.JSB_APP==='public'?self:peer,JSB_ADMIN_ORIGIN:env.JSB_APP==='admin'?self:peer,JSB_QUOTA_KEY:key('JSB_QUOTA_SECRET'),JSB_DELIVERY_KEY:key('JSB_DELIVERY_SECRET'),JSB_MFA_KEY:key('JSB_MFA_SECRET'),JSB_GATEWAY_KEY:key('JSB_GATEWAY_SECRET'),JSB_DELIVERY_KEY_ID:'render-v1',JSB_MFA_KEY_ID:'render-v1'});
 const port=Number(env.PORT||10000);if(!Number.isInteger(port)||port<1||port>65535||port===config.port)throw Error('Port invalide');
 return {config,host:new URL(self).host,port,gateDigest:createHash('sha256').update('Basic '+Buffer.from('jsb-testeur:'+env.JSB_TESTER_SECRET).toString('base64')).digest()};
}
const ACCESS_COOKIE='__Host-jsb-preview';
const ACCESS_TTL=8*60*60;
function accessProof(key,host,expires){return createHmac('sha256',key).update('jsb-preview-v1\0'+host+'\0'+expires).digest('base64url');}
function validAccessCookie(req,key,host){
 const values=(req.headers.cookie||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(ACCESS_COOKIE+'='));
 if(values.length!==1)return false;
 const token=values[0].slice(ACCESS_COOKIE.length+1),m=/^(\d{10})\.([A-Za-z0-9_-]{43})$/.exec(token);
 if(!m)return false;
 const expires=Number(m[1]),now=Math.floor(Date.now()/1000);
 return expires>now&&expires<=now+ACCESS_TTL&&timingSafeEqual(Buffer.from(m[2]),Buffer.from(accessProof(key,host,expires)));
}
function accessPage(failed=false){
 return '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Accès privé JSB</title><style>body{margin:0;background:#f5f4f0;color:#242321;font:16px system-ui,-apple-system,sans-serif;min-height:100vh;display:grid;place-items:center}main{box-sizing:border-box;width:min(92vw,420px);background:white;border:1px solid #dedbd4;border-radius:20px;padding:28px}h1{font-size:25px;margin:0 0 12px}p{line-height:1.5}label{display:block;font-weight:600;margin:24px 0 8px}input,button{box-sizing:border-box;width:100%;font:inherit;padding:14px;border:1px solid #b6b1a7;border-radius:10px}button{margin-top:16px;background:#252321;color:white;font-weight:600}small{display:block;margin-top:18px;color:#625f58}</style></head><body><main><h1>JSB — Accès privé</h1><p>Préproduction réservée aux testeurs. Saisis le mot de passe d’accès Render avant de te connecter à ton compte JSB.</p>'+(failed?'<p role="alert">Mot de passe incorrect.</p>':'')+'<form method="post" action="/access"><label for="password">Mot de passe de préproduction</label><input id="password" name="password" type="password" autocomplete="current-password" maxlength="256" required><button type="submit">Accéder à JSB</button></form><small>Ce mot de passe est différent de ton mot de passe Coach ou Administrateur.</small></main></body></html>';
}
function createGateway({config,host,gateDigest}){
 return http.createServer({requestTimeout:20000,headersTimeout:10000,maxHeaderSize:8192,keepAliveTimeout:5000},(req,res)=>{
  function reply(status,body='',headers={}){res.writeHead(status,{'Cache-Control':'no-store','Content-Type':'text/plain; charset=utf-8','X-Content-Type-Options':'nosniff',...headers});res.end(req.method==='HEAD'?undefined:body);}
  if(req.url==='/healthz'&&(req.method==='GET'||req.method==='HEAD'))return reply(200,'OK');
  if(req.headers.host!==host)return reply(421);
  if(!['GET','HEAD','POST'].includes(req.method)||typeof req.url!=='string'||!req.url.startsWith('/')||req.url.startsWith('//'))return reply(400);
  function page(status,failed=false,extra={}){return reply(status,accessPage(failed),{'Content-Type':'text/html; charset=utf-8','Content-Disposition':'inline','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",'X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow',...extra});}
  const authorization=typeof req.headers.authorization==='string'?req.headers.authorization:'';
  const authorized=timingSafeEqual(createHash('sha256').update(authorization).digest(),gateDigest)||validAccessCookie(req,gateDigest,host);
  if(req.url==='/access'){
   if(req.method==='GET'||req.method==='HEAD')return authorized?reply(303,'',{'Location':'/'}):page(200);
   if(req.method!=='POST'||req.headers.origin!=='https://'+host||(req.headers['sec-fetch-site']&&req.headers['sec-fetch-site']!=='same-origin'))return reply(403);
   if(!/^application\/x-www-form-urlencoded(?:;\s*charset=utf-8)?$/i.test(req.headers['content-type']||''))return reply(415);
   const length=req.headers['content-length'];
   if(typeof length!=='string'||!/^\d+$/.test(length)||Number(length)>1024)return reply(413);
   let chunks=[],size=0;
   req.on('data',chunk=>{size+=chunk.length;if(size>1024){req.destroy();return;}chunks.push(chunk);});
   req.on('end',()=>{
    if(size>1024)return;
    const params=new URLSearchParams(Buffer.concat(chunks).toString('utf8')),password=params.get('password');
    if(params.getAll('password').length!==1||typeof password!=='string'||password.length>256)return page(403,true);
    const digest=createHash('sha256').update('Basic '+Buffer.from('jsb-testeur:'+password).toString('base64')).digest();
    if(!timingSafeEqual(digest,gateDigest))return page(403,true);
    const expires=Math.floor(Date.now()/1000)+ACCESS_TTL;
    return reply(303,'',{'Location':'/','Set-Cookie':ACCESS_COOKIE+'='+expires+'.'+accessProof(gateDigest,host,expires)+'; Path=/; Max-Age='+ACCESS_TTL+'; Secure; HttpOnly; SameSite=Lax'});
   });
   return;
  }
  if(!authorized){
   if((req.method==='GET'||req.method==='HEAD')&&!req.url.startsWith('/api/')&&/text\/html/i.test(req.headers.accept||''))return reply(303,'',{'Location':'/access','Content-Type':'text/html; charset=utf-8','Content-Disposition':'inline'});
   return reply(401,'Préproduction privée.',{'WWW-Authenticate':'Basic realm="JSB preproduction", charset="UTF-8"'});
  }
  const declared=req.headers['content-length'];
  if(declared!==undefined&&(!/^\d+$/.test(declared)||Number(declared)>MAX))return reply(413);
  const headers={host,'x-jsb-gateway-proof':config.gateway.toString('base64url'),'x-jsb-client-ip':'127.0.0.1'};
  // No forwarding of client-controlled proxy proofs or authorization.
  // Shared conservative quota source: do not infer client IP from arbitrary headers.
  for(const name of ['origin','cookie','sec-fetch-site','content-type','content-length','accept','referer','user-agent'])if(typeof req.headers[name]==='string')headers[name]=req.headers[name];
  const upstream=http.request({hostname:'127.0.0.1',port:config.port,path:req.url,method:req.method,headers,timeout:18000},up=>{
   res.writeHead(up.statusCode,up.headers);up.on('error',()=>res.destroy());up.pipe(res);
  });
  upstream.on('timeout',()=>upstream.destroy());
  upstream.on('error',()=>{if(!res.headersSent)reply(503,'Service indisponible.');else res.destroy();});
  let bytes=0;
  req.on('data',chunk=>{bytes+=chunk.length;if(bytes>MAX){if(!res.headersSent)reply(413);else res.destroy();upstream.destroy();req.destroy();}});
  req.on('aborted',()=>upstream.destroy());res.on('close',()=>upstream.destroy());
  req.pipe(upstream);
 });
}
async function main(){
 const opts=renderConfig(process.env),{Pool}=require('pg');
 const pool=new Pool({connectionString:opts.config.databaseUrl,max:4,connectionTimeoutMillis:10000,statement_timeout:30000});
 let instance,gateway;
 try{
  await migrate(pool);
  if(process.env.JSB_TEST_PAIR_BUNDLE!==undefined){
   if(process.env.JSB_APP!=='admin')throw Error('Amorçage réservé au serveur Admin');
   const {initializeTestPair}=require('./render-test-pair.cjs');
   let state;
   try{state=await initializeTestPair({pool,mfaKeys:opts.config.mfaKeys,bundle:process.env.JSB_TEST_PAIR_BUNDLE});}
   catch(e){
    const codes=new Set(['BUNDLE_SIZE','BUNDLE_JSON','BUNDLE_SCHEMA','BUNDLE_EMAILS','BUNDLE_PASSWORD_HASH','BUNDLE_TOTP','DB_CONNECT','DB_TRANSACTION','DB_LOCK','DB_RECEIPT','ALREADY_CONSUMED','DB_ACCOUNT_CHECK','ACCOUNTS_EXIST','MFA_ENCRYPTION','DB_INSERT_ACCOUNTS','DB_INSERT_MFA','DB_FINALIZE']);
    console.error('JSB amorçage refusé : '+(codes.has(e?.jsbBootstrapCode)?e.jsbBootstrapCode:'UNKNOWN'));
    throw Error('Amorçage refusé');
   }
   console.log(state==='created'?'JSB : deux comptes de test initialisés.':'JSB : amorçage déjà consommé.');
  }
  instance=await createServer({config:opts.config,pool});
  await new Promise((ok,ko)=>{instance.server.once('error',ko);instance.server.listen(opts.config.port,'127.0.0.1',ok);});
  gateway=createGateway(opts);
  await new Promise((ok,ko)=>{gateway.once('error',ko);gateway.listen(opts.port,'0.0.0.0',ok);});
  console.log('JSB Render : préproduction privée prête.');
  let stopping=false;const stop=async()=>{if(stopping)return;stopping=true;gateway.closeAllConnections();await new Promise(ok=>gateway.close(ok));await instance.dispose();await pool.end();};
  process.once('SIGTERM',()=>void stop());process.once('SIGINT',()=>void stop());
 }catch(e){if(gateway?.listening)gateway.close();if(instance)await instance.dispose();await pool.end();throw e;}
}
if(require.main===module)main().catch(()=>{console.error('Démarrage Render refusé : configuration ou base indisponible.');process.exitCode=1;});
module.exports={renderConfig,createGateway};
