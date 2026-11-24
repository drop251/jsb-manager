'use strict';
const assert = require('node:assert/strict');
const { chromium, webkit, devices } = require('playwright');
const engine = process.env.JSB_ENGINE || 'webkit';
const url = process.env.JSB_URL;
if (!url || !['webkit','chromium'].includes(engine)) throw Error('JSB_URL et JSB_ENGINE requis');
(async () => {
  const browser = await ({ chromium, webkit }[engine]).launch();
  const context = await browser.newContext(engine === 'webkit' ? {...devices['iPhone 13']} : {viewport:{width:1440,height:900}});
  const errors = [];
  async function newPage() {
    const p = await context.newPage();
    p.on('pageerror', e => errors.push(String(e)));
    return p;
  }
  async function ready(p) {
    await p.locator('nav[aria-label="Navigation principale"]').waitFor({state:'visible',timeout:45000});
    assert.equal(await p.locator('.garde,#erreur-globale').count(),0,'Erreur applicative');
    assert.equal(await p.evaluate(() => !!(window.React && window.ReactDOM && window.XLSX && window.jspdf && window.jspdf.jsPDF)),true,'Bibliothèque absente');
  }
  async function navigate(p) {
    const nav=p.locator('nav[aria-label="Navigation principale"]');
    for (const label of ['Judo','Taïso']) {
      await nav.getByRole('button',{name:label,exact:true}).click();
      await p.locator('.appbar-titre strong').getByText(label,{exact:true}).waitFor({state:'visible'});
      assert.equal(await p.locator('.garde,#erreur-globale').count(),0);
    }
    await p.getByRole('button',{name:"Retour à l'accueil",exact:true}).click();
    await p.getByRole('heading',{name:'Préparer une séance',exact:true}).waitFor();
  }
  try {
    let p=await newPage();
    const response=await p.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
    assert.ok(response && response.ok(),'Navigation initiale');
    await ready(p);
    await navigate(p);
    const result=await p.evaluate(() => {
      const wb=XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['test'],[42]]),'Test');
      const read=XLSX.read(XLSX.write(wb,{type:'array',bookType:'xlsx'}),{type:'array'});
      const pdf=new window.jspdf.jsPDF(); pdf.text('JSB test',10,10);
      return {excel:XLSX.utils.sheet_to_json(read.Sheets.Test,{header:1})[1][0],pdf:pdf.output().startsWith('%PDF-')};
    });
    assert.deepEqual(result,{excel:42,pdf:true});
    console.log('PASS démarrage, navigation Judo/Taïso, bibliothèques Excel et PDF');
    await p.waitForFunction(() => !!navigator.serviceWorker.controller,null,{timeout:45000});
    const cache=await p.evaluate(async () => {
      const reg=await navigator.serviceWorker.ready;
      const files=['./index.html','./vendor/react.js','./vendor/react-dom.js','./vendor/xlsx.js','./vendor/jspdf.js'];
      return {active:!!reg.active,files:await Promise.all(files.map(async f=>!!(await caches.match(new URL(f,location.href)))))};
    });
    assert.equal(cache.active,true); assert.ok(cache.files.every(Boolean),'Ressource de pré-cache absente');
    await p.close();
    await context.setOffline(true);
    p=await newPage();
    await p.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
    await ready(p); await navigate(p);
    console.log('PASS service worker actif, pré-cache complet, réouverture hors ligne et navigation');
    assert.deepEqual(errors,[],'Exceptions JavaScript navigateur');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
