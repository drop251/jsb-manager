'use strict';
const {readFile,lstat,realpath}=require('node:fs/promises');
const {resolve,join}=require('node:path');
const {createHash}=require('node:crypto');
// Serve only the files from the independently built authentication distribution.
// Access control for the entire preproduction host must be supplied by the
// deployment gateway. This module deliberately does not start a listener.
async function createPreproductionHandler({app,origin,directory,authHandler,authorizeAccess}={}){
 if(!['public','admin'].includes(app)||typeof authHandler!=='function'||typeof authorizeAccess!=='function'||typeof directory!=='string')throw TypeError('Configuration de préproduction requise');
 const u=new URL(origin);
 if(u.protocol!=='https:'||u.origin!==origin)throw TypeError('Origine HTTPS exacte requise');
 const root=await realpath(resolve(directory));
 const manifest=JSON.parse(await readFile(join(root,'manifest.json'),'utf8'));
 const entry='/'+app+'/auth.html';
 const types=new Map([[entry,'text/html; charset=utf-8'],['/'+app+'/auth-page.mjs','text/javascript; charset=utf-8'],['/shared/auth-client.mjs','text/javascript; charset=utf-8']]);
 if(manifest.app!==app||manifest.purpose!=='preproduction-auth-only'||manifest.entrypoint!==entry||Object.keys(manifest.files||{}).length!==types.size)throw Error('Distribution incompatible');
 const assets=new Map();
 for(const [url,type] of types){
  const name=url.slice(1),filename=join(root,name);
  if(!(await lstat(filename)).isFile()||await realpath(filename)!==filename)throw Error('Fichier non autorisé');
  const bytes=await readFile(filename);
  if(createHash('sha256').update(bytes).digest('hex')!==manifest.files[name])throw Error('Intégrité de la distribution invalide');
  assets.set(url,{bytes,type});
 }
 const headers={'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','X-Robots-Tag':'noindex, nofollow','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"};
 function empty(res,status,extra={}){res.writeHead(status,{...headers,...extra});res.end();}
 return async function handle(req,res){
  try{
   if(req.headers.host!==u.host)return empty(res,421);
   if(await authorizeAccess(req)!==true)return empty(res,403);
   if(typeof req.url!=='string')return empty(res,400);
   if(req.url.startsWith('/api/'))return await authHandler(req,res);
   if(req.method!=='GET'&&req.method!=='HEAD')return empty(res,405,{Allow:'GET, HEAD'});
   if(req.url==='/')return empty(res,302,{Location:entry});
   const asset=assets.get(req.url);
   if(!asset)return empty(res,404);
   res.writeHead(200,{...headers,'Content-Type':asset.type,'Content-Length':asset.bytes.length});
   res.end(req.method==='HEAD'?undefined:asset.bytes);
  }catch(_){if(!res.headersSent)empty(res,503);else res.destroy();}
 };
}
module.exports=Object.freeze({createPreproductionHandler});
