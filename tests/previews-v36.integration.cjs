'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const {chromium}=require('playwright');
const file=kind=>pathToFileURL(path.resolve(__dirname,'../apps',kind,'index.html')).href;
test('Prévisualisations indépendantes : Coach, Particulier, Admin, mobile et desktop',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const viewport of [{width:390,height:844},{width:1440,height:900}]){
   for(const kind of ['public','admin']){
    const context=await browser.newContext({viewport});
    const page=await context.newPage(),errors=[],requests=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
    await page.goto(file(kind));
    assert.equal(await page.locator('h1').textContent(),kind==='public'?'Mon espace':'Tableau de bord');
    assert.equal(await page.locator('aside').count(),1);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    const initial=await page.locator('html').getAttribute('data-theme');
    await page.locator('#theme').click();
    assert.notEqual(await page.locator('html').getAttribute('data-theme'),initial);
    if(kind==='public'){
     await page.getByRole('button',{name:'Gestion du club',exact:false}).click();
     assert.equal(await page.locator('h1').textContent(),'Gestion du club');
     assert.equal(await page.getByRole('button',{name:/Licenciés/}).count(),1);
     await page.getByRole('button',{name:'Particulier',exact:true}).click();
     assert.equal(await page.getByRole('button',{name:/Gestion du club/}).count(),0);
     await page.getByRole('button',{name:/Suivi personnel/}).click();
     assert.equal(await page.locator('h1').textContent(),'Suivi personnel');
     await page.locator('nav').getByRole('button',{name:'Réglages'}).click();
     await page.getByRole('button',{name:/Gestion des comptes/}).click();
     await page.getByRole('button',{name:/Changer de compte/}).click();
     assert.equal(await page.getByRole('button',{name:'Coach',exact:true}).getAttribute('aria-pressed'),'true');
     await page.locator('nav').getByRole('button',{name:'Judo'}).click();
     assert.equal(await page.getByRole('button',{name:/Préparer une séance Judo/}).count(),1);
     await page.locator('nav').getByRole('button',{name:'Taïso'}).click();
     assert.equal(await page.getByRole('button',{name:/Préparer une séance Taïso/}).count(),1);
    }else{
     for(const title of ['Comptes plateforme','Statistiques','Catalogue de référence','Documents légaux','Tests des générateurs','Maintenance']){
      await page.getByRole('button',{name:new RegExp(title)}).click();
      assert.equal(await page.locator('h1').textContent(),title);
      await page.getByRole('button',{name:/Retour/}).click();
     }
     assert.equal(await page.getByRole('button',{name:/Licenciés|Présences|Planning|Changer de compte/}).count(),0);
    }
    assert.equal(await page.locator('form,input[type=password]').count(),0);
    assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
    await context.close();
   }
  }
 }finally{await browser.close();}
});
