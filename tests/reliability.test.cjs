// Run: node --test tests/reliability.test.cjs (no dependencies).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
function fonction(nom, indent = 2) {
  const pad = ' '.repeat(indent);
  const start = html.indexOf(pad + 'function ' + nom + '(');
  assert.notEqual(start, -1, nom);
  const end = html.indexOf('\n' + pad + '}', start);
  return html.slice(start, end + pad.length + 3);
}
function environnement() {
  const local = new Map(), donnees = new Map();
  const ctx = {
    console, Blob, File, TextEncoder, TextDecoder, Uint8Array, ArrayBuffer, Date, Promise,
    crypto: require('node:crypto').webcrypto, btoa, atob,
    setTimeout: () => 1, clearTimeout() {},
    CLE_PRES: 'presences-test', CLE_SEL: 'selection-test', CLE_AJOUTS: 'ajouts-test', CLE_ILLUS_IA: 'illus-test', CLE_IMG_PERSO: 'images-test', CLE_VIDEOS: 'videos-test',
    ILLUS_IA: { 5010: '<svg/>' }, IMG_PERSO: { 5010: 'data:image/jpeg;base64,AA==' },
    VIDEOS: { 5010: { type: 'video/mp4', nom: 'demo.mp4' } },
    localStorage: { getItem: k => local.get(k) ?? null, setItem: (k, v) => local.set(k, String(v)), removeItem: k => local.delete(k) },
    Stockage: { lire: async k => donnees.get(k), ecrireLot: async entries => { entries.forEach(([k,v])=>donnees.set(k,v)); return true; }, ecrire: async (k,v) => {donnees.set(k,v);return true;} },
    cleFavoris: ()=>'favoris', cleHisto: ()=>'historique', cleRoutine: x=>'routine-'+x, cleVideo: id=>'video-'+id,
    lireFavoris: ()=>[5010], lireHisto: ()=>[], nouvelId: ()=>'nouveau',
    ITER_PBKDF2: 250000, MDP_SESSION: {}, navigator: { userAgent: 'iPhone', canShare: ()=>true },
    window: {}, telechargements: Promise.resolve(null), aujourdhui: ()=>'2026-11-01',
    URL: { createObjectURL: ()=>'blob:test', revokeObjectURL() {} },
    document: { createElement: ()=>({click(){},remove(){}}), body: {appendChild(){}} },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const name of ['valides','nettoyer','contenuSauvegarde','suffixeProfil','clesSauvegardeLocales','contenuSauvegardeComplete','validerEspace','restaurerEspaceComplet','versB64','depuisB64','cleChiffrement','chiffrer','dechiffrer','cleMdp','lireMdp','ecrireMdp','enregistrerFichier','partagerFichier','sauvegarderChiffre','lireSauvegarde']) vm.runInContext(fonction(name),ctx);
  donnees.set('jsb-exercices',[{id:1,nom:'Exercice importé',public:['Judo']}]);
  donnees.set('ajouts-test',[{id:5010,nom:'Personnel',public:['Taïso']}]);
  donnees.set('video-5010',{type:'video/mp4',buf:Uint8Array.from([0,255,1,2,200]).buffer});
  ctx.donnees = {judokas:[{id:'j1',nom:'Test',prenom:'Exemple'}],seances:[],planning:[]};
  return {ctx,local,donnees};
}
test('all executable scripts parse',()=>{
  for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if(!/type=["'](?:text\/plain|application\/json)/.test(m[1]))new vm.Script(m[2]);
  }
});
test('encrypted complete backup restores exercises, settings and exact video bytes',async()=>{
  const {ctx,local,donnees}=environnement(); local.set('selection-test','{"judo":[5010]}');
  const backup=await ctx.contenuSauvegardeComplete(ctx.donnees);
  const encrypted=await ctx.chiffrer(backup,'phrase-de-test-2026');
  await assert.rejects(ctx.dechiffrer(encrypted,'mauvais-mot-de-passe'));
  const restored=await ctx.dechiffrer(encrypted,'phrase-de-test-2026');
  donnees.clear(); local.clear(); await ctx.restaurerEspaceComplet(restored);
  assert.equal(donnees.get('jsb-exercices')[0].nom,'Exercice importé');
  assert.equal(donnees.get('ajouts-test')[0].nom,'Personnel');
  assert.equal(donnees.get('images-test')[5010],ctx.IMG_PERSO[5010]);
  assert.deepEqual([...new Uint8Array(donnees.get('video-5010').buf)],[0,255,1,2,200]);
  assert.equal(local.get('selection-test'),'{"judo":[5010]}');
  assert.equal(donnees.get('presences-test').judokas[0].id,'j1');
});
test('failed restore rolls local settings back',async()=>{
  const {ctx,local}=environnement(); const backup=await ctx.contenuSauvegardeComplete(ctx.donnees);
  local.set('selection-test','current-selection');ctx.Stockage.ecrireLot=async()=>{throw Error('quota');};
  await assert.rejects(ctx.restaurerEspaceComplet(backup)); assert.equal(local.get('selection-test'),'current-selection');
});
test('missing personal video aborts backup instead of silently omitting it',async()=>{
  const {ctx,donnees}=environnement();donnees.delete('video-5010'); await assert.rejects(ctx.contenuSauvegardeComplete(ctx.donnees));
});
test('legacy presence-only backups remain readable',async()=>{
  const {ctx}=environnement();const old=ctx.contenuSauvegarde(ctx.donnees);
  const restored=await ctx.lireSauvegarde({text:async()=>JSON.stringify(old)});assert.equal(restored.judokas[0].id,'j1');
});
test('password exists only in memory and old persisted value is removed',()=>{
  const {ctx,local}=environnement();local.set('jsb-mdp-presences-test','old');assert.equal(ctx.lireMdp(),'');
  ctx.ecrireMdp('secret');assert.equal(ctx.lireMdp(),'secret');assert.equal(local.has('jsb-mdp-presences-test'),false);
});
test('share cancellation and delayed share propagate to backup caller',async()=>{
  const {ctx}=environnement();let resolve;
  ctx.navigator.share=()=>new Promise(ok=>{resolve=ok;});let finished=false;
  const result=ctx.sauvegarderChiffre(ctx.donnees,'test-password',()=>{}).then(r=>{finished=true;return r;});
  while(!resolve) await new Promise(ok=>setImmediate(ok));assert.equal(finished,false);resolve();assert.equal((await result).statut,'partage');
  ctx.navigator.share=async()=>{throw {name:'AbortError'};};
  assert.equal((await ctx.sauvegarderChiffre(ctx.donnees,'test-password',()=>{})).statut,'annule');
});
test('desktop download returns pending verification; rejected managed download returns cancelled',async()=>{
  const {ctx}=environnement();ctx.navigator={userAgent:'Desktop'};
  assert.equal((await ctx.partagerFichier('backup.json',new Blob(['{}']),()=>{})).statut,'lance');
  ctx.telechargements=Promise.resolve({save:async()=>{throw {code:'declined'};}});
  assert.equal((await ctx.partagerFichier('backup.json',new Blob(['{}']),()=>{})).statut,'annule');
});
test('backup date only changes after successful export and user verification',async()=>{
  const {ctx,donnees}=environnement();ctx.setMsg=()=>{};ctx.setDonnees=()=>{};
  vm.runInContext(fonction('sauvegarderMaintenant',4),ctx);
  for (const status of ['annule','lance','partage']) {
    ctx.sauvegarderChiffre=async()=>({statut:status});ctx.confirm=()=>false;
    await ctx.sauvegarderMaintenant('password');assert.equal(donnees.has('presences-test'),false);
  }
  ctx.sauvegarderChiffre=async()=>({statut:'annule'});ctx.confirm=()=>{throw Error('must not ask after cancellation');};await ctx.sauvegarderMaintenant('password');
  ctx.sauvegarderChiffre=async()=>({statut:'partage'});ctx.confirm=()=>true;await ctx.sauvegarderMaintenant('password');assert.ok(donnees.get('presences-test').sauvegardeLe);
});
test('offline Safari video range responses and invalid ranges',async()=>{
  let listener;
  const response=new Response(Uint8Array.from([10,20,30,40,50]),{headers:{'Content-Type':'video/mp4'}});
  const ctx={URL,Request,Response,Headers,setTimeout,clearTimeout,Promise,
    self:{location:{origin:'https://example.test'},addEventListener:(n,fn)=>{if(n==='fetch')listener=fn;}},
    caches:{open:async()=>({match:async()=>response.clone()})},fetch:async()=>{throw Error('offline');}};
  vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../sw.js'),'utf8'),ctx);
  async function request(range){let result;listener({request:new Request('https://example.test/illustres/medias/9001.mp4',{headers:{Range:range}}),respondWith:p=>result=p});return result;}
  const r=await request('bytes=1-3');assert.equal(r.status,206);assert.equal(r.headers.get('Content-Range'),'bytes 1-3/5');assert.deepEqual([...new Uint8Array(await r.arrayBuffer())],[20,30,40]);
  const suffix=await request('bytes=-2');assert.deepEqual([...new Uint8Array(await suffix.arrayBuffer())],[40,50]);
  assert.equal((await request('bytes=50-60')).status,416);
});
test('offline preparation downloads all referenced public and reserved media and rejects missing media',async()=>{
  const {ctx}=environnement();vm.runInContext(fonction('preparerHorsLigne'),ctx);
  const saved=new Map();
  ctx.navigator.serviceWorker={controller:{}};ctx.location={href:'https://example.test/jsb-manager/'};ctx.URL=URL;ctx.AbortController=AbortController;
  ctx.EN_LIGNE={img:{1:'illustres/medias/1.jpg'},imgC:{2:{f:'medias-v/2.bin'}},vid:{1:'illustres/medias/1.mp4'},vidC:{2:{f:'medias-v/2v.bin'}}};
  ctx.VIDEOS={};ctx.IMG_PERSO={};ctx.caches={open:async()=>({match:async u=>saved.get(u),put:async(u,r)=>saved.set(u,r)}),match:async()=>new Response('shell')};
  ctx.fetch=async()=>new Response('media');const base=[{id:1},{id:2}];
  assert.match(await ctx.preparerHorsLigne(base,base,()=>{}),/disponible hors ligne/);
  for(const u of ['illustres/catalogue.json','illustres/medias/1.jpg','illustres/medias/1.mp4','illustres/medias-v/2.bin','illustres/medias-v/2v.bin'])assert.ok(saved.has(u),u);
  ctx.fetch=async()=>{throw Error('offline');};
  await ctx.preparerHorsLigne(base,base,()=>{}); // all cached, no network needed
  saved.delete('illustres/medias/1.mp4');await assert.rejects(ctx.preparerHorsLigne(base,base,()=>{}));
});
test('tampered full backups are rejected before storage changes',async()=>{
  const {ctx,local}=environnement();const backup=await ctx.contenuSauvegardeComplete(ctx.donnees);
  backup.espace.fichiersVideo[0].donnees='invalid base64 %';local.set('selection-test','current');
  assert.throws(()=>ctx.restaurerEspaceComplet(backup));assert.equal(local.get('selection-test'),'current');
});

test('complete backup includes generator preferences and saved Taiso models', async()=>{
  const {ctx,local}=environnement();
  const models=JSON.stringify([{id:'m1',nom:'Séance gym douce'}]);
  const suffix=ctx.suffixeProfil();
  local.set('jsb-modeles-taiso'+suffix,models);
  local.set('jsb-gen-taiso'+suffix,'{"groupe":"Gym douce","sansMateriel":true}');
  local.set('jsb-brouillon-taiso'+suffix,'{"plan":{"123":{"duree":"5"}},"infos":{}}');
  const backup=await ctx.contenuSauvegardeComplete(ctx.donnees);
  local.clear();
  await ctx.restaurerEspaceComplet(backup);
  assert.equal(local.get('jsb-modeles-taiso'+suffix),models);
  assert.equal(JSON.parse(local.get('jsb-gen-taiso'+suffix)).sansMateriel,true);
  assert.equal(JSON.parse(local.get('jsb-brouillon-taiso'+suffix)).plan[123].duree,'5');
});

test('older complete backups preserve newly-added local settings', async()=>{
  const {ctx,local}=environnement();
  const backup=await ctx.contenuSauvegardeComplete(ctx.donnees);
  [8,9,10,11,12,13].forEach(k=>delete backup.espace.locaux[k]);
  local.set('jsb-modeles-taiso'+ctx.suffixeProfil(),'{"local":true}');
  await ctx.restaurerEspaceComplet(backup);
  assert.equal(local.get('jsb-modeles-taiso'+ctx.suffixeProfil()),'{"local":true}');
});

test('Judo and Taiso generator phase totals match the requested duration',()=>{
  const ctx={
    hasard:()=>()=>0.5,melanger:a=>a,MATERIEL_JUDO:[],
    MOTS_RANDORI:/randori/i,MOTS_CALME:/calme/i,
    sa:x=>String(x||'').toLowerCase(),techniqueDe:x=>x,scoreObjectifJudo:()=>0,
    sg:e=>e.sousGroupes,momentsDe:e=>[e.moment],
    illustre:()=>false,evite:()=>false,estMobilite:()=>false,
    formatParDefaut:()=>'Circuit',niveauParDefaut:()=>'Débutant',formatsDe:()=>['Circuit'],
    niveauOk:()=>true,zoneDe:()=>'tronc',cibleZones:()=>0,
    construireBlocs:()=>[],zonesTravaillees:()=>({}),compatibleDosageJudo:()=>true
  };
  vm.createContext(ctx);
  vm.runInContext(fonction('okTaiso'),ctx);
  vm.runInContext(fonction('repartirDurees'),ctx);
  vm.runInContext(fonction('genererSeance'),ctx);
  const all=[{id:1,nom:'Routine',sousGroupes:['Poussins','Training'],equipement:'Poids du corps',moment:'Échauffement',categorie:'Mobilité'}];
  for(const duree of [45,60,75,90]){
    for(const judo of [true,false]){
      const rep={groupe:judo?'Poussins':'Training',duree:duree+' min',routine:[1],calme:'Les deux',materiel:[],binome:false};
      const result=ctx.genererSeance(rep,judo,all,all,1122);
      assert.equal(result.phases.reduce((n,p)=>n+p.minutes,0),duree,rep.groupe+' '+duree);
      assert.ok(result.phases.every(p=>p.minutes>0));
      result.phases.filter(p=>!p.blocs && p.exercices.length).forEach(p=>assert.equal(p.exercices.reduce((n,e)=>n+e.duree,0),p.minutes,p.nom));
    }
  }
});


test('Judo objectives are pedagogical and prioritize relevant exercises without changing Taiso',()=>{
  assert.match(html,/var objectifs = judo \? OBJECTIFS_JUDO :/);
  assert.match(html,/if \(judo && obj\) s \+= scoreObjectifJudo\(e, obj\)/);
  assert.match(html,/if \(!judo && obj && e\.categorie === obj\) s \+= 2\.5/);
  assert.match(html,/aucun exercice ciblé dans ce groupe/);
  const ctx={
    sa:x=>String(x||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  };
  vm.createContext(ctx);
  vm.runInContext(fonction('scoreObjectifJudo'),ctx);
  const correspondances=[
    ['Découverte et initiation','Jeu des chutes arrière'],
    ['Apprentissage technique','O-soto-gari : uchi-komi'],
    ['Perfectionnement technique','Nage-komi pour améliorer la précision'],
    ['Déplacements et déséquilibres','Tai-sabaki et Kuzushi'],
    ['Enchaînements et combinaisons','Ko-uchi-gari puis O-soto-gari'],
    ['Défense et contre-attaques','Tsubame-gaeshi'],
    ['Travail au sol — Ne-waza','Yoko-shiho-gatame'],
    ['Opposition et randori','Randori à thème']
  ];
  for(const [objectif,nom] of correspondances){
    assert.ok(ctx.scoreObjectifJudo({nom},objectif)>0,objectif+' : '+nom);
  }
  assert.equal(ctx.scoreObjectifJudo({nom:'Gainage planche'},'Travail au sol — Ne-waza'),0);
  assert.equal(ctx.scoreObjectifJudo({nom:'Squat'},'Défense et contre-attaques'),0);
});

test('Taiso material filter supports a truly equipment-free session',()=>{
  const ctx={evite:()=>false};vm.createContext(ctx);vm.runInContext(fonction('okTaiso'),ctx);
  const rep={sansMateriel:true,binome:false,contraintes:[]};
  assert.equal(ctx.okTaiso({equipement:'Tatami',format:'Solo'},rep),true);
  assert.equal(ctx.okTaiso({equipement:'Kettlebell',format:'Solo'},rep),false);
  assert.equal(ctx.okTaiso({equipement:'Poids du corps + Partenaire',format:'Binôme'},rep),false);
});

test('Taiso block builder never relaxes the configured level',()=>{
  const ctx={
    formatsDe:()=>['Circuit'],convient:()=>true,
    niveauOk:(e,n)=>e.niveau===n,estImpact:()=>false,zoneDe:()=> 'haut',
    materielDe:()=>[],intervalle:(e,eff,rec,tours)=>({e,duree:eff,tours})
  };
  vm.createContext(ctx);
  vm.runInContext(fonction('materielBlocs'),ctx);
  vm.runInContext(fonction('construireBlocs'),ctx);
  const exer=[{id:1,nom:'Accessible',niveau:'Débutant'},{id:2,nom:'Trop difficile',niveau:'Confirmé'}];
  const used=new Set();
  const choisir=(pool,n)=>pool.filter(e=>!used.has(e.id)).slice(0,n).map(e=>(used.add(e.id),e));
  const blocks=ctx.construireBlocs('Circuit',exer,12,true,choisir,'Débutant',{intensite:0});
  const all=blocks.flatMap(b=>b.items).map(x=>x.e);
  assert.ok(all.length>0);
  assert.ok(all.every(e=>e.niveau==='Débutant'));
});

test('individual exercise durations are distributed without cumulative rounding error',()=>{
  const ctx={};vm.createContext(ctx);vm.runInContext(fonction('repartirDurees'),ctx);
  assert.deepEqual([...ctx.repartirDurees(13,4)],[4,3,3,3]);
  assert.deepEqual([...ctx.repartirDurees(11,3)],[4,4,3]);
  assert.deepEqual([...ctx.repartirDurees(0,0)],[]);
  for(const minutes of [5,7,45,60,75,90]) for(let n=1;n<=minutes;n++){
    const values=[...ctx.repartirDurees(minutes,n)];
    assert.equal(values.length,n);
    assert.equal(values.reduce((a,b)=>a+b,0),minutes);
    assert.ok(values.every(v=>v>=1));
    assert.ok(Math.max(...values)-Math.min(...values)<=1);
  }
});
test('replacement requires an explicit selection and offers undo',()=>{
  const code=fonction('remplacer',4);
  assert.match(code,/setChoixRemplacement/);
  assert.doesNotMatch(code,/retoucher\(/);
  assert.match(html,/Choisir un exercice compatible/);
  assert.match(html,/Annuler la dernière retouche/);
  assert.match(html,/Adapter au groupe/);
  assert.match(html,/Mes modèles enregistrés/);
});

test('block material logic is independent from illustration symbols',()=>{
  assert.equal((html.match(/function materielBlocs\(/g)||[]).length,1);
  assert.equal((html.match(/function materielDe\(/g)||[]).length,1);
  assert.match(html,/b\.materiel = materielBlocs\(items\)/);
  const ctx={};vm.createContext(ctx);vm.runInContext(fonction('materielBlocs'),ctx);
  const items=[{e:{equipement:'Kettlebell + Tatami'}},{e:{equipement:'Elastique + Kettlebell + Partenaire'}}];
  assert.deepEqual([...ctx.materielBlocs(items)],['Kettlebell','Elastique']);
});

test('cancelling an editable session requires confirmation and clears only the draft',()=>{
  let confirmed=false,selected=['a'],infos={keep:true},plan={id:1},closed=false,clearedToken=false;
  const ctx={
    window:{confirm:()=>confirmed},
    sel:{set:ids=>{selected=ids;return true;}},
    p:{espace:'Judo',effacerGeneration:()=>{clearedToken=true;}},
    setInfos:v=>{infos=v;},setPlan:v=>{plan=v;},setMsg:()=>{},setDirect:()=>{},setOuvert:v=>{closed=!v;}
  };vm.createContext(ctx);vm.runInContext(fonction('abandonner',4),ctx);
  assert.equal(ctx.abandonner(),false);assert.deepEqual(selected,['a']);assert.equal(closed,false);
  confirmed=true;assert.equal(ctx.abandonner(),true);assert.deepEqual([...selected],[]);
  assert.equal(Object.keys(infos).length,0);assert.equal(Object.keys(plan).length,0);assert.ok(closed);assert.ok(clearedToken);
});

test('failed selection write must not erase draft during cancellation',()=>{
  let writes=0;
  const ctx={window:{confirm:()=>true},sel:{set:()=>false},
    p:{espace:'Taïso'},setInfos:()=>{writes++;},setPlan:()=>{writes++;},setMsg:()=>{},setDirect:()=>{},setOuvert:()=>{writes++;}};
  vm.createContext(ctx);vm.runInContext(fonction('abandonner',4),ctx);
  assert.equal(ctx.abandonner(),false);assert.equal(writes,0);
});

test('generator cancellation requires confirmation and errors remain in the generator',()=>{
  let confirmed=false,closed=0,result='untouched',error='';
  const ctx={
    window:{confirm:()=>confirmed},p:{espace:'Judo',fermer:()=>{closed++;}},rep:{duree:'60 min'},graine:1,
    eviter:{},judo:true,setRes:v=>{result=v;},setPrecedentRes:()=>{},setChoixRemplacement:()=>{},
    setErreurGeneration:v=>{error=v;},genererSeance:()=>{throw Error('catalogue incomplet');},
    console:{error:()=>{}}
  };vm.createContext(ctx);
  vm.runInContext(fonction('demanderAnnulation',4),ctx);
  vm.runInContext(fonction('generer',4),ctx);
  assert.equal(ctx.demanderAnnulation(),false);assert.equal(closed,0);assert.equal(result,'untouched');
  ctx.generer();assert.match(error,/Impossible de générer/);assert.equal(result,null);
  confirmed=true;assert.equal(ctx.demanderAnnulation(),true);assert.equal(closed,1);
});

test('cancelled proposals do not persist preferences, and pending transfer is consumed',()=>{
  const gen=fonction('generer',4), save=fonction('valider',4);
  assert.doesNotMatch(gen,/ecrireJSON\(cleReponses/);
  assert.match(save,/if \(!p\.valider\(ids, plan, infos\)\) return/);
  assert.match(html,/p\.effacerGeneration\(jeton\)/);
  assert.match(html,/Annuler la préparation/);
});
