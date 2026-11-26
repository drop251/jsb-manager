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
async function signIn(page,email,code){
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
  runtime=createAuthRuntime({pool,publicOrigin,adminOrigin,sourceId:req=>req.socket.remoteAddress,quotaSecret:Buffer.alloc(32,21),deliveryKeys:keyset('browser-mail-ci',22),mfaKeys});
  assert.equal(await runtime.checkReady(),true);
  for(const [app,origin,authHandler] of [['public',publicOrigin,runtime.publicHandler],['admin',adminOrigin,runtime.adminHandler]]){
   const directory=path.join(dir,app);
   await build(app,directory);
   // Synthetic access gateway, only on the isolated loopback CI listeners.
   handlers.set(app,await createPreproductionHandler({app,origin,directory,authHandler,authorizeAccess:req=>['127.0.0.1','127.0.0.2'].includes(req.socket.remoteAddress)}));
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
    assert.ok(await page.locator('#password').isEnabled(),name);
    assert.equal(await page.locator('#workspace').isVisible(),false);
    assert.equal(await page.locator('#workspace').textContent(),'');
    await signIn(page,emails.coach);await waitStatus(page,'Session vérifiée : Coach');
    assert.equal(await page.locator('#password').inputValue(),'');
    assert.ok(await page.locator('#workspace').isVisible());
    assert.ok(await page.locator('[data-workspace-page="club"]').isVisible());
    assert.equal(await page.locator('[data-workspace-page="personal"]').count(),0);
    await page.locator('[data-workspace-page="judo"]').click();
    assert.match(await page.locator('#workspace').textContent(),/Préparer une séance Judo/);
    await page.locator('#workspace-back').click();
    await page.locator('[data-workspace-page="taiso"]').click();
    await page.locator('#catalogue-results summary').filter({hasText:'Fixture Alpha'}).waitFor({state:'visible'});
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
    await signIn(page,emails.admin);await waitStatus(page,'Identifiants incorrects');
    assert.equal(await page.locator('#active-session').textContent(),'Compte actif : Particulier');
    assert.equal((await page.evaluate(async()=>await (await fetch('/api/session')).json())).account.id,ids.individual);
    await admin.bringToFront();
    await admin.goto(adminOrigin+'/');
    assert.equal(new URL(admin.url()).pathname,'/admin/auth.html');
    await waitStatus(admin,'Connectez-vous');
    assert.equal((await ctx.cookies(adminOrigin)).some(c=>c.name==='__Host-jsb-public'),false);
    assert.equal((await admin.evaluate(async()=> (await fetch('/public/auth.html')).status)),404);
    assert.equal((await page.evaluate(async()=> (await fetch('/admin/auth.html')).status)),404);
    await signIn(admin,emails.coach,'123456');await waitStatus(admin,'Identifiants incorrects');
    await signIn(admin,emails.admin,codeForStep(secret,Math.floor(Date.now()/30000)));
    await waitStatus(admin,'Session vérifiée : Administrateur');
    assert.ok(await admin.locator('#mfa').isDisabled());
    assert.ok(await admin.locator('[data-workspace-page="accounts"]').isVisible());
    assert.equal(await admin.locator('[data-workspace-page="club"]').count(),0);
    await admin.locator('[data-workspace-page="maintenance"]').click();
    assert.match(await admin.locator('#workspace').textContent(),/Diagnostic e-mail/);
    assert.doesNotMatch(await admin.locator('#workspace').textContent(),/Licenciés|Présences|Planning/);
    assert.equal(await admin.locator('#mfa').inputValue(),'');
    assert.equal((await admin.evaluate(async()=>await (await fetch('/api/session')).json())).account.role,'admin');
    await admin.locator('#workspace-back').click();
    await admin.locator('[data-workspace-page="catalogue"]').click();
    const importDetails=Object.fromEntries(['safety','dosage','successCriteria','level','subgroup','equipment','moment','easier','harder','accessibility','inspiration','format','targetMuscles'].map(k=>[k,'Synthetic '+k]));
    const importFixture={discipline:'taiso',version:'analysis-fixture',exercises:[{reference:'fixture-import',name:'Synthetic import',family:'Synthetic family',details:importDetails}]};
    await admin.locator('#import-file').setInputFiles({name:'fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(importFixture))});
    await admin.locator('#import-discipline').selectOption('judo');
    await admin.locator('#import-file').setInputFiles({name:'fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(importFixture))});
    await admin.getByRole('button',{name:'Analyser sans importer'}).click();
    await admin.locator('#import-report').filter({hasText:'Fichier refusé'}).waitFor({state:'visible'});
    await admin.locator('#import-discipline').selectOption('taiso');
    await admin.getByRole('button',{name:'Analyser sans importer'}).click();
    await admin.locator('#import-report').filter({hasText:'Structure conforme'}).waitFor({state:'visible'});
    assert.match(await admin.locator('#import-report').textContent(),/analysis-fixture/);
    assert.equal((await pool.query("SELECT count(*) AS n FROM jsb_catalogue.releases WHERE version='analysis-fixture'")).rows[0].n,'0');
    assert.equal(await page.evaluate(async()=> (await fetch('/api/admin/catalogue/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status),404);
    await admin.locator('#logout').click();await waitStatus(admin,'Vous êtes déconnecté');
    assert.equal(await admin.locator('#workspace').textContent(),'');
    assert.equal((await page.evaluate(async()=>await (await fetch('/api/session')).json())).account.id,ids.individual);
    // A failed login can leave its error message visible even though the previous
    // session is valid. Headless bringToFront does not guarantee visibilitychange.
    // The preceding API assertion proves isolation without a reload; then verify
    // the actual page restores the same identity on a fresh navigation.
    await page.bringToFront();
    await page.locator('#refresh-session').click();
    await waitStatus(page,'Session vérifiée : Particulier');
    assert.equal(await page.locator('#active-session').textContent(),'Compte actif : Particulier');
    const second=await ctx.newPage();
    second.on('pageerror',e=>errors.push(e.message));
    await second.goto(publicOrigin+'/');
    await waitStatus(second,'Session vérifiée : Particulier');
    await page.bringToFront();
    await page.locator('#logout').click();await waitStatus(page,'Vous êtes déconnecté');
    await second.locator('#active-session').filter({hasText:'Aucun compte connecté'}).waitFor({state:'visible',timeout:15000});
    assert.equal(await second.locator('#workspace').textContent(),'');
    assert.equal(await page.locator('#workspace').textContent(),'');
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
   if(safe){await pool.query("DELETE FROM jsb_catalogue.current_release WHERE version='browser-fixture'");await pool.query("DELETE FROM jsb_catalogue.exercises WHERE version='browser-fixture'");await pool.query("DELETE FROM jsb_catalogue.releases WHERE version='browser-fixture'");await pool.query('DELETE FROM jsb_auth.accounts WHERE email=ANY($1::text[])',[[...Object.values(emails),...registrationEmails]]);await pool.query('DELETE FROM jsb_auth.quota_events');}
  }finally{await pool.end();rmSync(dir,{recursive:true,force:true});}
 }
});
