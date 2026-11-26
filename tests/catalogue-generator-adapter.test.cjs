'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {CONTRACTS,CONTRACT_VERSION}=require('../core/catalogue-workbook-contract.cjs');
const {adaptExercise,selectTaisoCandidates}=require('../core/catalogue-generator-adapter.cjs');
const {createGeneratorSource}=require('../backend/catalogue-generator-source.cjs');
function fixture(discipline,overrides={}){
 const row=Object.fromEntries(CONTRACTS[discipline].map(([,key])=>[key,'Fixture '+key]));
 Object.assign(row,{reference:discipline==='taiso'?'JSB-TAISO-FIXTURE-1':'JSB-JUDO-FIXTURE-1',discipline:discipline==='taiso'?'Taïso':'Judo',sheetType:'Exercice',dosageMode:'Répétitions',repetitions:'8',effortSeconds:null,tagsText:null,restrictions:null,equipment:'Poids du corps',format:'Solo',dosage:'2 × 8 répétitions, récupération 30 s'});
 if(discipline==='taiso')Object.assign(row,{level:'Intermédiaire',subgroup:'Gym douce, Training'});
 else Object.assign(row,{ageCategory:'Éveils; Pré-poussins',grade:'Blanche',pedagogicalRole:'Découverte',opposition:'Coopération',blockDuration:'10',repetitionsMax:null});
 Object.assign(row,overrides);
 const {reference,name,family,discipline:ignored,...d}=row;
 return {reference,name,family,details:{contractVersion:CONTRACT_VERSION,...Object.fromEntries(Object.entries(d).filter(([,v])=>v!==null))}};
}
const criteria={groupe:'Training',niveau:'Intermédiaire',mode:'Répétitions',supervision:false,binome:false,sansMateriel:true,materiel:[],contraintes:[]};
test('Adaptation : identité pérenne, données exactes, discipline et dosage conservés',()=>{
 const t=fixture('taiso'),mapped=adaptExercise('taiso',t);
 assert.equal(mapped.ok,true);
 assert.equal(mapped.exercise.id,t.reference);
 assert.equal(mapped.exercise.dosage,t.details.dosage);
 assert.equal(mapped.exercise.repetitions,8);
 assert.equal(Object.hasOwn(mapped.exercise,'duree_s'),false);
 assert.deepEqual(mapped.exercise.sousGroupes,['Gym douce','Training']);
 assert.deepEqual(mapped.canonical,t);
 const j=adaptExercise('judo',fixture('judo'));
 assert.equal(j.ok,true);
 assert.deepEqual(j.exercise.sousGroupes,['Éveils (4-5 ans)','Pré-poussins']);
 assert.equal(j.exercise.dureeBlocMin,10);
 assert.equal(j.requiresTechniqueMapping,true);
 assert.equal(Object.hasOwn(j.exercise,'technique'),false);
 assert.equal(adaptExercise('taiso',fixture('judo')).ok,false);
 assert.equal(adaptExercise('taiso',fixture('taiso',{restrictions:'Encadrement requis'})).ok,false);
});
test('Sélection Taïso : réutilisation des filtres historiques, aucun élargissement silencieux',()=>{
 const entries=[fixture('taiso'),fixture('taiso',{reference:'JSB-TAISO-MAT',equipment:'Kettlebell'}),fixture('taiso',{reference:'JSB-TAISO-EXPERT',level:'Expert'}),fixture('taiso',{reference:'JSB-TAISO-BINOME',format:'Binôme'}),fixture('taiso',{reference:'JSB-TAISO-RESTRICT',restrictions:'Condition à vérifier'}),fixture('taiso',{reference:'JSB-TAISO-SUP',safety:'Supervision obligatoire'}),fixture('taiso',{reference:'JSB-TAISO-TEMPS',dosageMode:'Durée',effortSeconds:'30',repetitions:null})];
 const result=selectTaisoCandidates(entries,criteria);
 assert.deepEqual(result.candidates.map(x=>x.exercise.reference),['JSB-TAISO-FIXTURE-1']);
 assert.equal(result.excluded.length,6);
 assert.equal(selectTaisoCandidates(entries,{...criteria,sansMateriel:false}),null);
 assert.equal(selectTaisoCandidates(entries,{...criteria,contraintes:['inconnue']}),null);
 assert.equal(selectTaisoCandidates(entries,{...criteria,groupe:'Gym douce'}).candidates.length,0);
});
test('Source versionnée : contrôle de rôle, snapshot actif et absence de données privées',async()=>{
 const item=fixture('taiso'),queries=[];
 const source=createGeneratorSource({query:async(sql,params)=>{queries.push({sql,params});return {rows:params[1]==='v1'&&params[2]==='2'?[{version:'v1',generation:'2',count:1,items:[item]}]:[]};}});
 const coach={id:'fixture-coach',role:'coach',status:'active',authenticated:true};
 const admin={...coach,role:'admin'};
 const options={version:'v1',generation:'2'};
 assert.equal((await source.load(admin,'taiso',options)).status,403);
 assert.equal((await source.load(coach,'taiso',options,'admin-test')).status,403);
 assert.equal(queries.length,0);
 assert.equal((await source.load(admin,'taiso',options,'admin-test')).status,200);
 assert.equal((await source.load(coach,'taiso',{...options,generation:'1'})).status,409);
 const result=await source.taisoCandidates(coach,options,criteria);
 assert.equal(result.status,200);assert.equal(result.candidates.length,1);
 assert.ok(queries.every(q=>q.sql.includes('jsb_catalogue.publications')&&!q.sql.includes('jsb_auth')));
});
