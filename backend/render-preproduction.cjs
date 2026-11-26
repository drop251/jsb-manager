'use strict';
const http=require('node:http');
const {timingSafeEqual,createHash}=require('node:crypto');
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
function createGateway({config,host,gateDigest}){
 return http.createServer({requestTimeout:20000,headersTimeout:10000,maxHeaderSize:8192,keepAliveTimeout:5000},(req,res)=>{
  function reply(status,body='',headers={}){res.writeHead(status,{'Cache-Control':'no-store','Content-Type':'text/plain; charset=utf-8','X-Content-Type-Options':'nosniff',...headers});res.end(req.method==='HEAD'?undefined:body);}
  if(req.url==='/healthz'&&(req.method==='GET'||req.method==='HEAD'))return reply(200,'OK');
  if(req.headers.host!==host)return reply(421);
  if(!['GET','HEAD','POST'].includes(req.method)||typeof req.url!=='string'||!req.url.startsWith('/')||req.url.startsWith('//'))return reply(400);
  const authorization=typeof req.headers.authorization==='string'?req.headers.authorization:'';
  if(!timingSafeEqual(createHash('sha256').update(authorization).digest(),gateDigest))return reply(401,'Préproduction privée.',{'WWW-Authenticate':'Basic realm="JSB preproduction", charset="UTF-8"'});
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
