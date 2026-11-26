'use strict';
// A non-destructive preflight for the two private preproduction origins.
// Does not provision hosting, open public ports, create accounts or publish data.
const http=require('node:http');
const {execFile}=require('node:child_process');
const {createServer,readConfig}=require('../backend/preproduction-server.cjs');
async function checkPython(executable){
 if(!executable)return false;
 await new Promise((resolve,reject)=>execFile(executable,['-I','-B','-c','import openpyxl, defusedxml'],{
  timeout:5000,maxBuffer:16384,env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8'}
 },error=>error?reject(Error('Lecteur Excel non disponible')):resolve()));
 return true;
}
async function preflight({config,pool}){
 let instance;
 try{
  const excel=await checkPython(config.xlsxPython);
  instance=await createServer({config,pool});
  const server=instance.server;
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const proof=config.gateway.toString('base64url'),port=server.address().port;
  const checks=[];
  async function check(host,path,expected,{method='GET',authorized=true,origin,location}={}){
   const response=await new Promise((resolve,reject)=>{
    const req=http.request({hostname:'127.0.0.1',port,path,method,headers:{Host:host,
     ...(authorized?{'x-jsb-gateway-proof':proof,'x-jsb-client-ip':'192.0.2.10'}:{}),
     ...(origin?{Origin:origin}:{}),
     ...(method==='POST'?{'Content-Type':'application/json','Content-Length':2}:{})}},res=>{
      res.resume();res.on('end',()=>resolve({status:res.statusCode,headers:res.headers}));
    });
    req.setTimeout(5000,()=>req.destroy(Error('Délai dépassé')));
    req.on('error',reject);req.end(method==='POST'?'{}':undefined);
   });
   if(response.status!==expected||!String(response.headers['cache-control']||'').includes('no-store')||
      (location!==undefined&&response.headers.location!==location))throw Error('Contrôle HTTP refusé : '+path);
   checks.push({path,expected,passed:true});
  }
  for(const [app,origin,other] of [['public',config.publicOrigin,'admin'],['admin',config.adminOrigin,'public']]){
   const host=new URL(origin).host;
   await check(host,'/',403,{authorized:false});
   await check(host,'/',302,{location:'/'+app+'/auth.html'});
   await check(host,'/'+app+'/auth.html',200);
   await check(host,'/'+other+'/auth.html',404);
   await check(host,'/shared/auth-client.mjs',200);
   await check(host,'/manifest.json',404);
   await check(host,'/backend/auth-runtime.cjs',404);
   await check(host,'/api/session',401);
   await check(host,'/api/admin/catalogue/publish',404,{method:'POST',origin});
   await check(host,'/api/admin/catalogue/restore',404,{method:'POST',origin});
   if(app==='public')await check(host,'/api/admin/catalogue/history',404,{method:'POST',origin});
   else await check(host,'/api/generator/taiso/candidates',404,{method:'POST',origin});
  }
  await check('unconfigured.invalid','/',421);
  return {readyForPrivatePreview:true,excelReader:excel,checks:checks.length,
   externalHttpsVerified:false,productionReady:false};
 }finally{if(instance)await instance.dispose();}
}
async function main(){
 const config=readConfig(process.env),{Pool}=require('pg');
 const pool=new Pool({connectionString:config.databaseUrl,max:2,connectionTimeoutMillis:5000,statement_timeout:10000});
 try{const result=await preflight({config,pool});console.log(JSON.stringify(result,null,2));}
 finally{await pool.end();}
}
if(require.main===module)main().catch(()=>{console.error('Prévol refusé : vérifier configuration, schéma, lecteur Excel et séparation des origines.');process.exitCode=1;});
module.exports=Object.freeze({preflight,checkPython});
