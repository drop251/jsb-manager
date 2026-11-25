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
    await page.waitForFunction(()=>Array.from(document.styleSheets).some(s=>s.href&&new URL(s.href).pathname.endsWith('/ui/interface.css')&&new URL(s.href).searchParams.has('v')));
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
    await page.getByText('Espace administrateur',{exact:true}).waitFor();
    await page.getByRole('heading',{name:'Catalogue et espaces',exact:true}).waitFor();
    assert.equal(await page.locator('.accueil-catalogue .bloc').filter({hasText:/^(Mes séances|Présences)$/}).count(),0);
    await page.locator('.cx-avatar.petit').click();
    await page.getByRole('menuitem',{name:'Ajouter des exercices',exact:true}).waitFor();
    await page.locator('.cx-avatar.petit').click();

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
     if((label==='Taïso'||label==='Judo') && engine==='webkit'){
      const layout=await page.evaluate(()=>{
       const wrap=document.querySelector('.wrap:has(> .catalogue-types)');
       if(!wrap)return null;
       const rect=n=>{const r=n.getBoundingClientRect();return {x:r.left,right:r.right,y:r.top,w:r.width,h:r.height};};
       const types=[...wrap.querySelectorAll('.catalogue-types > button')].map(rect);
       const search=wrap.querySelector('.barre-recherche .cherche');
       const filters=wrap.querySelector('.barre-recherche .filtres-btn');
       const gen=wrap.querySelector('.barre-seance .gn-ouvrir');
       const family=wrap.querySelector('.catalogue-familles');
       const familyStyle=family&&getComputedStyle(family);
       return {width:innerWidth,height:innerHeight,gap:getComputedStyle(wrap).gap,types,
         search:rect(search),filters:rect(filters),gen:rect(gen),
         searchFont:getComputedStyle(search).fontSize,
         family:family?{height:rect(family).h,marginTop:familyStyle.marginTop,marginBottom:familyStyle.marginBottom}:null};
      });
      assert.ok(layout,'Catalogue absent');
      assert.ok(await page.locator('.wrap > .barre-recherche').evaluate(el=>{const group=el.parentElement.querySelector('.sousgrille');return !group || Boolean(el.compareDocumentPosition(group)&Node.DOCUMENT_POSITION_FOLLOWING);}), 'Recherche avant les sous-groupes');
      await page.getByRole('searchbox',{name:'Rechercher une fiche'}).fill('jsb-aucun-resultat-qa');
      assert.equal(await page.locator('.barre-compte .compte').textContent(),'0 fiches');
      await page.getByRole('searchbox',{name:'Rechercher une fiche'}).fill('');

      assert.equal(layout.types.length,3);
      assert.equal(layout.gap,'10px');
      assert.ok(layout.types.every(t=>t.h>=44&&t.x>=0&&t.right<=layout.width+1),JSON.stringify(layout));
      assert.ok(layout.types.every(t=>Math.abs(t.y-layout.types[0].y)<2),'Types sur plusieurs rangées');
      for(const r of [layout.search,layout.filters,layout.gen])assert.ok(r.h>=44&&r.x>=0&&r.right<=layout.width+1,JSON.stringify(layout));
      assert.ok(parseFloat(layout.searchFont)>=16,'Champ de recherche inférieur à 16px');
      if(layout.family){assert.equal(layout.family.marginTop,'0px');assert.equal(layout.family.marginBottom,'0px');}
      await page.getByRole('button',{name:'Filtres',exact:true}).click();
      await page.getByRole('dialog',{name:'Filtres',exact:true}).waitFor({state:'visible'});
      await page.getByRole('button',{name:'Fermer les filtres',exact:true}).click();
      await page.getByRole('dialog',{name:'Filtres',exact:true}).waitFor({state:'hidden'});
      console.log('PASS catalogue mobile',theme,label,JSON.stringify(layout));
     }
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
    const settings=page.getByRole('dialog',{name:'Affichage et accessibilité'});
    const versionStatus=settings.locator('#jsb-maj-etat');
    assert.match(await versionStatus.textContent(),/20261125-v23/);
    const updateButton=settings.getByRole('button',{name:'Vérifier les mises à jour',exact:true});
    const beforeUpdate=await page.evaluate(()=>JSON.stringify(localStorage));
    await page.route('**/index.html?jsb-version-check=*',route=>route.fulfill({status:200,headers:{'X-JSB-Version-Check':'network'},body:"setAttribute('data-jsb-version', '20261125-v23')"}));
    await updateButton.click();
    await page.getByText('Version à jour : 20261125-v23',{exact:true}).waitFor();
    assert.equal(await page.evaluate(()=>JSON.stringify(localStorage)),beforeUpdate);
    await page.unroute('**/index.html?jsb-version-check=*');
    await page.route('**/index.html?jsb-version-check=*',route=>route.abort());
    await updateButton.click();
    await page.getByText(/Vérification indisponible/).waitFor();
    assert.equal(await page.evaluate(()=>JSON.stringify(localStorage)),beforeUpdate);
    await page.unroute('**/index.html?jsb-version-check=*');
    const themes=settings.getByRole('group',{name:'Thème',exact:true});
    const themeRadio=label=>themes.getByRole('radio',{name:label,exact:true});
    assert.ok(await themeRadio('Système').isChecked());
    const readTheme=()=>page.evaluate(()=>({mode:document.documentElement.getAttribute('data-theme'),bg:getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),scheme:getComputedStyle(document.documentElement).colorScheme}));
    for(const [label,mode,bg] of [['Clair','light','#f4f5ef'],['Sombre','dark','#151c29']]){
      await themeRadio(label).check();
      assert.deepEqual(await readTheme(),{mode,bg,scheme:mode});
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('jsb-affichage')).theme),mode);
      await snapshot('15-theme-'+mode);
    }
    // Explicit preference survives reload, even against OS color scheme.
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await nav.waitFor({timeout:45000});
    await page.waitForFunction(()=>Array.from(document.styleSheets).some(s=>s.href&&new URL(s.href).pathname.endsWith('/ui/interface.css')&&new URL(s.href).searchParams.has('v')));
    assert.deepEqual(await readTheme(),{mode:'dark',bg:'#151c29',scheme:'dark'});
    await page.locator('.cx-avatar.petit').click();
    await page.getByRole('menuitem',{name:'Affichage et accessibilité'}).click();
    assert.ok(await themeRadio('Sombre').isChecked());
    await themeRadio('Système').check();
    const auto=await readTheme();
    assert.equal(auto.mode,null);
    assert.equal(auto.bg,theme==='light'?'#f4f5ef':'#151c29');
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('jsb-affichage')).theme),'system');
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
    // Recette d'appel peuplé : données fictives dans ce contexte navigateur isolé.
    if(engine==='webkit'){
      await page.evaluate(()=>{
        const d=new Date(), an=d.getMonth()>=8?d.getFullYear():d.getFullYear()-1;
        const judokas=Array.from({length:27},(_,i)=>({id:'qa-'+i,nom:'TEST '+String(i+1).padStart(2,'0'),prenom:'Licencié',licence:'QA-'+i,naissance:(an-4)+'-01-01'}));
        judokas.push({id:'qa-autre',nom:'AUTRE',prenom:'Test',licence:'QA-A',naissance:(an-5)+'-01-01'});
        const dates=[7,14].map(n=>new Date(d.getTime()-n*86400000).toISOString().slice(0,10));
        const seances=[{id:'qa-s1',date:dates[0],groupe:'Éveils 4 ans',statuts:{'qa-0':'P','qa-1':'P'}},{id:'qa-s2',date:dates[1],groupe:'Éveils 4 ans',statuts:{'qa-0':'A'}}];
        localStorage.setItem('jsb-presences',JSON.stringify({judokas,seances,planning:[],sauvegardeLe:Date.now()}));
      });
      await page.goto(base,{waitUntil:'domcontentloaded'});
      await nav.getByRole('button',{name:'Présences',exact:true}).click();
      await page.locator('.pr-appel-ligne').first().waitFor({timeout:45000});
      // Measure the painted layout after the new document's CSS and navigation commit.
      await page.waitForFunction(()=>Array.from(document.styleSheets).some(s=>s.href&&new URL(s.href).pathname.endsWith('/ui/interface.css')&&new URL(s.href).searchParams.has('v')));
      await page.evaluate(()=>document.fonts.ready);
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      assert.ok(await nav.evaluate(el=>el.classList.contains('onglets-presences')),'Classe de navigation Présences absente');
      assert.equal(await page.locator('.pr-appel-ligne').count(),27);
      const geometry=()=>page.evaluate(()=>{
        const rect=s=>{const n=document.querySelector(s),r=n.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height};};
        const sc=document.querySelector('.pr-scroll'), list=document.querySelector('.pr-appel-defile');
        return {bar:rect('.appbar'),tabs:rect('.pr-barre'),scroll:rect('.pr-scroll'),footer:rect('.pr > .pr-valider'),nav:rect('.onglets'),navClass:document.querySelector('.onglets').className,navBottom:getComputedStyle(document.querySelector('.onglets')).bottom,scrollMode:getComputedStyle(sc).overflowY,listMode:getComputedStyle(list).overflowY,scrollTop:sc.scrollTop,scrollHeight:sc.scrollHeight,clientHeight:sc.clientHeight};
      });
      const before=await geometry();
      assert.equal(before.scrollMode,'auto');
      assert.equal(before.listMode,'visible');
      assert.ok(before.bar.bottom<=before.tabs.top+1&&before.tabs.bottom<=before.scroll.top+1&&before.scroll.bottom<=before.footer.top+1&&before.footer.bottom<=before.nav.top+1,JSON.stringify(before));
      assert.ok(before.scrollHeight>before.clientHeight,JSON.stringify(before));
      await page.locator('.pr-scroll').evaluate(el=>{el.scrollTop=el.scrollHeight;});
      const after=await geometry();
      assert.ok(after.scrollTop>0);
      assert.equal(after.footer.top,before.footer.top);
      assert.equal(after.tabs.top,before.tabs.top);
      await page.locator('.pr-scroll').evaluate(el=>{el.scrollTop=0;});
      await page.getByRole('button',{name:'Changer',exact:true}).click();
      const panel=await page.locator('#pr-reglage').evaluate(el=>{
        const r=el.getBoundingClientRect(),d=el.querySelector('input[type=date]').getBoundingClientRect();
        return {height:r.height,inside:d.left>=r.left&&d.right<=r.right};
      });
      assert.ok(panel.height<300&&panel.inside,JSON.stringify(panel));
      await snapshot('10-presences-reglages');
      await page.getByRole('button',{name:'Fermer',exact:true}).click();
      await snapshot('11-presences-appel');
      // File operations and season help belong to Licenciés, not Appel.
      const files=page.locator('.pr-fichiers');
      const season=page.locator('.pr-aide > summary').filter({hasText:'à propos du classement et de la sauvegarde'});
      assert.equal(await files.count(),0);
      assert.equal(await season.count(),0);
      await page.getByRole('tab',{name:'Licenciés',exact:true}).click();
      await files.waitFor({state:'visible'});
      assert.equal(await files.count(),1);
      assert.equal(await season.count(),1);
      const rows=page.locator('.pr-lic-fiche');
      const searchLic=page.getByRole('searchbox',{name:'Rechercher un licencié',exact:true});
      await searchLic.waitFor({state:'visible'});
      assert.equal(await rows.count(),28);
      assert.equal(await page.locator('.pr-lic-fiche[open]').count(),0);
      await searchLic.fill('QA-0');
      assert.equal(await rows.count(),1);
      await rows.first().locator('summary').click();
      assert.equal(await page.locator('.pr-lic-fiche[open]').count(),1);
      assert.ok(await rows.first().getByRole('button',{name:/Suivi de/}).isVisible());
      await rows.first().locator('summary').click();
      await searchLic.fill('');
      const filterLic=page.getByLabel('Filtrer par cours');
      await filterLic.selectOption('Éveils 5 ans');
      assert.equal(await rows.count(),1);
      await filterLic.selectOption('');
      assert.equal(await rows.count(),28);
      assert.equal(await page.locator('.pr-lic-danger > button').isVisible(),false);
      await snapshot('13-licencies-mobile');
      for(const label of ['Bilan','Planning','Appel']){
        await page.getByRole('tab',{name:label,exact:true}).click();
        assert.equal(await files.count(),0,label);
        assert.equal(await season.count(),0,label);
        if(label==='Planning'){
          await page.getByRole('button',{name:'+ Ajouter un créneau',exact:true}).click();
          const editor=page.getByRole('region',{name:'Nouveau créneau',exact:true});
          await editor.waitFor({state:'visible'});
          await editor.getByLabel('Jour',{exact:true}).selectOption('1');
          await editor.getByLabel('Début',{exact:true}).fill('16:30');
          await editor.getByLabel('Fin',{exact:true}).fill('16:00');
          assert.equal(await editor.getByRole('button',{name:'Enregistrer le créneau'}).isEnabled(),false);
          await editor.getByLabel('Fin',{exact:true}).fill('17:30');
          await editor.getByRole('button',{name:'Enregistrer le créneau'}).click();
          const slot=page.locator('.pr-cren-fiche');
          await slot.waitFor({state:'visible'});
          assert.equal(await slot.count(),1);
          assert.equal(await slot.getAttribute('open'),null);
          await page.getByRole('group',{name:'Prochain cours',exact:true}).waitFor();
          await slot.locator('summary').click();
          await slot.getByRole('button',{name:/Modifier le créneau/}).click();
          const edit=page.getByRole('region',{name:'Modifier le créneau',exact:true});
          await edit.waitFor({state:'visible'});
          assert.equal(await edit.getByLabel('Début',{exact:true}).inputValue(),'16:30');
          await edit.getByLabel('Début',{exact:true}).fill('16:45');
          await edit.getByRole('button',{name:'Enregistrer le créneau'}).click();
          assert.match(await slot.locator('summary').textContent(),/16\s*h\s*45|16:45/);
          await snapshot('14-planning-mobile');
          if(await slot.getAttribute('open')===null)await slot.locator('summary').click();
          await slot.getByRole('button',{name:/Supprimer le créneau/}).click();
          const confirmation=page.getByRole('alertdialog',{name:'Confirmation'});
          await confirmation.getByRole('button',{name:'Annuler',exact:true}).click();
          assert.equal(await slot.count(),1);
          await slot.getByRole('button',{name:/Supprimer le créneau/}).click();
          await confirmation.getByRole('button',{name:'Confirmer',exact:true}).click();
          assert.equal(await slot.count(),0);
        }
        if(label==='Bilan'){
          const summary=page.getByRole('group',{name:'Synthèse du cours'});
          await summary.waitFor({state:'visible'});
          assert.deepEqual(await summary.locator('strong').allTextContents(),['2','27','67 %']);
          const cards=page.locator('.pr-bilan-carte');
          assert.equal(await cards.count(),27);
          assert.ok(await cards.first().isVisible());
          assert.equal(await page.locator('.pr-bilan .pr-tableau').isVisible(),false);
          assert.equal(await cards.first().locator('.pr-bilan-taux').textContent(),'50 %');
          assert.ok(await page.getByRole('button',{name:'Exporter le mois',exact:true}).count());
          const bounds=await cards.first().evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,width:innerWidth};});
          assert.ok(bounds.left>=0&&bounds.right<=bounds.width+1,JSON.stringify(bounds));
          await snapshot('12-bilan-mobile');
        }
      }
      console.log('PASS appel mobile peuplé',theme,JSON.stringify({before,after,panel}));
    }
    // Exercise sheet: safety, dosage, execution and administrative tools.
    await nav.getByRole('button',{name:'Taïso',exact:true}).click();
    const sheetCard=page.locator('.carte').first();
    await sheetCard.waitFor({state:'visible'});
    await sheetCard.click();
    const sheet=page.locator('.fiche-v19');
    await sheet.waitFor({state:'visible'});
    const essentials=sheet.locator('.fiche-essentiel');
    assert.ok(await essentials.isVisible());
    // Check actual first-viewport geometry, not only DOM visibility.
    await sheet.locator('h2').waitFor({state:'visible'});
    const geometry=await sheet.evaluate(el=>{const r=el.getBoundingClientRect();const title=el.querySelector('h2');const block=el.querySelector('.fiche-essentiel');const safety=block.querySelector('.securite');const dose=[...block.querySelectorAll('dt')].find(n=>n.textContent==='Dosage de base');const d=dose?.parentElement.getBoundingClientRect();return {height:r.height,top:r.top,bottom:r.bottom,titleBottom:title.getBoundingClientRect().bottom,blockTop:block.getBoundingClientRect().top,safetyBottom:safety?.getBoundingClientRect().bottom,doseBottom:d?.bottom,scrollTop:el.scrollTop};});
    assert.ok(geometry.blockTop-geometry.titleBottom<=24,JSON.stringify(geometry));
    assert.ok(geometry.doseBottom<=geometry.bottom+1,JSON.stringify(geometry));
    if(geometry.safetyBottom!=null)assert.ok(geometry.safetyBottom<=geometry.bottom+1,JSON.stringify(geometry));
    assert.equal(await sheet.getByText('Dosage de base',{exact:true}).count(),1);
    assert.ok(await essentials.evaluate(el=>Boolean(el.compareDocumentPosition(el.parentElement.querySelector('.fiche-rubrique'))&Node.DOCUMENT_POSITION_FOLLOWING)));
    const admin=sheet.locator('.fiche-admin');
    assert.equal(await admin.getAttribute('open'),null);
    await admin.locator(':scope > summary').click();
    await admin.getByText('Modifier le classement',{exact:true}).waitFor({state:'visible'});
    await admin.getByText('Médias et export',{exact:true}).click();
    await admin.getByText('Ajouter une vidéo',{exact:true}).waitFor({state:'visible'});
    await snapshot('17-fiche-exercice');
    await sheet.getByRole('button',{name:'Fermer la fiche',exact:true}).click();
    await sheet.waitFor({state:'hidden'});
    // Administrator reset is deliberately scoped to the exercise library.
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await nav.waitFor({timeout:45000});
    const readWorkspace=()=>page.evaluate(()=>new Promise((resolve,reject)=>{
      const request=indexedDB.open('jsb-manager');
      request.onerror=()=>reject(request.error);
      request.onsuccess=()=>{const db=request.result, tx=db.transaction('donnees','readonly'), store=tx.objectStore('donnees');
        const keys=['jsb-presences','jsb-exercices','jsb-ajouts','jsb-videos','jsb-catalogue-en-ligne-desactive'];
        const result={}; keys.forEach(k=>{const q=store.get(k);q.onsuccess=()=>{result[k]=q.result??null;};});
        tx.oncomplete=()=>{db.close();resolve(result);};tx.onerror=()=>{db.close();reject(tx.error);};
      };
    }));
    // Seed separate and shared fiches; verify each selective reset after reload.
    await page.evaluate(()=>new Promise((resolve,reject)=>{
      const req=indexedDB.open('jsb-manager');
      req.onerror=()=>reject(req.error);
      req.onsuccess=()=>{const db=req.result,tx=db.transaction('donnees','readwrite'),st=tx.objectStore('donnees');
        st.put([{id:80001,nom:'QA Judo',public:['Judo']},{id:80002,nom:'QA Taïso',public:['Taïso']},{id:80003,nom:'QA Commun',public:['Judo','Taïso']}],'jsb-exercices');
        st.put([{id:80004,nom:'QA Ajout Judo',public:['Judo'],ajoute:true},{id:80005,nom:'QA Ajout Taïso',public:['Taïso'],ajoute:true}],'jsb-ajouts');
        st.put({80001:{taille:1},80002:{taille:1},80003:{taille:1}},'jsb-videos');
        tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};
      };
    }));
    await page.reload({waitUntil:'domcontentloaded'});
    await nav.waitFor({timeout:45000});
    const original=await readWorkspace();
    const openReset=async name=>{
      await page.locator('.cx-avatar.petit').click();
      await page.getByRole('menuitem',{name:'Ajouter des exercices',exact:true}).click();
      const button=page.getByRole('button',{name,exact:true});
      page.once('dialog',d=>d.accept());
      await Promise.all([page.waitForEvent('load'),button.click()]);
      await nav.waitFor({timeout:45000});
    };
    await openReset('Vider le Judo');
    const sansJudo=await readWorkspace();
    assert.deepEqual(sansJudo['jsb-exercices'].map(e=>[e.id,e.public]),[[80002,['Taïso']],[80003,['Taïso']]]);
    assert.deepEqual(sansJudo['jsb-ajouts'].map(e=>e.id),[80005]);
    assert.deepEqual(Object.keys(sansJudo['jsb-videos']),['80002','80003']);
    assert.deepEqual(sansJudo['jsb-catalogue-en-ligne-desactive'],['Judo']);
    assert.deepEqual(sansJudo['jsb-presences'],original['jsb-presences']);
    await openReset('Vider le Taïso');
    const sansTaiso=await readWorkspace();
    assert.deepEqual(sansTaiso['jsb-exercices'],[]);
    assert.deepEqual(sansTaiso['jsb-ajouts'],[]);
    assert.deepEqual(sansTaiso['jsb-videos'],{});
    assert.deepEqual(sansTaiso['jsb-catalogue-en-ligne-desactive'],['Judo','Taïso']);
    assert.deepEqual(sansTaiso['jsb-presences'],original['jsb-presences']);
    const workspace=await readWorkspace();
    await page.locator('.cx-avatar.petit').click();
    await page.getByRole('menuitem',{name:'Ajouter des exercices',exact:true}).click();
    const reset=page.getByRole('button',{name:'Vider le catalogue d’exercices',exact:true});
    page.once('dialog',d=>d.dismiss());
    await reset.click();
    assert.deepEqual(await readWorkspace(),workspace);
    page.once('dialog',d=>d.accept());
    await Promise.all([page.waitForEvent('load'),reset.click()]);
    await nav.waitFor({timeout:45000});
    const emptied=await readWorkspace();
    assert.deepEqual(emptied['jsb-exercices'],[]);
    assert.deepEqual(emptied['jsb-ajouts'],[]);
    assert.deepEqual(emptied['jsb-videos'],{});
    assert.equal(emptied['jsb-catalogue-en-ligne-desactive'],true);
    assert.deepEqual(emptied['jsb-presences'],workspace['jsb-presences']);
    await page.locator('.version').filter({hasText:'0 fiches'}).waitFor();
    await page.reload({waitUntil:'domcontentloaded'});
    await page.locator('.version').filter({hasText:'0 fiches'}).waitFor();
    await snapshot('16-catalogue-vide');
    assert.deepEqual(errors,[],'Exceptions JavaScript');
    console.log('PASS',engine,theme,JSON.stringify(metrics));
   } finally{await context.close();}
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
