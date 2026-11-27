'use strict';
// This cache contains only public, data-free offline reader assets.
// Never intercept API calls, authentication requests, POSTs or private data.
const CACHE='jsb-manager-offline-reader-v5',ASSETS=['/public/offline.html','/public/offline.mjs','/public/offline-vault.mjs','/public/attendance-vault.mjs','/public/attendance-ui.mjs','/shared/attendance-sync.js','/shared/auth-client.mjs'];
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 try{
  for(const path of ASSETS){
   const response=await fetch(path,{cache:'reload',credentials:'same-origin',redirect:'error'});
   if(!response.ok||new URL(response.url).origin!==self.location.origin||!response.headers.get('content-type')?.includes(path.endsWith('.html')?'text/html':'javascript'))throw Error('Asset refused');
   await cache.put(path,response);
  }
 }catch(e){await caches.delete(CACHE);throw e;}
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const key of await caches.keys())if(key.startsWith('jsb-manager-offline-reader-')&&key!==CACHE)await caches.delete(key);
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const req=event.request,u=new URL(req.url);
 if(req.method!=='GET'||u.origin!==self.location.origin||u.search)return;
 const path=u.pathname;
 if(!ASSETS.includes(path)&&!((path==='/'||path==='/public/auth.html')&&req.mode==='navigate'))return;
 event.respondWith((async()=>{
  try{return await fetch(req);}catch(e){
   const cache=await caches.open(CACHE);
   const response=await cache.match((path==='/'||path==='/public/auth.html')?ASSETS[0]:path);
   if(response){
    // A cached reader URL differs from the original navigation URL. Return
    // a fresh response for navigation to avoid engine-specific URL handling.
    if(req.mode==='navigate')return new Response(await response.arrayBuffer(),{status:200,headers:response.headers});
    return response;
   }
   throw e;
  }
 })());
});
