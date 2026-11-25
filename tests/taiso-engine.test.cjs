'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
require('../ui/taiso-engine.js');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const start=html.indexOf('  function genererSeance('),end=html.indexOf('\n  }',start);
assert.ok(start>=0&&end>start);
const source=html.slice(start,end+4);
const exercise=(id,nom,moment,more={})=>({id,nom,description:'',categorie:'Renforcement',moment,groupes:['Training','Gym douce'],...more});
const ex=[exercise(1,'Mobilité','Mobilité'),exercise(2,'Marche','Échauffement'),exercise(3,'Rotation','Échauffement'),exercise(4,'Pas latéraux','Échauffement'),exercise(5,'Squat','Corps de séance'),exercise(6,'Gainage','Corps de séance',{categorie:'Gainage'}),exercise(7,'Pompes','Corps de séance'),exercise(8,'Respiration','Fin de séance'),exercise(9,'Étirement','Fin de séance'),exercise(10,'Étirement doux','Fin de séance'),exercise(11,'Saut','Corps de séance',{impact:true}),exercise(12,'Exercice exclu','Corps de séance',{exclu:true}),exercise(13,'Technique','Corps de séance',{typeFiche:'Technique'}),exercise(14,'Niveau avancé','Corps de séance',{avance:true})];
const deps={
 hasard:seed=>()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;},
 sg:e=>e.groupes,niveauOk:(e,n)=>!e.avance||n==='Avancé',niveauEffectifTaiso:r=>r.niveau||'Intermédiaire',estImpact:e=>!!e.impact,okTaiso:e=>!e.exclu,illustre:e=>!!e.image,
 melanger:(xs,r)=>xs.slice().map(e=>[r(),e]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]),momentsDe:e=>[e.moment],
 formatsDe:()=>['Circuit','Séries classiques'],formatParDefaut:()=> 'Circuit',
 construireBlocs:(format,pool,min,doux,choisir)=>[{nom:format,minutes:min,items:choisir(pool,3,true).map(e=>({e,duree:5}))}],
 zonesTravaillees:()=>({}),cibleZones:()=>0,estMobilite:e=>e.moment==='Mobilité',MOTS_CALME:/respiration/i,sa:x=>String(x||'').toLowerCase(),
 repartirDurees:(min,n)=>Array.from({length:n},(_,i)=>Math.floor(min/n)+(i<min%n?1:0))
};
const ctx=vm.createContext({...deps});
vm.runInContext(source,ctx);
const json=x=>JSON.parse(JSON.stringify(x));
for(const groupe of ['Training','Gym douce'])for(const duree of ['30 min','45 min','60 min','90 min'])test('Taïso indépendant : équivalence '+groupe+' '+duree,()=>{
 for(const calme of ['Les deux','Étirements','Respiration et relaxation'])for(const graine of [1,73]){
  const rep={groupe,duree,calme,routine:[1],objectif:'Renforcement',niveau:'Intermédiaire',format:'Circuit',eviter:{5:true}};
  const actual=globalThis.JSBTaisoEngine.generer(rep,ex,ex,graine,deps);
  const expected=ctx.genererSeance(rep,false,ex,ex,graine);
  assert.deepEqual(json(actual),json(expected));
  assert.equal(actual.phases.reduce((s,p)=>s+p.minutes,0),parseInt(duree,10));
  assert.ok(actual.phases.every(p=>p.nom!=='Randori'));
  assert.ok(actual.phases.flatMap(p=>p.exercices).every(x=>![12,13,14].includes(x.e.id)));
  if(groupe==='Gym douce')assert.ok(actual.phases.flatMap(p=>p.exercices).every(x=>x.e.id!==11));
 }
});
test('Catalogue vide : aucun exercice fictif ajouté',()=>{
 const r=globalThis.JSBTaisoEngine.generer({groupe:'Training',duree:'60 min',routine:[],calme:'Les deux'},[],[],1,deps);
 assert.ok(r.manques.length>0);assert.equal(r.phases.flatMap(p=>p.exercices).length,0);
});
test('Le parcours Taïso appelle le module indépendant et il est précaché',()=>{
 assert.match(html,/window\.JSBTaisoEngine\.generer\(/);
 const sw=fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8');
 assert.ok(sw.includes('./ui/taiso-engine.js'));
});
