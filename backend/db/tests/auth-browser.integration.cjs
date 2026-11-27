'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const https=require('node:https');
const {readFileSync,mkdtempSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {randomBytes}=require('node:crypto');
const {Pool}=require('pg');
const {chromium,webkit}=require('playwright');
const {createAuthRuntime}=require('../../auth-runtime.cjs');
const {createMfaVault}=require('../../mfa-vault.cjs');
const {createDeliveryVault}=require('../../delivery-vault.cjs');
const {createDeliveryStore}=require('../delivery-store.cjs');
const {createDeliveryWorker}=require('../../delivery-worker.cjs');
const {createResendTransport}=require('../../resend-transport.cjs');
const {codeForStep}=require('../../admin-mfa.cjs');
const {hashPassword}=require('../../passwords.cjs');
const password='Phrase de passe JSB navigateur CI !';
const registrationEmails=['browser-new-chromium@example.test','browser-new-webkit@example.test'];
const emails={coach:'browser-coach@example.test',individual:'browser-individual@example.test',admin:'browser-admin@example.test'};
const keyset=(name,byte)=>({activeKeyId:name,loadKey:async id=>id===name?Buffer.alloc(32,byte):undefined});
const {build}=require('../../../scripts/build-auth-preview.cjs');
const {createPreproductionHandler}=require('../../preproduction-http.cjs');
// Use native locator waiting: waitForFunction compiles a string in the page,
// which is correctly rejected by the production CSP (no unsafe-eval).
const waitStatus=(page,expected)=>page.locator('#status').filter({hasText:expected}).waitFor({state:'visible',timeout:15000});
// Dispatch the exact touch sequence consumed by the shared historical engine.
async function assertFixedScale(page){
 const result=await page.evaluate(()=>{
  const viewport=document.querySelector('meta[name="viewport"]').content;
  function gesture(type,count){
   const event=new Event(type,{bubbles:true,cancelable:true});
   Object.defineProperty(event,'touches',{value:Array.from({length:count},(_,i)=>({identifier:i,clientX:10+i*30,clientY:100}))});
   document.body.dispatchEvent(event);return event.defaultPrevented;
  }
  return {viewport,touchAction:getComputedStyle(document.documentElement).touchAction,gestureStart:gesture('gesturestart',2),gestureChange:gesture('gesturechange',2),pinch:gesture('touchmove',2),scroll:gesture('touchmove',1),inputSize:parseFloat(getComputedStyle(document.querySelector('#email')).fontSize)};
 });
 assert.match(result.viewport,/minimum-scale=1,maximum-scale=1,user-scalable=no/);
 assert.equal(result.touchAction,'pan-x pan-y');
 assert.equal(result.gestureStart,true);assert.equal(result.gestureChange,true);assert.equal(result.pinch,true);assert.equal(result.scroll,false);
 assert.ok(result.inputSize>=16);
}
async function swipe(page,{dx=135,dy=2,startX=18,target='#workspace h3',cancel=false}={}){
 return page.evaluate(({dx,dy,startX,target,cancel})=>{
  const node=document.querySelector(target);
  if(!node)throw Error('Cible tactile introuvable : '+target);
  const point=(x,y)=>({identifier:7,clientX:x,clientY:y});
  function dispatch(type,touches,changedTouches=[]){
   const event=new Event(type,{bubbles:true,cancelable:true});
   Object.defineProperties(event,{touches:{value:touches},changedTouches:{value:changedTouches}});
   node.dispatchEvent(event);
  }
  dispatch('touchstart',[point(startX,180)]);
  dispatch('touchmove',[point(startX+dx,180+dy)]);
  const moving=document.querySelector('#workspace').hasAttribute('data-swipe-moving');
  dispatch(cancel?'touchcancel':'touchend',[],[point(startX+dx,180+dy)]);
  return {moving,active:document.querySelector('.jsb-nav [aria-current="page"]')?.dataset.navPage,reset:!document.querySelector('#workspace').hasAttribute('data-swipe-moving')};
 },{dx,dy,startX,target,cancel});
}
async function settingsPage(page,key){
 if(await page.locator('#settings-back').isVisible())await page.locator('#settings-back').click();
 if(!await page.locator('[data-settings-page="'+key+'"]').isVisible())await page.locator('[data-nav-page="settings"]').click();
 await page.locator('[data-settings-page="'+key+'"]').click();
}
async function openSettings(page){
 if(!await page.locator('.account-tools').isVisible())await settingsPage(page,'account');
 await page.locator('.account-tools').waitFor({state:'visible'});
}
async function signIn(page,email,code){
 if(!await page.locator('#login').isVisible()){
  await openSettings(page);
  await page.locator('#change-account').click();
 }
 await page.locator('#email').fill(email);await page.locator('#password').fill(password);
 if(code!==undefined)await page.locator('#mfa').fill(code);
 await page.locator('#login button[type=submit]').click();
}
test('Navigateurs HTTPS : connexion réelle des deux applications, sessions et cloisonnement',async()=>{
 assert.equal(process.env.PGDATABASE,'jsb_ci');
 const pool=new Pool({max:8});let safe=false,runtime;const servers=[];
 const dir=mkdtempSync(path.join(tmpdir(),'jsb-https-ci-'));
 try{
  assert.equal((await pool.query('SELECT current_database() AS name')).rows[0].name,'jsb_ci');safe=true;
  const key=path.join(dir,'key.pem'),cert=path.join(dir,'cert.pem');
  execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=JSB CI','-addext','subjectAltName=IP:127.0.0.1,IP:127.0.0.2','-keyout',key,'-out',cert],{stdio:'ignore'});
  const tls={key:readFileSync(key),cert:readFileSync(cert)};
  const handlers=new Map(),network=[];
  async function start(app,host){
   const server=https.createServer(tls,(req,res)=>{
    const handler=handlers.get(app);
    if(!handler){res.writeHead(503);res.end();return;}
    if(['/api/login','/api/logout','/api/session'].includes(req.url)){
     const origin=req.headers.origin,expected='https://'+req.headers.host;
     const item={app,path:req.url,origin:origin===expected?'same-origin':origin===undefined?'absent':origin==='null'?'null':'other',site:req.headers['sec-fetch-site']||'absent',cookiePresent:typeof req.headers.cookie==='string'};
     res.once('finish',()=>{network.push({...item,status:res.statusCode,setCookie:res.hasHeader('set-cookie')});});
    }
    return handler(req,res);
   });servers.push(server);
   await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,host,resolve);});
   return 'https://'+host+':'+server.address().port;
  }
  const publicOrigin=await start('public','127.0.0.1'),adminOrigin=await start('admin','127.0.0.2');
  const mfaKeys=keyset('browser-mfa-ci',23),secret=randomBytes(20),factorVersion='browser-ci-v1';
  const xlsxPython=process.env.JSB_XLSX_PYTHON;
  assert.ok(xlsxPython&&path.isAbsolute(xlsxPython),'Interpréteur XLSX de recette requis');
  const {HEADERS}=require('../../../core/taiso-xlsx-recipe.cjs');
  const fixtureWorkbook=path.join(dir,'catalogue-fixture.xlsx');
  execFileSync(xlsxPython,['-c',[
   'from openpyxl import Workbook',
   'import json, sys',
   'book = Workbook()',
   'sheet = book.active',
   'sheet.title = "Exercices"',
   'sheet.append(json.loads(sys.stdin.read()))',
   'for i in range(228):',
   '    row = ["Fixture %d / %d" % (i, j) for j in range(22)]',
   '    row[2:4] = ["Taïso", "Exercice"]',
   '    row[7] = "Famille recette"',
   '    sheet.append(row)',
   'book.save(sys.argv[1])'
  ].join('\n'),fixtureWorkbook],{input:JSON.stringify(HEADERS),stdio:['pipe','ignore','pipe']});
  const {CONTRACTS}=require('../../../core/catalogue-workbook-contract.cjs');
  const finalWorkbooks={};
  for(const discipline of ['taiso','judo']){
   const spec=CONTRACTS[discipline],record=Object.fromEntries(spec.map(([,key])=>[key,'Fixture '+key]));
   Object.assign(record,{reference:discipline==='taiso'?'JSB-TAISO-FIXTURE-1':'JSB-JUDO-FIXTURE-1',discipline:discipline==='taiso'?'Taïso':'Judo',sheetType:'Exercice',dosageMode:discipline==='taiso'?'Durée et répétitions':'Durée + répétitions max',effortSeconds:30,repetitions:discipline==='taiso'?8:null,tagsText:null,restrictions:null});
   if(discipline==='taiso')Object.assign(record,{level:'Intermédiaire',subgroup:'Gym douce, Training'});
   else Object.assign(record,{ageCategory:'Benjamins; Minimes',pedagogicalRole:'Acquisition',opposition:'Coopération',blockDuration:10,repetitionsMax:5});
   const rows=[spec.map(([label])=>label),spec.map(([,key])=>record[key])];
   const filename=path.join(dir,discipline+'-contract-fixture.xlsx');
   execFileSync(xlsxPython,['-c',[
    'from openpyxl import Workbook',
    'import json, sys',
    'book = Workbook()',
    'sheet = book.active',
    'sheet.title = "Exercices"',
    'for row in json.loads(sys.stdin.read()): sheet.append(row)',
    'sheet.cell(301,1).number_format = "@"',
    'book.save(sys.argv[1])'
   ].join('\n'),filename],{input:JSON.stringify(rows),stdio:['pipe','ignore','pipe']});
   finalWorkbooks[discipline]=filename;
  }
  runtime=createAuthRuntime({pool,publicOrigin,adminOrigin,sourceId:req=>req.socket.remoteAddress,quotaSecret:Buffer.alloc(32,21),deliveryKeys:keyset('browser-mail-ci',22),mfaKeys,xlsxPython,enableCataloguePublication:true});
  assert.equal(await runtime.checkReady(),true);
  for(const [app,origin,authHandler] of [['public',publicOrigin,runtime.publicHandler],['admin',adminOrigin,runtime.adminHandler]]){
   const directory=path.join(dir,app);
   await build(app,directory);
   // Synthetic access gateway, only on the isolated loopback CI listeners.
   handlers.set(app,await createPreproductionHandler({app,origin,directory,authHandler,otherOrigin:app==='admin'?publicOrigin:adminOrigin,authorizeAccess:req=>['127.0.0.1','127.0.0.2'].includes(req.socket.remoteAddress)}));
  }
  const ids={};const hash=await hashPassword(password);
  for(const role of Object.keys(emails)){
   ids[role]=randomBytes(16).toString('hex');
   await pool.query("INSERT INTO jsb_auth.accounts(id,email,password_hash,role,status,email_verified,created_at) VALUES ($1,$2,$3,$4,'active',true,$5)",[ids[role],emails[role],hash,role,Date.now()]);
  }
  const envelope=await createMfaVault(mfaKeys).seal({accountId:ids.admin,factorVersion,secret});
  await pool.query('INSERT INTO jsb_auth.mfa_factors(account_id,factor_version,encrypted_secret,enabled) VALUES ($1,$2,$3,true)',[ids.admin,factorVersion,envelope]);
  await pool.query("INSERT INTO jsb_catalogue.releases(discipline,version,source_hash,published_at) VALUES ('taiso','browser-fixture',$1,$2)",['b'.repeat(64),Date.now()]);
  await pool.query("INSERT INTO jsb_catalogue.exercises(discipline,version,reference,name,family) VALUES ('taiso','browser-fixture','fixture-a','Fixture Alpha','Famille A'),('taiso','browser-fixture','fixture-b','Fixture Beta','Famille B')");
  // Explicit synthetic fixture for the candidate endpoint. Two older summary-only
  // entries remain browsable but cannot enter automatic preparation.
  const rec=Object.fromEntries(CONTRACTS.taiso.map(([,key])=>[key,'Fixture '+key]));
  Object.assign(rec,{reference:'JSB-TAISO-CANDIDATE-CI',name:'Fixture compatible',family:'Famille C',moment:'Corps de séance',discipline:'Taïso',sheetType:'Exercice',level:'Intermédiaire',subgroup:'Gym douce, Training',equipment:'Poids du corps',format:'Solo',dosageMode:'Répétitions',repetitions:'8',effortSeconds:null,tagsText:null,restrictions:null});
  const {reference,name:fixtureName,family,discipline:ignored,...fields}=rec;
  const details={contractVersion:'JSB-EXCEL-1',...Object.fromEntries(Object.entries(fields).filter(([,value])=>value!==null))};
  await pool.query("INSERT INTO jsb_catalogue.exercises(discipline,version,reference,name,family,pedagogical_details) VALUES ('taiso','browser-fixture',$1,$2,$3,$4)",[reference,fixtureName,family,JSON.stringify(details)]);
  await pool.query("INSERT INTO jsb_catalogue.publications(discipline,version,actor_id,published_at,exercise_count) VALUES ('taiso','browser-fixture',$1,$2,3)",[ids.admin,Date.now()]);
  await pool.query("INSERT INTO jsb_catalogue.current_release(discipline,version) VALUES ('taiso','browser-fixture')");
  for(const [name,launcher] of [['Chromium',chromium],['WebKit',webkit]]){
   network.length=0;
   // Reset only the synthetic factor between engines; production never resets replay counters.
   await pool.query('UPDATE jsb_auth.mfa_factors SET last_step=-1 WHERE account_id=$1',[ids.admin]);
   const browser=await launcher.launch();
   try{
    const ctx=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:390,height:844}});
    const page=await ctx.newPage(),admin=await ctx.newPage(),errors=[];
    for(const p of [page,admin])p.on('pageerror',e=>errors.push(e.message));
    await page.bringToFront();
    await page.goto(publicOrigin+'/');
    assert.equal(new URL(page.url()).pathname,'/public/auth.html');
    await waitStatus(page,'Connectez-vous');
    await assertFixedScale(page);
    assert.ok(await page.locator('#password').isEnabled(),name);
    assert.equal(await page.locator('#workspace').isVisible(),false);
    assert.equal(await page.locator('#workspace').textContent(),'');
    await signIn(page,emails.coach);await waitStatus(page,'Session vérifiée : Coach');
    assert.equal(await page.locator('#password').inputValue(),'');
    assert.ok(await page.locator('#workspace').isVisible());
    assert.equal(await page.locator('.account-tools').isVisible(),false);
    assert.equal(await page.locator('#login').isVisible(),false);
    await openSettings(page);
    assert.equal(await page.locator('#login').isVisible(),false);
    assert.ok(await page.locator('#change-account').isVisible());
    await settingsPage(page,'display');
    // Explicit light must override dark OS; local preferences survive reload.
    await page.emulateMedia({colorScheme:'dark'});
    await page.locator('input[name="display-theme"][value="light"]').check();
    assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
    assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()),'#f4f5ef');
    await page.locator('input[name="display-text"][value="130"]').check();
    assert.ok(Math.abs(await page.evaluate(()=>parseFloat(getComputedStyle(document.documentElement).fontSize))-20.8)<0.1);
    await assertFixedScale(page);
    assert.equal(await page.locator('html').getAttribute('data-texte-grand'),'');
    await page.locator('#display-contraste').check();
    await page.locator('#display-animations').check();
    assert.equal(await page.locator('html').getAttribute('data-contraste'),'');
    assert.equal(await page.locator('html').getAttribute('data-anim'),'');
    await page.reload();await waitStatus(page,'Session vérifiée : Coach');
    assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
    assert.equal(await page.locator('html').getAttribute('data-texte-grand'),'');
    assert.equal(await page.locator('#login').isVisible(),false);
    await settingsPage(page,'display');
    assert.ok(await page.locator('#display-contraste').isChecked());
    assert.ok(await page.locator('#display-animations').isChecked());
    await page.locator('input[name="display-text"][value="100"]').check();
    await page.locator('#display-contraste').uncheck();
    await page.locator('#display-animations').uncheck();
    await page.locator('input[name="display-theme"][value="dark"]').check();
    assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
    await page.locator('input[name="display-theme"][value="system"]').check();
    assert.equal(await page.locator('html').getAttribute('data-theme'),null);
    await page.emulateMedia({colorScheme:'light'});
    await settingsPage(page,'version');
    const installed=await page.locator('meta[name="jsb-release"]').getAttribute('content');
    assert.match(installed,/^[a-f0-9]{64}$/);
    await page.locator('#version-check').click();
    await page.locator('#version-status').filter({hasText:'Votre version est à jour.'}).waitFor({state:'visible'});
    assert.equal(await page.locator('#version-reload').isVisible(),false);
    const versionProbe=async route=>{if(route.request().method()==='HEAD')await route.fulfill({status:200,headers:{'X-JSB-Release':installed==='a'.repeat(64)?'b'.repeat(64):'a'.repeat(64)}});else await route.continue();};
    await page.route(publicOrigin+'/public/auth.html',versionProbe);
    await page.locator('#version-check').click();
    await page.locator('#version-status').filter({hasText:'Nouvelle version disponible'}).waitFor({state:'visible'});
    assert.ok(await page.locator('#version-reload').isVisible());
    await page.unroute(publicOrigin+'/public/auth.html',versionProbe);
    assert.equal(await page.locator('#login').isVisible(),false);
    await page.locator('[data-nav-page="home"]').click();
    assert.equal(await page.locator('.account-tools').isVisible(),false);
    assert.ok(await page.locator('[data-workspace-page="club"]').isVisible());
    assert.equal(await page.locator('[data-workspace-page="personal"]').count(),0);
    assert.ok(await page.locator('.jsb-nav').isVisible());
    assert.equal(await page.locator('.jsb-nav button svg[aria-hidden="true"]').count(),5);
    assert.ok(await page.getByRole('heading',{name:'Tableau de bord',exact:true}).isVisible());
    assert.ok(await page.getByRole('heading',{name:'Catalogue et espaces'}).isVisible());
    assert.ok(await page.locator('[data-workspace-page="judo"] .bloc-ico svg').isVisible());
    assert.ok(await page.locator('[data-workspace-page="taiso"] .bloc-ico svg').isVisible());
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.equal(await page.locator('.jsb-nav [aria-current="page"]').getAttribute('data-nav-page'),'home');
    await page.locator('[data-nav-page="judo"]').click();
    assert.equal(await page.locator('.jsb-nav [aria-current="page"]').getAttribute('data-nav-page'),'judo');
    assert.match(await page.locator('#workspace').textContent(),/Préparer une séance Judo/);
    assert.deepEqual(await swipe(page,{dx:135,dy:100}),{moving:false,active:'judo',reset:true});
    assert.deepEqual(await swipe(page,{startX:90}),{moving:false,active:'judo',reset:true});
    assert.deepEqual(await swipe(page,{dx:40}),{moving:true,active:'judo',reset:true});
    assert.deepEqual(await swipe(page,{cancel:true}),{moving:true,active:'judo',reset:true});
    assert.deepEqual(await swipe(page),{moving:true,active:'home',reset:true});
    await settingsPage(page,'display');
    await page.locator('#display-animations').check();
    await page.locator('#display-animations').blur();
    assert.deepEqual(await swipe(page,{target:'#workspace h2'}),{moving:false,active:'settings',reset:true});
    assert.ok(await page.locator('[data-settings-page="display"]').isVisible());
    await settingsPage(page,'display');
    await page.locator('#display-animations').uncheck();
    await page.locator('[data-nav-page="home"]').click();
    await page.locator('[data-workspace-page="taiso"]').click();
    await page.locator('#catalogue-results summary').filter({hasText:'Fixture Alpha'}).waitFor({state:'visible'});
    await page.getByRole('button',{name:'Vérifier les exercices compatibles'}).click();
    await page.locator('#taiso-candidate-result').filter({hasText:'1 exercice(s) compatible(s) · 2 non retenu(s)'}).waitFor({state:'visible',timeout:15000});
    assert.match(await page.locator('#taiso-candidate-result').textContent(),/Fixture compatible/);
    assert.deepEqual(await swipe(page),{moving:false,active:'taiso',reset:true});
    await page.getByRole('button',{name:'Proposer une séance'}).click();
    await page.locator('#taiso-candidate-result').filter({hasText:'Proposition à valider · 60 min'}).waitFor({state:'visible',timeout:15000});
    assert.match(await page.locator('#taiso-candidate-result').textContent(),/8 répétitions/);
    assert.match(await page.locator('#taiso-candidate-result').textContent(),/Couverture insuffisante/);
    assert.match(await page.locator('#taiso-candidate-result').textContent(),/Aucune séance n’est encore enregistrée/);
    const draftTitle='Recette privée '+name;
    await page.locator('#taiso-draft-title').fill(draftTitle);
    await page.getByRole('button',{name:'Enregistrer le brouillon',exact:true}).click();
    await page.locator('#taiso-save-status').filter({hasText:'Révision 1'}).waitFor({state:'visible',timeout:15000});
    const savedRow=(await pool.query('SELECT id,revision FROM jsb_private.taiso_drafts WHERE owner_id=$1 AND title=$2',[ids.coach,draftTitle])).rows[0];
    assert.equal(savedRow.revision,1);
    assert.ok(await page.getByText('Validation indisponible : complétez les phases et l’organisation.',{exact:true}).isVisible());
    const pdfDownload=page.waitForEvent('download',{timeout:15000});
    await page.getByRole('button',{name:'Télécharger le PDF détaillé',exact:true}).click();
    const pdf=await pdfDownload;
    assert.equal(pdf.suggestedFilename(),'JSB-Taiso-r1-detaille.pdf');
    assert.equal(readFileSync(await pdf.path()).subarray(0,4).toString(),'%PDF');
    await page.locator('#taiso-validation-status').filter({hasText:'Téléchargement lancé'}).waitFor({state:'visible'});
    const patch={schema:'JSB-TAISO-EDITS-1',draftId:savedRow.id,revision:1,version:'browser-fixture',generation:'1',baseEditCount:0,edits:[{action:'remove',phase:'Corps de séance',reference:'JSB-TAISO-CANDIDATE-CI'}]};
    const phrase='Phrase de recette locale uniquement';
    await page.evaluate(async({patch,owner,phrase})=>{
     const module=await import('/public/offline-vault.mjs');
     const copy={...patch,schema:'JSB-TAISO-OFFLINE-1'};delete copy.edits;
     await module.createVault(phrase,'other-account',copy);
     const wrong=await module.openVault(phrase);await wrong.save(patch.edits);wrong.close();
    },{patch,owner:String(ids.coach),phrase});
    await page.locator('#taiso-vault-password').fill(phrase);
    await page.getByRole('button',{name:'Reprendre le coffre hors connexion'}).click();
    await page.locator('#taiso-import-status').filter({hasText:'Import refusé'}).waitFor({state:'visible'});
    await page.evaluate(async({patch,owner,phrase})=>{
     const module=await import('/public/offline-vault.mjs');
     const wrong=await module.openVault(phrase);await wrong.remove();
     const copy={...patch,schema:'JSB-TAISO-OFFLINE-1'};delete copy.edits;
     await module.createVault(phrase,owner,copy);
     const valid=await module.openVault(phrase);await valid.save(patch.edits);valid.close();
    },{patch,owner:String(ids.coach),phrase});
    await page.locator('#taiso-vault-password').fill(phrase);
    await page.getByRole('button',{name:'Reprendre le coffre hors connexion'}).click();
    await page.locator('#taiso-import-status').filter({hasText:'Modifications locales vérifiées'}).waitFor({state:'visible',timeout:15000});
    assert.equal((await pool.query('SELECT revision FROM jsb_private.taiso_drafts WHERE owner_id=$1 AND id=$2',[ids.coach,savedRow.id])).rows[0].revision,1);
    await page.locator('#taiso-import-offline').setInputFiles({name:'fixture.jsb-edits.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(patch))});
    await page.locator('#taiso-import-status').filter({hasText:'Modifications locales vérifiées'}).waitFor({state:'visible',timeout:15000});
    assert.equal(await page.getByRole('button',{name:'Retirer Fixture compatible',exact:true}).count(),0);
    assert.equal((await pool.query('SELECT revision FROM jsb_private.taiso_drafts WHERE owner_id=$1 AND id=$2',[ids.coach,savedRow.id])).rows[0].revision,1);


    await page.getByRole('button',{name:'Nouvelle séance',exact:true}).click();
    await page.getByRole('button',{name:'Mes brouillons Taïso'}).click();
    await page.getByRole('button',{name:'Reprendre '+draftTitle,exact:true}).click();
    await page.locator('#taiso-editing').filter({hasText:'révision 1'}).waitFor({state:'visible'});
    assert.equal(await page.locator('#taiso-duration').inputValue(),'60');
    assert.match(await page.locator('#taiso-candidate-result').textContent(),/8 répétitions/);
    await page.locator('#taiso-duration').selectOption('45');
    await page.getByRole('button',{name:'Proposer une séance'}).click();
    await page.locator('#taiso-candidate-result').filter({hasText:'Proposition à valider · 45 min'}).waitFor({state:'visible',timeout:15000});
    await page.getByRole('button',{name:'Enregistrer les modifications',exact:true}).click();
    await page.locator('#taiso-save-status').filter({hasText:'Révision 2'}).waitFor({state:'visible',timeout:15000});
    assert.equal((await pool.query('SELECT revision FROM jsb_private.taiso_drafts WHERE owner_id=$1 AND id=$2',[ids.coach,savedRow.id])).rows[0].revision,2);
    await page.getByRole('button',{name:'Retirer Fixture compatible',exact:true}).click();
    await page.locator('#taiso-candidate-result').filter({hasText:'Modification appliquée au brouillon en cours'}).waitFor({state:'visible',timeout:15000});
    assert.equal(await page.getByRole('button',{name:'Retirer Fixture compatible',exact:true}).count(),0);
    await page.getByRole('button',{name:'Enregistrer les modifications',exact:true}).click();
    await page.locator('#taiso-save-status').filter({hasText:'Révision 3'}).waitFor({state:'visible',timeout:15000});
    const editedRow=(await pool.query('SELECT revision,settings,snapshot FROM jsb_private.taiso_drafts WHERE owner_id=$1 AND id=$2',[ids.coach,savedRow.id])).rows[0];
    assert.equal(editedRow.revision,3);assert.equal(editedRow.settings.edits.length,1);
    assert.ok(editedRow.snapshot.phases.every(p=>p.exercises.length===0));
    await page.getByRole('button',{name:'Nouvelle séance',exact:true}).click();
    await page.getByRole('button',{name:'Mes brouillons Taïso'}).click();
    await page.getByRole('button',{name:'Reprendre '+draftTitle,exact:true}).click();
    await page.locator('#taiso-editing').filter({hasText:'révision 3'}).waitFor({state:'visible',timeout:15000});
    assert.equal(await page.getByRole('button',{name:'Retirer Fixture compatible',exact:true}).count(),0);

    await page.getByRole('button',{name:'Nouvelle séance',exact:true}).click();
    await page.locator('#taiso-duration').selectOption('60');

    await page.locator('#taiso-format').selectOption('Circuit');
    await page.locator('#taiso-configure').check();
    await page.locator('#taiso-org-stations').fill('4');
    await page.locator('#taiso-org-rounds').fill('3');
    await page.locator('#taiso-org-recoverySeconds').fill('20');
    await page.locator('#taiso-org-repWindowSeconds').fill('30');
    await page.locator('#taiso-org-roundRestSeconds').fill('60');
    await page.getByRole('button',{name:'Proposer une séance'}).click();
    await page.locator('#taiso-candidate-result').filter({hasText:'Nombre de stations insuffisant'}).waitFor({state:'visible',timeout:15000});
    assert.match(await page.locator('#taiso-candidate-result').textContent(),/Organisation incomplète/);
    await page.locator('#taiso-configure').uncheck();
    await page.locator('#taiso-format').selectOption('Séries classiques');

    await page.locator('#taiso-mode').selectOption('Durée');
    await page.getByRole('button',{name:'Vérifier les exercices compatibles'}).click();
    await page.locator('#taiso-candidate-result').filter({hasText:'0 exercice(s) compatible(s) · 3 non retenu(s)'}).waitFor({state:'visible',timeout:15000});

    await page.locator('#catalogue-family').selectOption('Famille B');
    await page.locator('#catalogue-results summary').filter({hasText:'Fixture Beta'}).waitFor({state:'visible'});
    assert.equal(await page.locator('#catalogue-results summary').count(),1);
    await page.locator('#catalogue-results summary').click();
    assert.match(await page.locator('#catalogue-results').textContent(),/fixture-b/);
    await page.locator('#workspace-back').click();
    await page.locator('[data-workspace-page="club"]').click();
    assert.match(await page.locator('#workspace').textContent(),/Licenciés/);
    let cookies=await ctx.cookies(publicOrigin);
    const first=cookies.find(c=>c.name==='__Host-jsb-public');
    assert.ok(first?.secure&&first?.httpOnly&&first?.sameSite==='Strict');
    assert.ok(!(await page.evaluate(()=>document.cookie)).includes('__Host-jsb-public'));
    await signIn(page,emails.individual);await waitStatus(page,'Session vérifiée : Particulier');
    assert.ok(await page.locator('[data-workspace-page="personal"]').isVisible());
    assert.equal(await page.locator('[data-workspace-page="club"]').count(),0);
    assert.doesNotMatch(await page.locator('#workspace').textContent(),/Licenciés|Présences|Planning/);
    cookies=await ctx.cookies(publicOrigin);
    assert.notEqual(cookies.find(c=>c.name==='__Host-jsb-public').value,first.value);
    const current=await page.evaluate(async()=>await (await fetch('/api/session',{cache:'no-store'})).json());
    assert.deepEqual(current.account,{id:ids.individual,role:'individual'});
    const privateProbe=await page.evaluate(async({expectedAccount,id})=>{const r=await fetch('/api/private/taiso/drafts/read',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedAccount,id})});return r.status;},{expectedAccount:ids.individual,id:savedRow.id});
    assert.equal(privateProbe,409);

    await signIn(page,emails.admin);await waitStatus(page,'Identifiants incorrects');
    assert.equal(await page.locator('#active-session').textContent(),'Compte actif : Particulier');
    assert.equal((await page.evaluate(async()=>await (await fetch('/api/session')).json())).account.id,ids.individual);
    await admin.bringToFront();
    await admin.goto(adminOrigin+'/');
    assert.equal(new URL(admin.url()).pathname,'/admin/auth.html');
    await waitStatus(admin,'Connectez-vous');
    await assertFixedScale(admin);
    assert.equal((await ctx.cookies(adminOrigin)).some(c=>c.name==='__Host-jsb-public'),false);
    assert.equal((await admin.evaluate(async()=> (await fetch('/public/auth.html')).status)),404);
    assert.equal((await page.evaluate(async()=> (await fetch('/admin/auth.html')).status)),404);
    await signIn(admin,emails.coach,'123456');await waitStatus(admin,'Identifiants incorrects');
    await signIn(admin,emails.admin,codeForStep(secret,Math.floor(Date.now()/30000)));
    await waitStatus(admin,'Session vérifiée : Administrateur');
    assert.ok(await admin.locator('#mfa').isDisabled());
    assert.equal(await admin.locator('#login').isVisible(),false);
    assert.equal(await admin.locator('.account-tools').isVisible(),false);
    assert.equal(await admin.locator('.jsb-nav button svg[aria-hidden="true"]').count(),8);
    assert.ok(await admin.getByRole('heading',{name:'Services administratifs'}).isVisible());
    // Switch through the actual links, without logging out either origin.
    await settingsPage(admin,'display');
    assert.ok(await admin.locator('input[name="display-theme"][value="system"]').isChecked());
    await admin.locator('input[name="display-theme"][value="dark"]').check();
    assert.equal(await admin.locator('html').getAttribute('data-theme'),'dark');
    assert.equal(await page.locator('html').getAttribute('data-theme'),null);
    await admin.locator('input[name="display-theme"][value="system"]').check();
    await openSettings(admin);
    const [publicTab]=await Promise.all([ctx.waitForEvent('page'),admin.locator('a[href="/switch-workspace"]').click()]);
    await publicTab.waitForURL(publicOrigin+'/public/auth.html');
    await waitStatus(publicTab,'Session vérifiée : Particulier');
    assert.equal((await publicTab.evaluate(async()=>await (await fetch('/api/session')).json())).account.id,ids.individual);
    await openSettings(publicTab);
    const [adminTab]=await Promise.all([ctx.waitForEvent('page'),publicTab.locator('a[href="/switch-workspace"]').click()]);
    await adminTab.waitForURL(adminOrigin+'/admin/auth.html');
    await waitStatus(adminTab,'Session vérifiée : Administrateur');
    assert.equal((await adminTab.evaluate(async()=>await (await fetch('/api/session')).json())).account.id,ids.admin);
    assert.equal((await admin.evaluate(async()=>await (await fetch('/api/session')).json())).account.id,ids.admin);
    assert.equal((await page.evaluate(async()=>await (await fetch('/api/session')).json())).account.id,ids.individual);
    await adminTab.close();
    await signIn(publicTab,emails.coach);
    await waitStatus(publicTab,'Session vérifiée : Coach');
    await openSettings(admin);
    const [coachTab]=await Promise.all([ctx.waitForEvent('page'),admin.locator('a[href="/switch-workspace"]').click()]);
    await coachTab.waitForURL(publicOrigin+'/public/auth.html');
    await waitStatus(coachTab,'Session vérifiée : Coach');
    assert.ok(await coachTab.locator('[data-workspace-page="club"]').isVisible());
    assert.equal((await coachTab.evaluate(async()=>await (await fetch('/api/session')).json())).account.id,ids.coach);
    assert.equal((await admin.evaluate(async()=>await (await fetch('/api/session')).json())).account.id,ids.admin);
    await coachTab.close();
    // Restore the public identity expected by the remaining existing scenario.
    await signIn(publicTab,emails.individual);
    await waitStatus(publicTab,'Session vérifiée : Particulier');
    await publicTab.close();await admin.bringToFront();
    assert.equal(await admin.evaluate(async()=> (await fetch('/api/private/taiso/drafts/list',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status),404);

    if(!await admin.locator('[data-workspace-page="accounts"]').isVisible())await admin.locator('[data-nav-page="home"]').click();
    assert.ok(await admin.locator('[data-workspace-page="accounts"]').isVisible());
    assert.equal(await admin.locator('[data-workspace-page="club"]').count(),0);
    assert.equal(await admin.locator('[data-nav-page="club"]').count(),0);
    await admin.locator('[data-nav-page="maintenance"]').click();
    assert.equal(await admin.locator('.jsb-nav [aria-current="page"]').getAttribute('data-nav-page'),'maintenance');
    assert.match(await admin.locator('#workspace').textContent(),/Diagnostic e-mail/);
    assert.doesNotMatch(await admin.locator('#workspace').textContent(),/Licenciés|Présences|Planning/);
    assert.equal(await admin.locator('#mfa').inputValue(),'');
    assert.equal((await admin.evaluate(async()=>await (await fetch('/api/session')).json())).account.role,'admin');
    await admin.locator('#workspace-back').click();
    await admin.locator('[data-workspace-page="catalogue"]').click();
    assert.deepEqual(await swipe(admin),{moving:true,active:'home',reset:true});
    await admin.locator('[data-workspace-page="catalogue"]').click();
    const importDetails=Object.fromEntries(['safety','dosage','successCriteria','level','subgroup','equipment','moment','easier','harder','accessibility','inspiration','format','targetMuscles'].map(k=>[k,'Synthetic '+k]));
    const importFixture={discipline:'taiso',version:'analysis-fixture',exercises:[{reference:'fixture-import',name:'Synthetic import',family:'Synthetic family',details:importDetails}]};
    await admin.locator('#import-file').setInputFiles({name:'fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(importFixture))});
    assert.deepEqual(await swipe(admin),{moving:false,active:'catalogue',reset:true});
    await admin.locator('#import-discipline').selectOption('judo');
    await admin.locator('#import-file').setInputFiles({name:'fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(importFixture))});
    await admin.getByRole('button',{name:'Analyser sans importer'}).click();
    await admin.locator('#import-report').filter({hasText:'Fichier refusé'}).waitFor({state:'visible'});
    await admin.locator('#import-discipline').selectOption('taiso');
    await admin.getByRole('button',{name:'Analyser sans importer'}).click();
    await admin.locator('#import-report').filter({hasText:'Structure conforme'}).waitFor({state:'visible'});
    assert.match(await admin.locator('#import-report').textContent(),/analysis-fixture/);
    assert.equal((await pool.query("SELECT count(*) AS n FROM jsb_catalogue.releases WHERE version='analysis-fixture'")).rows[0].n,'0');
    await admin.locator('#import-file').setInputFiles(fixtureWorkbook);
    await admin.getByRole('button',{name:'Analyser sans importer'}).click();
    await admin.locator('#import-report').filter({hasText:'Structure Excel conforme'}).waitFor({state:'visible',timeout:30000});
    assert.match(await admin.locator('#import-report').textContent(),/228 fiche/);
    assert.match(await admin.locator('#import-report').textContent(),/22 colonnes · 5016 cellules/);
    assert.match(await admin.locator('#import-report').textContent(),/publication interdite/);
    assert.equal((await pool.query("SELECT count(*) AS n FROM jsb_catalogue.releases WHERE version='recette-provisoire'")).rows[0].n,'0');
    await admin.locator('#import-file').setInputFiles({name:'invalid.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from('not an XLSX')});
    await admin.getByRole('button',{name:'Analyser sans importer'}).click();
    await admin.locator('#import-report').filter({hasText:'Fichier refusé'}).waitFor({state:'visible',timeout:30000});

    for(const discipline of ['taiso','judo']){
     await admin.locator('#import-discipline').selectOption(discipline);
     await admin.locator('#import-version').fill('browser-contract-v1');
     await admin.locator('#import-file').setInputFiles(finalWorkbooks[discipline]);
     await admin.getByRole('button',{name:'Analyser sans importer'}).click();
     await admin.locator('#import-report').filter({hasText:'Structure Excel conforme'}).waitFor({state:'visible',timeout:30000});
     const report=await admin.locator('#import-report').textContent();
     assert.match(report,/JSB-EXCEL-1/);
     assert.match(report,new RegExp((discipline==='taiso'?27:35)+' colonnes'));
     assert.match(report,/confirmation distincte requise/);
     assert.ok(await admin.getByRole('button',{name:'Publier le catalogue'}).isDisabled());
    }
    assert.equal((await pool.query("SELECT count(*) AS n FROM jsb_catalogue.releases WHERE version='browser-contract-v1'")).rows[0].n,'0');
    // Explicit publication of a synthetic Judo fixture only, in jsb_ci.
    const publicationVersion='browser-publish-'+name.toLowerCase();
    await admin.locator('#import-discipline').selectOption('judo');
    await admin.locator('#import-version').fill(publicationVersion);
    await admin.locator('#import-file').setInputFiles(finalWorkbooks.judo);
    await admin.getByRole('button',{name:'Analyser sans importer'}).click();
    await admin.locator('#publication-attestation').waitFor({state:'visible',timeout:30000});
    const publishButton=admin.getByRole('button',{name:'Publier le catalogue'});
    assert.ok(await publishButton.isDisabled());
    await admin.locator('#publication-attestation').check();
    await admin.locator('#publication-version').fill('incorrect');
    assert.ok(await publishButton.isDisabled());
    await admin.locator('#publication-version').fill(publicationVersion);
    assert.ok(await publishButton.isEnabled());
    await publishButton.click();
    await admin.locator('#import-report').filter({hasText:'Catalogue publié'}).waitFor({state:'visible',timeout:30000});
    assert.equal((await pool.query("SELECT version FROM jsb_catalogue.current_release WHERE discipline='judo'")).rows[0].version,publicationVersion);
    assert.equal((await pool.query("SELECT version FROM jsb_catalogue.current_release WHERE discipline='taiso'")).rows[0].version,'browser-fixture');
    assert.equal((await pool.query("SELECT count(*) AS n FROM jsb_catalogue.publications WHERE discipline='judo' AND version=$1",[publicationVersion])).rows[0].n,'1');
    assert.equal(await page.evaluate(async()=> (await fetch('/api/admin/catalogue/publish',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status),404);
    await admin.getByRole('button',{name:'Consulter l’historique'}).click();
    await admin.locator('#catalogue-history').filter({hasText:'Version active : '+publicationVersion}).waitFor({state:'visible',timeout:15000});
    if(name==='WebKit'){
     const archived=admin.locator('#catalogue-history section').filter({hasText:'browser-publish-chromium · Archivée'});
     await archived.getByRole('button',{name:'Préparer la restauration'}).click();
     const restore=archived.getByRole('button',{name:'Restaurer cette version'});
     assert.ok(await restore.isDisabled());
     await archived.getByRole('textbox',{name:'Motif de restauration'}).fill('Synthetic regression');
     await archived.getByRole('textbox',{name:'Version à restaurer'}).fill('browser-publish-chromium');
     assert.ok(await restore.isEnabled());
     await restore.click();
     await admin.locator('#catalogue-history').filter({hasText:'Version browser-publish-chromium restaurée'}).waitFor({state:'visible',timeout:15000});
     assert.equal((await pool.query("SELECT version FROM jsb_catalogue.current_release WHERE discipline='judo'")).rows[0].version,'browser-publish-chromium');
     assert.equal((await pool.query("SELECT count(*) AS n FROM jsb_catalogue.publications WHERE discipline='judo'")).rows[0].n,'2');
     assert.equal((await pool.query("SELECT version FROM jsb_catalogue.current_release WHERE discipline='taiso'")).rows[0].version,'browser-fixture');
    }
    assert.equal(await page.evaluate(async()=> (await fetch('/api/admin/catalogue/history',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status),404);
    assert.equal(await page.evaluate(async()=> (await fetch('/api/admin/catalogue/restore',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status),404);


    assert.equal(await page.evaluate(async()=> (await fetch('/api/admin/catalogue/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status),404);
    await openSettings(admin);
    await admin.locator('#logout').click();await waitStatus(admin,'Vous êtes déconnecté');
    assert.equal(await admin.locator('#workspace').textContent(),'');
    assert.equal((await page.evaluate(async()=>await (await fetch('/api/session')).json())).account.id,ids.individual);
    // A failed login can leave its error message visible even though the previous
    // session is valid. Headless bringToFront does not guarantee visibilitychange.
    // The preceding API assertion proves isolation without a reload; then verify
    // the actual page restores the same identity on a fresh navigation.
    await page.bringToFront();
    await openSettings(page);
    await page.locator('#refresh-session').click();
    await waitStatus(page,'Session vérifiée : Particulier');
    assert.equal(await page.locator('#active-session').textContent(),'Compte actif : Particulier');
    const second=await ctx.newPage();
    second.on('pageerror',e=>errors.push(e.message));
    await second.goto(publicOrigin+'/');
    await waitStatus(second,'Session vérifiée : Particulier');
    await page.bringToFront();
    await openSettings(page);
    await page.locator('#logout').click();await waitStatus(page,'Vous êtes déconnecté');
    await second.locator('#active-session').filter({hasText:'Aucun compte connecté'}).waitFor({state:'visible',timeout:15000});
    assert.equal(await second.locator('#workspace').textContent(),'');
    assert.equal(await page.locator('#workspace').textContent(),'');
    assert.ok(await page.locator('#login').isVisible());
    assert.ok(await second.locator('#login').isVisible());
    await second.close();
    assert.equal(await page.evaluate(async()=> (await fetch('/api/session')).status),401);
    // Complete registration and recovery with an in-memory mail provider only.
    const address=registrationEmails[name==='Chromium'?0:1];
    const messages=[];
    const sendMail=createResendTransport({apiKey:'fixture-only',from:'sender@example.test',namespace:'browser-ci-fixture',fetchImpl:async(url,options)=>{
     assert.equal(url,'https://api.resend.com/emails');
     messages.push(JSON.parse(options.body));
     return new Response(JSON.stringify({id:'simulated-'+messages.length}),{status:200});
    }});
    const worker=createDeliveryWorker({store:createDeliveryStore(pool),vault:createDeliveryVault(keyset('browser-mail-ci',22)),allowRecipient:email=>email===address,sendMail});
    async function deliver(){
     assert.equal(await worker.runOnce(),'sent');
     const message=messages.at(-1);assert.deepEqual(message.to,[address]);
     return message.text.split('\n\n')[1];
    }
    await page.locator('[data-panel="register-panel"]').click();
    assert.ok(await page.locator('#register-role').isEnabled());
    assert.deepEqual(await page.locator('#register-role option').evaluateAll(opts=>opts.map(o=>o.value)),['','coach','individual']);
    await page.locator('#register-role').selectOption('coach');
    await page.locator('#register-email').fill(address);
    await page.locator('#register-password').fill(password);
    await page.locator('#register-confirm').fill(password+' mismatch');
    await page.locator('#register-form button[type=submit]').click();
    await waitStatus(page,'Les deux mots de passe doivent être identiques');
    assert.equal(await page.locator('#register-password').inputValue(),'');
    await page.locator('#register-password').fill(password);
    await page.locator('#register-confirm').fill(password);
    await page.locator('#register-form button[type=submit]').click();
    await waitStatus(page,'Demande enregistrée');
    assert.ok(await page.locator('#verify-panel').isVisible());
    const original=await deliver();
    await page.locator('#resend-email').fill(address);
    await page.locator('#resend-form button[type=submit]').click();
    await waitStatus(page,'nouveau code pourra être envoyé');
    const replacement=await deliver();
    assert.notEqual(original,replacement);
    await page.locator('#verify-code').fill(original);
    await page.locator('#verify-form button[type=submit]').click();
    await waitStatus(page,'Code invalide');
    await page.locator('#verify-code').fill(replacement);
    await page.locator('#verify-form button[type=submit]').click();
    await waitStatus(page,'Adresse confirmée');
    await signIn(page,address);await waitStatus(page,'Session vérifiée : Coach');
    await openSettings(page);
    await page.locator('[data-panel="reset-request-panel"]').click();
    await page.locator('#reset-email').fill(address);
    await page.locator('#reset-request-form button[type=submit]').click();
    await waitStatus(page,'Demande enregistrée');
    assert.ok(await page.locator('#reset-confirm-panel').isVisible());
    const resetCode=await deliver(),newPassword=password+' nouvelle';
    await page.locator('#reset-code').fill(resetCode);
    await page.locator('#reset-password').fill(newPassword);
    await page.locator('#reset-confirm').fill(newPassword);
    await page.locator('#reset-confirm-form button[type=submit]').click();
    await waitStatus(page,'Mot de passe réinitialisé');
    assert.equal(await page.evaluate(async()=> (await fetch('/api/session')).status),401);
    await signIn(page,address);await waitStatus(page,'Identifiants incorrects');
    await page.locator('#email').fill(address);
    await page.locator('#password').fill(newPassword);
    await page.locator('#login button[type=submit]').click();
    await waitStatus(page,'Session vérifiée : Coach');
    await openSettings(page);
    await page.locator('#logout').click();await waitStatus(page,'Vous êtes déconnecté');
    assert.equal(await worker.runOnce(),'idle');
    assert.equal(await admin.locator('#account-actions').count(),0);
    assert.deepEqual(errors,[]);
    assert.ok(network.filter(x=>x.path==='/api/login'||x.path==='/api/logout').every(x=>x.origin==='same-origin'),name+' : Origin des mutations');
    console.log('Recette '+name+' : parcours et isolation réussis.');
    await ctx.close();
   }catch(e){console.error('Diagnostic HTTP '+name+': '+JSON.stringify(network));throw new Error('Recette '+name+' : '+e.message,{cause:e});}finally{await browser.close();}
  }
 }finally{
  try{
   for(const server of servers){server.closeAllConnections();await new Promise(resolve=>server.close(()=>resolve()));}
   if(safe){await pool.query("DELETE FROM jsb_catalogue.restorations WHERE restored_version IN ('browser-publish-chromium','browser-publish-webkit')");await pool.query("DELETE FROM jsb_catalogue.publications WHERE version IN ('browser-publish-chromium','browser-publish-webkit')");await pool.query("DELETE FROM jsb_catalogue.current_release WHERE version IN ('browser-publish-chromium','browser-publish-webkit')");await pool.query("DELETE FROM jsb_catalogue.exercises WHERE version IN ('browser-publish-chromium','browser-publish-webkit')");await pool.query("DELETE FROM jsb_catalogue.releases WHERE version IN ('browser-publish-chromium','browser-publish-webkit')");await pool.query("DELETE FROM jsb_catalogue.publications WHERE discipline='taiso' AND version='browser-fixture'");await pool.query("DELETE FROM jsb_catalogue.current_release WHERE version='browser-fixture'");await pool.query("DELETE FROM jsb_catalogue.exercises WHERE version='browser-fixture'");await pool.query("DELETE FROM jsb_catalogue.releases WHERE version='browser-fixture'");await pool.query('DELETE FROM jsb_auth.accounts WHERE email=ANY($1::text[])',[[...Object.values(emails),...registrationEmails]]);await pool.query('DELETE FROM jsb_auth.quota_events');}
  }finally{await pool.end();rmSync(dir,{recursive:true,force:true});}
 }
});
