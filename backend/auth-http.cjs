'use strict';
// Separate HTTPS origins, same-origin API, no CORS. Deploy behind a trusted
// TLS terminator which enforces host and request size/time limits. The source
// address resolver must be configured for that proxy; never trust client headers.
const {createHash}=require('node:crypto');
const TOKEN=/^[A-Za-z0-9_-]{43}$/;
const MAX_BODY=8192;
class HttpError extends Error{constructor(status){super('Requête refusée');this.status=status;}}
function createAuthHttpHandler({app,origin,loginService,sessions,sourceId,registration,verification,resend,passwordReset,catalogue,catalogueImport,cataloguePublish,now=Date.now}={}){
 if(!['public','admin'].includes(app)||typeof origin!=='string'||typeof sourceId!=='function'||typeof now!=='function'||typeof loginService?.login!=='function'||!['resolveSession','revoke'].every(k=>typeof sessions?.[k]==='function'))throw TypeError('Configuration HTTP requise');
 const u=new URL(origin);
 if(u.protocol!=='https:'||u.origin!==origin||u.username||u.password)throw TypeError('Origine HTTPS exacte requise');
 if(app==='public'&&[registration?.register,verification?.verify,resend?.resend,passwordReset?.request,passwordReset?.confirm].some(fn=>typeof fn!=='function'))throw TypeError('Services publics requis');
 const cookieName=app==='public'?'__Host-jsb-public':'__Host-jsb-admin';
 const roles=new Set(app==='public'?['coach','individual']:['admin']);
 const paths=new Map([['/api/session','GET'],['/api/login','POST'],['/api/logout','POST']]);
 if(app==='public')for(const p of ['/api/register','/api/verify-email','/api/resend-verification','/api/password-reset/request','/api/password-reset/confirm'])paths.set(p,'POST');
 const cataloguePaths=new Map([['/api/catalogue/judo','judo'],['/api/catalogue/taiso','taiso']]);
 const catalogueSearchPaths=new Map([['/api/catalogue/judo/search','judo'],['/api/catalogue/taiso/search','taiso']]);
 const catalogueDetailPaths=new Map([['/api/catalogue/judo/detail','judo'],['/api/catalogue/taiso/detail','taiso']]);
 if(catalogue!==undefined){if(typeof catalogue?.read!=='function'||typeof catalogue?.search!=='function'||typeof catalogue?.detail!=='function')throw TypeError('Service catalogue invalide');for(const path of cataloguePaths.keys())paths.set(path,'GET');for(const path of catalogueSearchPaths.keys())paths.set(path,'POST');for(const path of catalogueDetailPaths.keys())paths.set(path,'POST');}
 const importPath='/api/admin/catalogue/analyze';
 if(catalogueImport!==undefined){
  if(app!=='admin'||typeof catalogueImport!=='function')throw TypeError('Analyse de catalogue réservée à l’administration');
  paths.set(importPath,'POST');
 }
 const publishPath='/api/admin/catalogue/publish';
 if(cataloguePublish!==undefined){
  if(app!=='admin'||typeof cataloguePublish!=='function')throw TypeError('Publication administrative uniquement');
  paths.set(publishPath,'POST');
 }
 const cookie=(value,age)=>cookieName+'='+value+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age='+age;
 function readToken(req){
  const values=(req.headers.cookie||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(cookieName+'='));
  if(values.length!==1)return null;
  const value=values[0].slice(cookieName.length+1);
  return TOKEN.test(value)?value:null;
 }
 async function actorFor(token){
  if(!token)return null;
  const a=await sessions.resolveSession(token);
  return a&&a.authenticated===true&&a.status==='active'&&typeof a.id==='string'&&a.id&&roles.has(a.role)?a:null;
 }
 async function json(req,maxBody=MAX_BODY){
  if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type']||''))throw new HttpError(415);
  const length=req.headers['content-length'];
  if(length!==undefined&&(!/^\d+$/.test(length)||Number(length)>maxBody))throw new HttpError(413);
  let n=0;const chunks=[];
  // Do not destroy the request on overflow before a response can be sent.
  for await(const chunk of req.iterator({destroyOnReturn:false})){
   n+=chunk.length;if(n>maxBody)throw new HttpError(413);chunks.push(chunk);
  }
  let value;
  try{value=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch(_){throw new HttpError(400);}
  if(!value||typeof value!=='object'||Array.isArray(value))throw new HttpError(400);
  return value;
 }
 function send(res,status,data,extra={}){
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, private','Pragma':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'",...extra});
  res.end(JSON.stringify(data));
 }
 const permitted=new Set([200,202,400,401,403,409,429,503]);
 function serviceResult(res,result){
  if(!result||!permitted.has(result.status)||typeof result.ok!=='boolean'||result.ok!==(result.status===200||result.status===202))throw Error('Résultat service invalide');
  send(res,result.status,{ok:result.ok});
 }
 return async function authHttp(req,res){
  try{
   if(req.headers.host!==u.host)return send(res,421,{ok:false});
   // Exact path only: never accept query-string tokens or path normalization.
   const method=paths.get(req.url);
   if(!method)return send(res,404,{ok:false});
   if(req.method!==method)return send(res,405,{ok:false},{Allow:method});
   const site=req.headers['sec-fetch-site'];
   if((site&&site!=='same-origin')||(req.headers.origin&&req.headers.origin!==origin))return send(res,403,{ok:false});
   if(method==='POST'&&req.headers.origin!==origin)return send(res,403,{ok:false});
   const oldToken=readToken(req);
   if(req.url==='/api/session'){
    const actor=await actorFor(oldToken);
    return actor?send(res,200,{ok:true,account:{id:actor.id,role:actor.role}}):send(res,401,{ok:false});
   }
   if(cataloguePaths.has(req.url)){
    const actor=await actorFor(oldToken);
    if(!actor)return send(res,401,{ok:false});
    const result=await catalogue.read(actor,cataloguePaths.get(req.url));
    if(result?.status!==200||result.ok!==true)return serviceResult(res,result);
    return send(res,200,{ok:true,catalogue:result.catalogue});
   }
   if(req.url===importPath||req.url===publishPath){
    const actor=await actorFor(oldToken);
    if(!actor)return send(res,401,{ok:false});
    const source=await sourceId(req);
    if(typeof source!=='string'||!source.trim()||source.length>256)throw Error('Source indisponible');
    const body=await json(req,8*1024*1024);
    const sessionHash=createHash('sha256').update(oldToken,'utf8').digest('hex');
    const result=await (req.url===publishPath?cataloguePublish:catalogueImport)(actor,body,source,sessionHash);
    // Publication is already committed atomically if successful. Do not mask
    // an acknowledged commit by checking a subsequently expired session.
    if(req.url===publishPath){
     if(result.status!==200)return serviceResult(res,result);
     return send(res,200,{ok:true,publication:result.publication});
    }
    const confirmed=await actorFor(oldToken);
    if(!confirmed||confirmed.id!==actor.id||confirmed.role!==actor.role)return send(res,401,{ok:false});
    if(result.status!==200)return serviceResult(res,result);
    return send(res,200,{ok:true,analysis:result.analysis});
   }
   const body=await json(req);
   if(catalogueDetailPaths.has(req.url)){
    const actor=await actorFor(oldToken);
    if(!actor)return send(res,401,{ok:false});
    const result=await catalogue.detail(actor,catalogueDetailPaths.get(req.url),{version:body.version,reference:body.reference});
    if(result?.status===404)return send(res,404,{ok:false});
    if(result?.status!==200||result.ok!==true)return serviceResult(res,result);
    return send(res,200,{ok:true,exercise:result.exercise});
   }
   if(catalogueSearchPaths.has(req.url)){
    const actor=await actorFor(oldToken);
    if(!actor)return send(res,401,{ok:false});
    const result=await catalogue.search(actor,catalogueSearchPaths.get(req.url),{version:body.version,query:body.query,family:body.family,offset:body.offset});
    if(result?.status!==200||result.ok!==true)return serviceResult(res,result);
    return send(res,200,{ok:true,results:result.results});
   }
   if(req.url==='/api/logout'){
    if(await actorFor(oldToken))await sessions.revoke(oldToken);
    return send(res,200,{ok:true},{'Set-Cookie':cookie('',0)});
   }
   const source=await sourceId(req);
   if(typeof source!=='string'||!source.trim()||source.length>256)throw Error('Source indisponible');
   if(req.url==='/api/login'){
    const result=await loginService.login({email:body.email,password:body.password,sourceId:source,...(app==='admin'?{mfaCode:body.mfaCode}:{})});
    if(result?.ok!==true)return serviceResult(res,result);
    if(result.status!==200||typeof result.token!=='string'||!TOKEN.test(result.token)||!Number.isSafeInteger(result.expiresAt))throw Error('Session invalide');
    try{
     const actor=await actorFor(result.token),age=Math.floor((result.expiresAt-now())/1000);
     if(!actor||!Number.isSafeInteger(age)||age<=0||age>30*86400)throw Error('Session invalide');
     if(oldToken&&oldToken!==result.token&&await actorFor(oldToken))await sessions.revoke(oldToken);
     return send(res,200,{ok:true,account:{id:actor.id,role:actor.role}},{'Set-Cookie':cookie(result.token,age)});
    }catch(e){try{await sessions.revoke(result.token);}catch(_){}throw e;}
   }
   switch(req.url){
    case '/api/register':return serviceResult(res,await registration.register({email:body.email,password:body.password,role:body.role},source));
    case '/api/verify-email':return serviceResult(res,await verification.verify(body.token,source));
    case '/api/resend-verification':return serviceResult(res,await resend.resend(body.email,source));
    case '/api/password-reset/request':return serviceResult(res,await passwordReset.request(body.email,source));
    case '/api/password-reset/confirm':return serviceResult(res,await passwordReset.confirm({token:body.token,password:body.password},source));
   }
  }catch(e){
   if(!res.headersSent)send(res,e instanceof HttpError?e.status:503,{ok:false},e instanceof HttpError&&e.status===413?{Connection:'close'}:{});
   else res.destroy();
  }
 };
}
module.exports=Object.freeze({createAuthHttpHandler});
