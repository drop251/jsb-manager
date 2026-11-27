'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {mkdtempSync,rmSync,readFileSync}=require('node:fs');
const {tmpdir}=require('node:os');
const path=require('node:path');
const {chromium,webkit}=require('playwright');
const {build}=require('../../../scripts/build-auth-preview.cjs');
const {createPreproductionHandler}=require('../../preproduction-http.cjs');
const fixture={
 schema:'JSB-TAISO-OFFLINE-1',draftId:'a'.repeat(32),generation:'1',baseEditCount:0,title:'Fixture hors connexion',version:'fixture-v1',revision:1,minutes:60,format:'Séries classiques',mode:'Répétitions',
 status:'Brouillon non validé',missing:['Échauffement'],phases:[
 {name:'Mobilité',minutes:5,unallocatedMinutes:5,exercises:[],blocks:[]},
 {name:'Échauffement',minutes:8,unallocatedMinutes:8,exercises:[],blocks:[]},
 {name:'Corps de séance',minutes:35,unallocatedMinutes:30,exercises:[{reference:'JSB-TAISO-FIXTURE',name:'Fixture exercice',allocationMinutes:5,dosage:'8 répétitions',safety:'Fixture sécurité',prescription:{mode:'Répétitions',repetitions:8}}],blocks:[{name:'Séries classiques',references:['JSB-TAISO-FIXTURE'],budgetSeconds:2100,plannedSeconds:null,issues:['organization-not-configured']}]},
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
   await navigator.serviceWorker.register('/public/offline-sw.js',{scope:'/'});
   await navigator.serviceWorker.ready;
   if(!navigator.serviceWorker.controller)await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('Worker non contrôlant')),10000);
    navigator.serviceWorker.addEventListener('controllerchange',()=>{clearTimeout(timer);resolve();},{once:true});
   });
  });
  assert.ok(await page.evaluate(()=>!!navigator.serviceWorker.controller));
  const cache=await page.evaluate(async()=>{const c=await caches.open('jsb-manager-offline-reader-v3');return (await c.keys()).map(x=>new URL(x.url).pathname).sort();});
  assert.deepEqual(cache,['/public/attendance-ui.mjs','/public/attendance-vault.mjs','/public/offline-vault.mjs','/public/offline.html','/public/offline.mjs','/shared/attendance-sync.js']);
  assert.equal((await context.request.get(origin+'/api/session')).status(),401);
  // No fallback on a deliberate gateway denial while online.
  allowed=false;
  assert.equal((await context.request.get(origin+'/public/offline.html')).status(),403);
  // A real, non-empty refusal must stay an HTTP 403, never a cached reader.
  const deniedPage=await context.newPage();
  const refused=await deniedPage.goto(origin+'/public/offline.html');
  assert.equal(refused?.status(),403);
  assert.match(await deniedPage.locator('body').innerText(),/Accès refusé/);
  assert.equal(await deniedPage.getByRole('heading',{name:'Consultation hors connexion'}).count(),0);
  await deniedPage.close();
  allowed=true;
  // Verify a fresh successful navigation and worker control before
  // actually shutting down the listener for the offline scenario.
  const restored=await page.goto(origin+'/public/offline.html');
  assert.equal(restored?.status(),200);
  assert.ok(await page.evaluate(()=>!!navigator.serviceWorker.controller));
  const phrase='Phrase de recette locale uniquement';
  await page.evaluate(async({fixture,phrase})=>{
   const vault=await import('/public/offline-vault.mjs');await vault.createVault(phrase,'fixture-owner',fixture);
  },{fixture,phrase});
  assert.equal(await page.evaluate(()=>localStorage.getItem('jsb-offline-vault-v1').includes('Fixture hors connexion')),false);
  assert.equal(await page.evaluate(()=>localStorage.getItem('jsb-offline-vault-v1').includes('fixture-owner')),false);
  const attendance={groups:[{id:'1'.repeat(32),name:'Groupe fictif'}],members:[{id:'2'.repeat(32),name:'Licencié fictif',groupId:'1'.repeat(32),active:true}],slots:[{id:'3'.repeat(32),groupId:'1'.repeat(32),label:'18h'}],calls:[]};
  await page.evaluate(async({attendance,phrase})=>{
   const m=await import('/public/attendance-vault.mjs');
   await m.createAttendanceVault(phrase,{owner:'a'.repeat(32),revision:1,base:attendance,working:attendance});
  },{attendance,phrase});
  assert.equal(await page.evaluate(()=>localStorage.getItem('jsb-attendance-vault-v1').includes('Licencié fictif')),false);
  server.closeAllConnections();await new Promise(resolve=>server.close(resolve));server=null;
  // The actual listener has been closed. Do not combine this with the
  // Playwright offline emulator, which can suppress worker navigations.
  await page.goto(origin+'/',{timeout:15000});
  await page.getByRole('heading',{name:'Consultation hors connexion'}).waitFor({state:'visible'});
  const presence=page.locator('#attendance-offline');
  await presence.getByLabel('Phrase secrète du coffre Présences').fill(phrase);
  await presence.getByRole('button',{name:'Déverrouiller le registre local'}).click();
  await presence.getByRole('button',{name:'Licencié fictif : Présent',exact:true}).click();
  await presence.getByRole('button',{name:'Licencié fictif : Présent',exact:true}).waitFor();
  await presence.getByRole('status').filter({hasText:'Modification enregistrée dans le coffre local'}).waitFor();
  await page.locator('#vault-password').fill('Phrase incorrecte de recette');
  await page.locator('#vault-open').click();
  await page.locator('#vault-status').filter({hasText:'Phrase secrète incorrecte'}).waitFor({state:'visible'});
  assert.equal(await page.locator('#offline-content').textContent(),'');
  await page.locator('#vault-password').fill(phrase);await page.locator('#vault-open').click();
  await page.locator('#offline-content').filter({hasText:'Fixture exercice'}).waitFor({state:'visible'});
  await page.getByRole('button',{name:'Retirer Fixture exercice',exact:true}).click();
  await page.locator('#offline-status').filter({hasText:'1 modification(s) conservée(s)'}).waitFor({state:'visible'});
  await page.close();
  const reopened=await context.newPage();reopened.on('pageerror',e=>errors.push(e.message));
  await reopened.goto(origin+'/',{timeout:15000});
  assert.equal(await reopened.locator('#offline-content').textContent(),'');
  const restoredPresence=reopened.locator('#attendance-offline');
  await restoredPresence.getByLabel('Phrase secrète du coffre Présences').fill(phrase);
  await restoredPresence.getByRole('button',{name:'Déverrouiller le registre local'}).click();
  await restoredPresence.getByRole('button',{name:'Licencié fictif : Présent',exact:true}).waitFor();
  assert.equal(await restoredPresence.getByRole('button',{name:'Licencié fictif : Présent',exact:true}).getAttribute('aria-pressed'),'true');
  await restoredPresence.getByRole('button',{name:'Bilans',exact:true}).click();
  assert.match(await restoredPresence.textContent(),/1 présent\(s\)/);
  await reopened.locator('#vault-password').fill(phrase);await reopened.locator('#vault-open').click();
  await reopened.locator('#offline-content').filter({hasText:'35 min à organiser'}).waitFor({state:'visible'});
  assert.equal(await reopened.getByRole('button',{name:'Retirer Fixture exercice',exact:true}).count(),0);
  reopened.once('dialog',dialog=>dialog.accept());
  await reopened.locator('#vault-remove').click();
  await reopened.locator('#vault-status').filter({hasText:'Aucune copie chiffrée'}).waitFor({state:'visible'});
  assert.equal(await reopened.evaluate(()=>localStorage.getItem('jsb-offline-vault-v1')),null);
  await reopened.locator('#offline-file').setInputFiles({name:'fixture.jsb-session.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});
  await reopened.locator('#offline-content').filter({hasText:'Fixture exercice'}).waitFor({state:'visible'});
  assert.match(await reopened.locator('#offline-content').textContent(),/8 répétitions/);
  assert.match(await reopened.locator('#offline-content').textContent(),/Fixture sécurité/);
  assert.match(await reopened.locator('#offline-content').textContent(),/Brouillon non validé/);
  assert.equal(await reopened.evaluate(async()=>{try{await fetch('/api/session');return false;}catch{return true;}}),true);
  await reopened.getByRole('button',{name:'Retirer Fixture exercice',exact:true}).click();
  assert.match(await reopened.locator('#offline-content').textContent(),/Brouillon modifié localement/);
  assert.match(await reopened.locator('#offline-content').textContent(),/35 min à organiser/);
  const event=reopened.waitForEvent('download',{timeout:15000});
  await reopened.getByRole('button',{name:'Exporter les modifications locales'}).click();
  const download=await event;
  const patch=JSON.parse(readFileSync(await download.path(),'utf8'));
  assert.deepEqual(patch,{schema:'JSB-TAISO-EDITS-1',draftId:'a'.repeat(32),revision:1,version:'fixture-v1',generation:'1',baseEditCount:0,edits:[{action:'remove',phase:'Corps de séance',reference:'JSB-TAISO-FIXTURE'}]});

  await reopened.getByRole('button',{name:'Fermer la fiche'}).click();assert.equal(await reopened.locator('#offline-content').textContent(),'');
  await reopened.locator('#offline-file').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"schema":"wrong"}')});
  await reopened.locator('#offline-status').filter({hasText:'Fichier de séance non conforme'}).waitFor({state:'visible'});
  assert.deepEqual(errors,[]);
  await context.close();
 }finally{if(browser)await browser.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}rmSync(tmp,{recursive:true,force:true});}
});
