'use strict';
const http=require('node:http');
const {isIP}=require('node:net');
const {timingSafeEqual}=require('node:crypto');
const {mkdtemp,rm}=require('node:fs/promises');
const {tmpdir}=require('node:os');
const {join,isAbsolute}=require('node:path');
const {createAuthRuntime}=require('./auth-runtime.cjs');
const {createPreproductionHandler}=require('./preproduction-http.cjs');
const {build}=require('../scripts/build-auth-preview.cjs');
function readConfig(env){
 if(env.JSB_ENV!=='preproduction')throw Error('Mode préproduction explicite requis');
 function origin(name){
  const v=env[name];if(typeof v!=='string')throw Error('Origine manquante');
  const u=new URL(v);if(u.protocol!=='https:'||u.origin!==v)throw Error('Origine HTTPS exacte requise');return u;
 }
 const pub=origin('JSB_PUBLIC_ORIGIN'),adm=origin('JSB_ADMIN_ORIGIN');
 if(pub.hostname===adm.hostname)throw Error('Hôtes distincts requis');
 const db=new URL(env.DATABASE_URL);
 if(!['postgres:','postgresql:'].includes(db.protocol)||db.pathname!=='/jsb_preprod')throw Error('Base dédiée jsb_preprod requise');
 function secret(name){
  const v=env[name];if(typeof v!=='string'||!(/^[A-Za-z0-9_-]{43}$/).test(v))throw Error('Clé manquante ou invalide');
  const b=Buffer.from(v,'base64url');if(b.length!==32||b.toString('base64url')!==v)throw Error('Clé invalide');return b;
 }
 const quotaSecret=secret('JSB_QUOTA_KEY'),delivery=secret('JSB_DELIVERY_KEY'),mfa=secret('JSB_MFA_KEY'),gateway=secret('JSB_GATEWAY_KEY');
 const keys=[quotaSecret,delivery,mfa,gateway];for(let i=0;i<keys.length;i++)for(let j=0;j<i;j++)if(timingSafeEqual(keys[i],keys[j]))throw Error('Clés indépendantes requises');
 function keyset(name,key){const id=env[name];if(typeof id!=='string'||!(/^[A-Za-z0-9_-]{1,64}$/).test(id))throw Error('Version de clé requise');return {activeKeyId:id,loadKey:async k=>k===id?key:undefined};}
 const port=Number(env.JSB_PORT||'8080');if(!Number.isInteger(port)||port<1||port>65535)throw Error('Port invalide');
 const xlsxPython=env.JSB_XLSX_PYTHON;
 if(xlsxPython!==undefined&&(typeof xlsxPython!=='string'||!isAbsolute(xlsxPython)))throw Error('Interpréteur Python XLSX absolu requis');
 return {xlsxPython,publicOrigin:pub.origin,adminOrigin:adm.origin,databaseUrl:env.DATABASE_URL,quotaSecret,deliveryKeys:keyset('JSB_DELIVERY_KEY_ID',delivery),mfaKeys:keyset('JSB_MFA_KEY_ID',mfa),gateway,port};
}
// A trusted local TLS gateway must authenticate the tester, strip these headers
// from untrusted input and inject its own proof and verified client IP.
// Never bind this HTTP listener to an external interface.
function gatewayAccess(key,req){
 if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress))return null;
 const proof=req.headers['x-jsb-gateway-proof'],ip=req.headers['x-jsb-client-ip'];
 if(typeof proof!=='string'||!(/^[A-Za-z0-9_-]{43}$/).test(proof)||typeof ip!=='string'||!isIP(ip))return null;
 const b=Buffer.from(proof,'base64url');
 if(b.length!==32||b.toString('base64url')!==proof||!timingSafeEqual(key,b))return null;
 return ip;
}
async function createServer({config,pool}){
 if((await pool.query('SELECT current_database() AS name')).rows[0]?.name!=='jsb_preprod')throw Error('Base dédiée requise');
 const runtime=createAuthRuntime({...config,pool,sourceId:req=>gatewayAccess(config.gateway,req)});
 await runtime.checkReady();
 const dir=await mkdtemp(join(tmpdir(),'jsb-preprod-'));
 try{
  const handlers=new Map();
  for(const [app,origin,authHandler] of [['public',config.publicOrigin,runtime.publicHandler],['admin',config.adminOrigin,runtime.adminHandler]]){
   const directory=join(dir,app);await build(app,directory);
   handlers.set(new URL(origin).host,await createPreproductionHandler({app,origin,directory,authHandler,authorizeAccess:req=>gatewayAccess(config.gateway,req)!==null}));
  }
  const server=http.createServer({requestTimeout:15000,headersTimeout:10000,maxHeaderSize:8192,keepAliveTimeout:5000},(req,res)=>{
   const handler=handlers.get(req.headers.host);
   if(!handler){res.writeHead(421,{'Cache-Control':'no-store'});res.end();return;}
   void handler(req,res);
  });
  server.maxRequestsPerSocket=100;
  return {server,dispose:async()=>{if(server.listening){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}await rm(dir,{recursive:true,force:true});}};
 }catch(e){await rm(dir,{recursive:true,force:true});throw e;}
}
async function main(){
 const config=readConfig(process.env),{Pool}=require('pg');
 const pool=new Pool({connectionString:config.databaseUrl,max:8,connectionTimeoutMillis:5000,statement_timeout:10000});
 let instance;
 try{
  instance=await createServer({config,pool});
  await new Promise((resolve,reject)=>{instance.server.once('error',reject);instance.server.listen(config.port,'127.0.0.1',resolve);});
  console.log('JSB préproduction : passerelle locale requise, port '+config.port);
  let closing=false;
  const stop=async()=>{if(closing)return;closing=true;try{await instance.dispose();await pool.end();}catch{process.exitCode=1;}};
  process.once('SIGTERM',()=>void stop());process.once('SIGINT',()=>void stop());
 }catch(e){if(instance)await instance.dispose();await pool.end();throw e;}
}
if(require.main===module)main().catch(()=>{console.error('Démarrage refusé : configuration ou base de préproduction indisponible.');process.exitCode=1;});
module.exports=Object.freeze({readConfig,gatewayAccess,createServer});
