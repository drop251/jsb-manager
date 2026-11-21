'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function fn(name){
 const start=html.indexOf('  function '+name+'(');assert.ok(start>=0,name);
 const firstEnd=html.indexOf('\n',start), first=html.slice(start,firstEnd);
 if (/\}\s*$/.test(first)) return first;
 return html.slice(start,html.indexOf('\n  }',start)+4);
}
function init(){
 const c={};vm.createContext(c);
 for(const n of ['court','uniq','sansAccent','familleCatalogue','sousFamilleCatalogue','famillesCatalogue','texteCatalogue','lireBaseFichier'])vm.runInContext(fn(n),c);
 return c;
}
test('Le classement conserve les familles explicites sans modifier les fiches ni les IDs',()=>{
 const c=init(),e={id:42,public:['Judo'],famillePrincipale:'Travail au sol',famille:'Ancienne famille',sousFamille:'Immobilisations',technique:'Te-waza'};
 const original=JSON.stringify(e);
 assert.equal(c.familleCatalogue(e,'Judo'),'Travail au sol');
 assert.equal(c.sousFamilleCatalogue(e),'Immobilisations');
 assert.equal(JSON.stringify(e),original);
 assert.equal(c.familleCatalogue({technique:'Ashi-waza'},'Judo'),'Travail debout');
 assert.equal(c.familleCatalogue({technique:'Ne-waza (Osaekomi-waza)'},'Judo'),'Travail au sol');
 assert.equal(c.familleCatalogue({categorie:'Cardio'},'Judo'),'À classer');
 assert.equal(c.familleCatalogue({categorie:'Renforcement'},'Taïso'),'Renforcement');
});
test('La recherche couvre famille, sous-famille et tags avec accents normalisés',()=>{
 const c=init(),e={nom:'Situation 1',famille:'Équilibre',sousFamille:'Appui unipodal',tags:['Stabilité','Cheville']};
 const t=c.texteCatalogue(e,'Taïso');
 for(const mot of ['equilibre','unipodal','stabilite','cheville'])assert.ok(t.includes(mot));
 assert.deepEqual([...c.famillesCatalogue([e,e,{famille:'Mobilité'},{}],'Taïso')],['Équilibre','Mobilité','À classer']);
});
test('Import complet : doublons, discipline et types incohérents refusés sans altérer la source',async()=>{
 const c=init();const read=exercices=>c.lireBaseFichier({text:async()=>JSON.stringify({exercices})});
 const e={id:1,nom:'Ancienne fiche',public:['Judo']};
 assert.equal((await read([e]))[0].id,1); // les anciennes fiches restent lisibles
 await assert.rejects(read([e,{...e,id:'1'}]),/double/);
 await assert.rejects(read([{...e,public:[]}]),/discipline/);
 await assert.rejects(read([{...e,sousGroupes:'Poussins'}]),/liste/);
 await assert.rejects(read([{...e,nom:42}]),/nom/);
 await assert.rejects(read([{...e,famille:{nom:'Sol'}}]),/famille/);
});
function appFixture(espace='judo'){
 const c=init(),states=[],refs=[];let index=0,refIndex=0;
 c.useState=initial=>{const i=index++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],value=>states[i]=typeof value==='function'?value(states[i]):value];};
 c.React={Fragment:'fragment',useState:c.useState,useEffect(){},useMemo:f=>f(),useRef:value=>{const i=refIndex++;return refs[i]||(refs[i]={current:value});}};
 c.h=(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity).filter(x=>x!=null&&x!==false)});
 c.ReactDOM={createPortal:x=>x};
 c.window={innerWidth:390,scrollTo(){}};c.document={body:{}};c.location={pathname:'/'};c.history={replaceState(){}};
 c.espaceInitial=()=>espace;c.lireVueListe=()=> 'liste';c.ecrireVueListe=()=>{};
 c.useFavoris=()=>({has:()=>false,ids:[]});c.useHisto=()=>[];c.derniersUsages=()=>({});c.useSelection=()=>({ids:[]});c.illustre=()=>false;c.aVideo=()=>false;
 c.PROFIL=null;c.BASE_LOCALE=false;c.EXEMPLES=[];c.VERSION_APP='test';c.ICONES={};c.MATERIEL_JUDO=['Cerceaux'];c.ORDRE_NIV=['Débutant'];c.NIVEAUX=['Débutant'];c.MOMENTS=['Corps de séance'];
 c.BASE=[
 {id:1,nom:'Projection',public:['Judo'],sousGroupes:['Poussins'],technique:'Ashi-waza',famillePrincipale:'Travail debout',sousFamille:'Jambes',equipement:'Tatami'},
 {id:2,nom:'Contrôle',public:['Judo'],sousGroupes:['Poussins'],technique:'Ne-waza (Osaekomi-waza)',equipement:'Judogi'},
 {id:3,nom:'Jeu',public:['Judo'],sousGroupes:['Benjamins'],famille:'Jeux moteurs'},
 {id:4,nom:'Squat',public:['Taïso'],sousGroupes:['Training'],categorie:'Renforcement',niveau:'Débutant',equipement:'Kettlebell',accessibilite:'Tous publics',format:'Solo'},
 {id:5,nom:'Respiration',public:['Taïso'],sousGroupes:['Gym douce'],categorie:'Mobilité complémentaire',equipement:'Tatami',format:'Solo'}];
 for(const n of ['sg','nv','presents','momentsDe','teinte','niveauTexte'])vm.runInContext(fn(n),c);
 const espaces=html.slice(html.indexOf('  var ESPACES ='),html.indexOf('  var NIVEAUX ='));vm.runInContext(espaces,c);
 for(const n of ['VIDE','NAV']){const m=html.match(new RegExp('  var '+n+' = ([^\\n]+)'));vm.runInContext(m[0],c);}
 for(const name of ['Logo','MenuProfil','Icone','Chat','ImportBase','Aujourdhui','NbPresences','Garde','Presences','MesSeances','PanierSeance','Champ','Illustration','Grade','Plus','VerrouIllustres','Fiche','Generateur'])c[name]=name;
 vm.runInContext(fn('App'),c);
 const render=()=>{index=0;refIndex=0;return c.App();};
 return {c,render};
}
function nodes(n){return n&&typeof n==='object'?[n,...n.children.flatMap(nodes)]:[];}
function text(n){return n&&typeof n==='object'?n.children.map(text).join(''):String(n??'');}
function find(tree,predicate){const n=nodes(tree).find(predicate);assert.ok(n,'Élément absent');return n;}
function cards(tree){return nodes(tree).filter(n=>n.props.className==='carte').map(text);}
test('Parcours Judo : famille, sous-famille, recherche et changement de public restent cohérents',()=>{
 const {render}=appFixture();let tree=render();assert.equal(cards(tree).length,3);
 find(tree,n=>n.type==='button'&&text(n)==='Travail debout (1)').props.onClick();tree=render();assert.equal(cards(tree).length,1);
 find(tree,n=>n.props.id==='c-sous-famille').props.onChange('Jambes');tree=render();assert.equal(cards(tree).length,1);
 find(tree,n=>n.props.id==='recherche').props.onChange({target:{value:'jambes'}});tree=render();assert.equal(cards(tree).length,1);
 find(tree,n=>n.type==='button'&&text(n).startsWith('Poussins')).props.onClick();tree=render();
 assert.equal(find(tree,n=>n.type==='button'&&text(n)==='Toutes (2)').props['aria-pressed'],true);
});
test('Parcours Taïso : filtres de matériel accessibles et retrait rétablit le catalogue',()=>{
 const {render}=appFixture('taiso');let tree=render();assert.equal(cards(tree).length,2);
 find(tree,n=>n.props.className==='btn filtres-btn').props.onClick({currentTarget:{getBoundingClientRect:()=>({top:0,bottom:0,left:0,right:0,width:0,height:0})}});tree=render();
 assert.ok(nodes(tree).some(n=>n.props.id==='f-accessibilite'));
 find(tree,n=>n.type==='button'&&text(n)==='Kettlebell').props.onClick();tree=render();
 // Le tatami est toujours disponible : les deux fiches restent compatibles.
 assert.equal(cards(tree).length,2);
 find(tree,n=>n.type==='button'&&n.props['aria-label']==='Retirer le filtre Kettlebell').props.onClick();tree=render();assert.equal(cards(tree).length,2);
 find(tree,n=>n.props.id==='f-format').props.onChange('Binôme');tree=render();assert.equal(cards(tree).length,0);
 find(tree,n=>n.type==='button'&&text(n)==='Tout effacer').props.onClick();tree=render();assert.equal(cards(tree).length,2);
});
test('L’ajout conserve les colonnes de classement sans remplacer une technique déclarée',()=>{
 const c=init();c.cle=x=>String(x).toLowerCase().replace(/[^a-z]/g,'');c.sansAcc=c.sansAccent;
 vm.runInContext(html.slice(html.indexOf('  var CHAMPS ='),html.indexOf('  function normaliserLigne(')),c);
 vm.runInContext(fn('normaliserLigne'),c);
 Object.assign(c,{publicDe:()=> 'Taïso',categorieDe:()=> 'Renforcement',piloteDe:()=> 'Dynamique',formatDe:()=> 'Solo',equipementDe:()=> 'Tatami',momentDe:()=> 'Corps de séance',niveauDe:()=> 'Débutant',sousGroupeTaiso:()=> ['Training']});
 vm.runInContext(fn('classer'),c);
 const row={nom:'Squat',public:'Taïso','Famille principale':'Renforcement','Sous-famille':'Jambes',tags:['Force','Appuis']};
 const e=c.classer(row,'Taïso');
 assert.equal(e.famillePrincipale,'Renforcement');assert.equal(e.sousFamille,'Jambes');assert.deepEqual([...e.tags],['Force','Appuis']);
 assert.equal(c.familleCatalogue(e,'Taïso'),'Renforcement');
 const technique=c.classer({...row,typeFiche:'Technique',technique:'Squat'},'Taïso');
 assert.equal(technique.typeFiche,'Technique');assert.equal(technique.technique,'Squat');
});
test('Le catalogue sépare les types explicitement et conserve les anciennes fiches comme exercices',()=>{
 const f=appFixture();f.c.BASE.push({id:99,nom:'O-soto-gari',public:['Judo'],sousGroupes:['Poussins'],typeFiche:'Technique',technique:'Ashi-waza'});
 let t=f.render();assert.equal(cards(t).length,4);
 find(t,n=>n.type==='button'&&text(n)==='Fiches techniques').props.onClick();t=f.render();assert.equal(cards(t).length,1);assert.ok(cards(t)[0].includes('O-soto-gari'));
 find(t,n=>n.type==='button'&&text(n)==='Exercices').props.onClick();t=f.render();assert.equal(cards(t).length,3);
});
test('Les fiches techniques ne proposent pas d’ajout direct à la séance',()=>{
 const c=init();vm.runInContext(fn('Plus'),c);
 assert.equal(c.Plus({e:{typeFiche:'Technique'}}),null);
});
test('Un type inconnu dans une base complète est refusé sans convertir les anciennes fiches',async()=>{
 const c=init();const source=[{id:7,nom:'Ancien',public:['Judo']}];
 const result=await c.lireBaseFichier({text:async()=>JSON.stringify(source)});assert.equal(result[0].typeFiche,undefined);
 await assert.rejects(c.lireBaseFichier({text:async()=>JSON.stringify([{...source[0],typeFiche:'Séance'}])}),/typeFiche/);
});
