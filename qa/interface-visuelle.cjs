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
    await page.getByRole('region',{name:'Tableau de bord'}).waitFor();
    assert.equal(await page.locator('.aujourdhui .tuile').count(),6);
    await page.getByRole('heading',{name:'Activité récente',exact:true}).waitFor();
    const palette=await page.evaluate(()=>{
      const s=getComputedStyle(document.documentElement);
      const read=k=>s.getPropertyValue(k).trim();
      return {bg:read('--bg'),surface:read('--surface'),navy:read('--jsb-brand-navy'),gold:read('--jsb-brand-gold'),accent:read('--jsb-accent'),accentInk:read('--jsb-accent-ink')};
    });
    assert.equal(palette.navy,'#1f2839');
    assert.equal(palette.gold,'#dab174');
    assert.equal(palette.bg,theme==='light'?'#f4f5ef':'#151c29');
    assert.equal(palette.surface,theme==='light'?'#ffffff':'#1f2839');
    assert.equal(palette.accent,theme==='light'?'#1f2839':'#dab174');
    assert.equal(palette.accentInk,theme==='light'?'#76511f':'#dab174');
    // Vérifier les couleurs effectivement peintes, et leur contraste.
    const painted=await page.locator('.accueil-preparer > summary').evaluate(n=>{
      const s=getComputedStyle(n);return {fg:s.color,bg:s.backgroundColor,border:s.borderTopColor};
    });
    assert.equal(painted.fg,theme==='light'?'rgb(255, 255, 255)':'rgb(244, 245, 239)');
    assert.equal(painted.border,theme==='light'?'rgb(31, 40, 57)':'rgb(218, 177, 116)');
    const checkActiveNav=async()=>{
      const active=await nav.locator('button[aria-current="page"]').evaluate(n=>{
        const color=el=>getComputedStyle(el).color;
        const bar=n.closest('.onglets');
        return {button:color(n),label:color(n.querySelector('.onglet-txt')),icon:color(n.querySelector('svg')),
          background:innerWidth<960?getComputedStyle(bar,'::after').backgroundColor:getComputedStyle(n).backgroundColor,
          buttonBg:getComputedStyle(n).backgroundColor,mobile:innerWidth<960};
      });
      const fg=theme==='light'?'rgb(118, 81, 31)':'rgb(218, 177, 116)';
      assert.equal(active.button,fg,JSON.stringify(active));
      assert.equal(active.label,fg,JSON.stringify(active));
      assert.equal(active.icon,fg,JSON.stringify(active));
      assert.equal(active.background,theme==='light'?'rgb(247, 236, 217)':'rgb(58, 52, 45)');
      if(active.mobile)assert.equal(active.buttonBg,'rgba(0, 0, 0, 0)');
    };
    await checkActiveNav();
    await snapshot('01-accueil');
    await page.locator('.accueil-preparer > summary').click();
    await page.locator('.accueil-disciplines').getByRole('button',{name:'Taïso',exact:true}).click();
    await page.locator('.gn[role="dialog"]').waitFor({state:'visible',timeout:45000});
    await snapshot('09-action-principale');
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await nav.waitFor({timeout:45000});
    for(const [n,label] of ['Judo','Taïso','Séances','Présences'].entries()){
     await nav.getByRole('button',{name:label,exact:true}).click();
     await page.locator('.appbar-titre strong').waitFor({state:'visible'});
     assert.equal(await nav.getByRole('button',{name:label,exact:true}).getAttribute('aria-current'),'page');
     await checkActiveNav();
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
    // Contrôle des interactions normales puis réduites : aucun geste métier modifié.
    await page.setViewportSize(engine==='webkit'?{width:390,height:844}:{width:1440,height:900});
    await page.emulateMedia({reducedMotion:'no-preference'});
    await nav.getByRole('button',{name:'Accueil',exact:true}).click();
    await nav.getByRole('button',{name:'Judo',exact:true}).click();
    await page.locator('.page.va-avant').waitFor({state:'visible'});
    const motion=async()=>page.evaluate(()=>{
      const content=document.querySelector('.page > .wrap > :not(.appbar)');
      const bar=document.querySelector('.appbar');
      const style=getComputedStyle(content);
      return {name:style.animationName,duration:parseFloat(style.animationDuration),header:getComputedStyle(bar).animationName};
    });
    const forward=await motion();
    assert.equal(forward.name,'jsb-ui-avant');
    assert.ok(Math.abs(forward.duration-.24)<.001,JSON.stringify(forward));
    assert.equal(forward.header,'none');
    await page.getByRole('button',{name:"Retour à l'accueil",exact:true}).click();
    await page.locator('.page.va-arriere').waitFor({state:'visible'});
    assert.equal((await motion()).name,'jsb-ui-retour');
    await page.emulateMedia({reducedMotion:'reduce'});
    await nav.getByRole('button',{name:'Judo',exact:true}).click();
    await page.locator('.page.va-avant').waitFor({state:'visible'});
    assert.equal((await motion()).name,'none');
    // Tester également le réglage interne, distinct de celui du système.
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.evaluate(()=>{const key='jsb-affichage',old=JSON.parse(localStorage.getItem(key)||'{}');localStorage.setItem(key,JSON.stringify({...old,v:2,animations:true}));});
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await nav.waitFor({timeout:45000});
    await page.waitForFunction(()=>document.documentElement.getAttribute('data-anim')==='reduit');
    await nav.getByRole('button',{name:'Judo',exact:true}).click();
    await page.locator('.page.va-avant').waitFor({state:'visible'});
    assert.equal((await motion()).name,'none');
    await page.keyboard.press('Tab');
    const focus=await page.evaluate(()=>{
      const el=document.activeElement,style=getComputedStyle(el);
      return {tag:el.tagName,outline:style.outlineStyle,width:parseFloat(style.outlineWidth)};
    });
    assert.ok(focus.tag!=='BODY' && focus.outline!=='none' && focus.width>=2,JSON.stringify(focus));
    console.log('PASS interactions',engine,theme,JSON.stringify({forward,focus}));
    assert.deepEqual(errors,[],'Exceptions JavaScript');
    console.log('PASS',engine,theme,JSON.stringify(metrics));
   } finally{await context.close();}
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
