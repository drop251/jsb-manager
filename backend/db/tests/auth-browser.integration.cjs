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
const {codeForStep}=require('../../admin-mfa.cjs');
const {hashPassword}=require('../../passwords.cjs');
const password='Phrase de passe JSB navigateur CI !';
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
 await page.locator('button[type=submit]').click();
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
  const handlers=new Map();
  async function start(app,host){
   const server=https.createServer(tls,(req,res)=>{
    const handler=handlers.get(app);
    if(!handler){res.writeHead(503);res.end();return;}
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
  for(const [name,launcher] of [['Chromium',chromium],['WebKit',webkit]]){
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
    await signIn(page,emails.coach);await waitStatus(page,'Session vérifiée : Coach');
    assert.equal(await page.locator('#password').inputValue(),'');
    let cookies=await ctx.cookies(publicOrigin);
    const first=cookies.find(c=>c.name==='__Host-jsb-public');
    assert.ok(first?.secure&&first?.httpOnly&&first?.sameSite==='Strict');
    assert.ok(!(await page.evaluate(()=>document.cookie)).includes('__Host-jsb-public'));
    await signIn(page,emails.individual);await waitStatus(page,'Session vérifiée : Particulier');
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
    assert.equal(await admin.locator('#mfa').inputValue(),'');
    assert.equal((await admin.evaluate(async()=>await (await fetch('/api/session')).json())).account.role,'admin');
    await admin.locator('#logout').click();await waitStatus(admin,'Vous êtes déconnecté');
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
    await second.close();
    assert.equal(await page.evaluate(async()=> (await fetch('/api/session')).status),401);
    assert.deepEqual(errors,[]);
    await ctx.close();
   }catch(e){throw new Error('Recette '+name+' : '+e.message,{cause:e});}finally{await browser.close();}
  }
 }finally{
  try{
   for(const server of servers){server.closeAllConnections();await new Promise(resolve=>server.close(()=>resolve()));}
   if(safe){await pool.query('DELETE FROM jsb_auth.accounts WHERE email=ANY($1::text[])',[Object.values(emails)]);await pool.query('DELETE FROM jsb_auth.quota_events');}
  }finally{await pool.end();rmSync(dir,{recursive:true,force:true});}
 }
});
