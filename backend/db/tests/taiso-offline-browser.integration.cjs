'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {mkdtempSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
const path=require('node:path');
const {chromium,webkit}=require('playwright');
const {build}=require('../../../scripts/build-auth-preview.cjs');
const {createPreproductionHandler}=require('../../preproduction-http.cjs');
const fixture={
 schema:'JSB-TAISO-OFFLINE-1',title:'Fixture hors connexion',version:'fixture-v1',revision:1,minutes:60,format:'Séries classiques',mode:'Répétitions',
 status:'Brouillon non validé',missing:['Échauffement'],phases:[
 {name:'Mobilité',minutes:5,unallocatedMinutes:5,exercises:[],blocks:[]},
 {name:'Échauffement',minutes:8,unallocatedMinutes:8,exercises:[],blocks:[]},
 {name:'Corps de séance',minutes:35,unallocatedMinutes:30,exercises:[{reference:'JSB-TAISO-FIXTURE',name:'Fixture exercice',allocationMinutes:5,dosage:'8 répétitions',safety:'Fixture sécurité',prescription:{mode:'Répétitions',repetitions:8}}],blocks:[{name:'Séries classiques',budgetSeconds:2100,plannedSeconds:null,issues:['organization-not-configured']}]},
 {name:'Retour au calme',minutes:4,unallocatedMinutes:4,exercises:[],blocks:[]},
 {name:'Étirements',minutes:8,unallocatedMinutes:8,exercises:[],blocks:[]}
 ]
};
for(const [name,launcher] of [['Chromium',chromium],['WebKit',webkit]])test('Lecteur Taïso sans réseau : '+name,async()=>{
 const tmp=mkdtempSync(path.join(tmpdir(),'jsb-offline-ci-')),directory=path.join(tmp,'public');
 let server,browser,handler,allowed=true;
 try{
  await build('public',directory);
  // Loopback HTTP is a secure context for service workers. The tested
  // production handler still uses its HTTPS configured origin and access gate.
  server=http.createServer((req,res)=>handler(req,res));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const host='127.0.0.1:'+server.address().port,origin='http://'+host;
  handler=await createPreproductionHandler({app:'public',origin:'https://'+host,directory,authorizeAccess:()=>allowed,authHandler:async(req,res)=>{res.writeHead(401,{'Cache-Control':'no-store','Content-Type':'application/json'});res.end('{"ok":false}');}});
  browser=await launcher.launch();
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/public/offline.html');
  await page.evaluate(async()=>{
   await navigator.serviceWorker.register('/public/offline-sw.js',{scope:'/public/'});
   await navigator.serviceWorker.ready;
  });
  const cache=await page.evaluate(async()=>{const c=await caches.open('jsb-manager-offline-reader-v1');return (await c.keys()).map(x=>new URL(x.url).pathname).sort();});
  assert.deepEqual(cache,['/public/offline.html','/public/offline.mjs']);
  assert.equal(await page.evaluate(async()=> (await fetch('/api/session')).status),401);
  // No fallback on a deliberate gateway denial while online.
  allowed=false;assert.equal((await page.goto(origin+'/public/offline.html')).status(),403);allowed=true;
  await page.goto(origin+'/public/offline.html');
  server.closeAllConnections();await new Promise(resolve=>server.close(resolve));server=null;
  await context.setOffline(true);
  await page.goto(origin+'/public/auth.html',{timeout:15000});
  await page.getByRole('heading',{name:'Consultation hors connexion'}).waitFor({state:'visible'});
  await page.locator('#offline-file').setInputFiles({name:'fixture.jsb-session.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});
  await page.locator('#offline-content').filter({hasText:'Fixture exercice'}).waitFor({state:'visible'});
  assert.match(await page.locator('#offline-content').textContent(),/8 répétitions/);
  assert.match(await page.locator('#offline-content').textContent(),/Fixture sécurité/);
  assert.match(await page.locator('#offline-content').textContent(),/Brouillon non validé/);
  assert.equal(await page.evaluate(async()=>{try{await fetch('/api/session');return false;}catch{return true;}}),true);
  await page.getByRole('button',{name:'Fermer la fiche'}).click();assert.equal(await page.locator('#offline-content').textContent(),'');
  await page.locator('#offline-file').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"schema":"wrong"}')});
  await page.locator('#offline-status').filter({hasText:'Fichier de séance non conforme'}).waitFor({state:'visible'});
  assert.deepEqual(errors,[]);
  await context.close();
 }finally{if(browser)await browser.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}rmSync(tmp,{recursive:true,force:true});}
});
