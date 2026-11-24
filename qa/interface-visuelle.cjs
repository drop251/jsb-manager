'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium,webkit,devices}=require('playwright');
const engine=process.env.JSB_ENGINE;
const base='http://localhost:8765/';
fs.mkdirSync('qa-captures',{recursive:true});
(async()=>{
 const browser=await ({webkit,chromium}[engine]).launch();
 try {
  for(const theme of ['light','dark']){
   const context=await browser.newContext({
    ...(engine==='webkit'?devices['iPhone 13']:{viewport:{width:1440,height:900}}),
    colorScheme:theme,reducedMotion:'reduce',serviceWorkers:'block'
   });
   try{
    const page=await context.newPage(), errors=[];
    page.on('pageerror',e=>errors.push(String(e)));
    await page.goto(base,{waitUntil:'domcontentloaded'});
    const nav=page.getByRole('navigation',{name:'Navigation principale'});
    await nav.waitFor({timeout:45000});
    await page.waitForFunction(()=>Array.from(document.styleSheets).some(s=>s.href&&s.href.endsWith('/ui/interface.css')));
    await page.evaluate(()=>document.fonts.ready);
    const snapshot=async name=>{
     await page.screenshot({path:'qa-captures/'+engine+'-'+theme+'-'+name+'.png',animations:'disabled'});
     assert.equal(await page.locator('.garde,#erreur-globale').count(),0);
    };
    const metrics=await nav.locator('button').evaluateAll(bs=>bs.map(b=>{
      const r=b.getBoundingClientRect(),label=b.querySelector('.onglet-txt'),s=getComputedStyle(label);
      return {text:label.textContent,height:r.height,width:r.width,visible:r.left>=-1&&r.right<=innerWidth+1,font:s.fontSize};
    }));
    assert.equal(metrics.length,5);
    for(const m of metrics){assert.ok(m.height>=44&&m.width>=44&&m.visible,JSON.stringify(m));assert.equal(m.font,'12px');}
    await snapshot('01-accueil');
    for(const [n,label] of ['Judo','Taïso','Séances','Présences'].entries()){
     await nav.getByRole('button',{name:label,exact:true}).click();
     await page.locator('.appbar-titre strong').waitFor({state:'visible'});
     assert.equal(await nav.getByRole('button',{name:label,exact:true}).getAttribute('aria-current'),'page');
     if(label==='Présences'){
      await page.getByRole('tablist',{name:'Présences',exact:true}).waitFor({state:'visible',timeout:45000});
      assert.equal(await page.getByText('Chargement des présences…',{exact:true}).count(),0);
     }
     await snapshot('0'+(n+2)+'-'+label.toLowerCase().replace('ï','i').replace('é','e'));
     if(label==='Taïso'){
      const open=page.getByRole('button',{name:'Générer une séance',exact:true});
      if(await open.isVisible()){
       await open.click();
       await page.locator('.gn[role="dialog"]').waitFor({state:'visible'});
       await snapshot('06-generateur');
       // Fermer par le bouton système, sans créer ni modifier une séance.
       await page.keyboard.press('Escape');
       if(await page.locator('.gn[role="dialog"]').isVisible()){
        const cancel=page.getByRole('button',{name:'Annuler la préparation',exact:true});
        if(await cancel.isVisible()){page.once('dialog',d=>d.accept());await cancel.click();}
       }
       // Le scénario suivant dispose d'un nouveau document pour éviter toute interaction derrière un dialogue.
       await page.goto(base,{waitUntil:'domcontentloaded'});
       await nav.waitFor({timeout:45000});
      }else{throw Error('Commande générateur absente');}
     }
    }
    await page.locator('.cx-avatar.petit').click();
    await page.getByRole('menuitem',{name:'Affichage et accessibilité'}).click();
    await page.getByRole('dialog',{name:'Affichage et accessibilité'}).waitFor();
    await snapshot('07-reglages');
    // Revenir à une page propre avant de changer la géométrie.
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await nav.waitFor({timeout:45000});
    const viewports=engine==='webkit'
      ? [{width:320,height:568},{width:844,height:390},{width:768,height:1024}]
      : [{width:320,height:568},{width:1024,height:768},{width:1920,height:1080}];
    for(const size of viewports){
      await page.setViewportSize(size);
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const layout=await page.evaluate(()=>{
        const b=[...document.querySelectorAll('.onglet-nav')];
        return {
          viewport:innerWidth, scroll:document.documentElement.scrollWidth,
          buttons:b.map(el=>{
            const r=el.getBoundingClientRect(),t=el.querySelector('.onglet-txt');
            return {name:t.textContent,w:r.width,h:r.height,x:r.left,right:r.right,top:r.top,bottom:r.bottom,
              labelFits:t.scrollWidth<=t.clientWidth+2};
          })
        };
      });
      assert.equal(layout.buttons.length,5);
      assert.ok(layout.scroll<=layout.viewport+2,JSON.stringify(layout));
      for(const b of layout.buttons){
        assert.ok(b.w>=44 && b.h>=44 && b.x>=-1 && b.right<=layout.viewport+1 && b.top>=-1 && b.bottom<=size.height+1 && b.labelFits,JSON.stringify({size,b}));
      }
      const details=await page.locator('.aujourdhui .tuile small').evaluateAll(nodes=>nodes.map(n=>{
       const s=getComputedStyle(n),r=n.getBoundingClientRect(),card=n.closest('.tuile').getBoundingClientRect();
       return {text:n.textContent,wrap:s.whiteSpace,overflow:s.textOverflow,inside:r.left>=card.left-1&&r.right<=card.right+1,
        fits:n.scrollWidth<=n.clientWidth+2};
      }));
      assert.ok(details.length>=2,'Descriptions accueil absentes');
      for(const d of details)assert.ok(d.wrap==='normal'&&d.overflow==='clip'&&d.inside&&d.fits,JSON.stringify({size,d}));
      await snapshot('08-'+size.width+'x'+size.height);
      console.log('PASS responsive',engine,theme,JSON.stringify({size,layout}));
    }
    assert.deepEqual(errors,[],'Exceptions JavaScript');
    console.log('PASS',engine,theme,JSON.stringify(metrics));
   } finally{await context.close();}
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
