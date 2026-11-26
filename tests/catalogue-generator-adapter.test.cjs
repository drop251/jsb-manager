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

test('Taïso V1 : matériel Aucun reconnu sans modifier la fiche ni lever les restrictions',()=>{
 const item=fixture('taiso',{equipment:'Aucun'});
 const result=selectTaisoCandidates([item],criteria);
 assert.equal(result.candidates.length,1);
 assert.equal(result.candidates[0].exercise.equipement,'Poids du corps');
 assert.equal(result.candidates[0].canonical.details.equipment,'Aucun');
 const provisional=fixture('taiso',{equipment:'Aucun',restrictions:'Candidat à la recette ; essai terrain non renseigné.'});
 const blocked=selectTaisoCandidates([provisional],criteria);
 assert.equal(blocked.candidates.length,0);
 assert.equal(blocked.excluded[0].code,'restriction-review-required');
 assert.equal(selectTaisoCandidates([fixture('taiso',{equipment:'Aucun + Mur'})],criteria).candidates.length,0);
});

test('Proposition Taïso versionnée : budgets exacts, prescriptions sources et exclusion des fiches provisoires',()=>{
 const {generateTaisoDraft}=require('../core/taiso-versioned-planner.cjs');
 const items=[
  fixture('taiso',{reference:'JSB-TAISO-MOB',classification:'Mobilité articulaire (routine)',moment:'Échauffement',level:'Débutant'}),
  fixture('taiso',{reference:'JSB-TAISO-CHAUD',classification:'Cardio',moment:'Échauffement'}),
  ...Array.from({length:10},(_,i)=>fixture('taiso',{reference:'JSB-TAISO-CORPS-'+i,moment:'Corps de séance',dosageMode:'Durée et répétitions',effortSeconds:'30',repetitions:'8',dosage:'2 × 8 répétitions ou 30 s, récupération 45 s'})),
  fixture('taiso',{reference:'JSB-TAISO-RESTRICT',moment:'Corps de séance',restrictions:'Candidat à la recette'})
 ];
 const original=JSON.stringify(items),options={minutes:60,seed:42};
 const plan=generateTaisoDraft(items,criteria,options);
 assert.equal(plan.requiresCoachReview,true);
 assert.equal(plan.phases.length,5);
 assert.equal(plan.phases.reduce((n,p)=>n+p.minutes,0),60);
 assert.deepEqual(generateTaisoDraft(items,criteria,options),plan);
 assert.equal(JSON.stringify(items),original);
 const exercises=plan.phases.flatMap(p=>p.exercises);
 assert.ok(exercises.length>0);
 assert.equal(new Set(exercises.map(x=>x.reference)).size,exercises.length);
 assert.ok(exercises.every(e=>e.prescription.mode==='Répétitions'&&e.prescription.repetitions===8&&!Object.hasOwn(e.prescription,'effortSeconds')));
 assert.ok(exercises.every(e=>e.reference!=='JSB-TAISO-RESTRICT'));
 assert.ok(plan.phases.every(p=>p.exercises.reduce((n,e)=>n+e.allocationMinutes,0)+p.unallocatedMinutes===p.minutes));
 assert.ok(plan.missing.includes('Retour au calme'));assert.ok(plan.missing.includes('Étirements'));
 const timed=generateTaisoDraft(items,{...criteria,mode:'Durée'},options);
 const timedExercises=timed.phases.flatMap(p=>p.exercises);
 assert.ok(timedExercises.length>0);
 assert.ok(timedExercises.every(e=>e.prescription.effortSeconds===30&&!Object.hasOwn(e.prescription,'repetitions')&&e.dosage==='2 × 8 répétitions ou 30 s, récupération 45 s'));
 assert.equal(generateTaisoDraft(items,criteria,{...options,minutes:61}),null);
 assert.equal(generateTaisoDraft(items,criteria,{...options,seed:0}),null);
});
test('Proposition Taïso : référentiel vide ou entièrement exclu, aucune fiche artificielle',()=>{
 const {generateTaisoDraft}=require('../core/taiso-versioned-planner.cjs');
 for(const minutes of [45,60,75,90]){
  const draft=generateTaisoDraft([fixture('taiso',{restrictions:'Candidat à la recette'})],criteria,{minutes,seed:1});
  assert.equal(draft.candidateCount,0);assert.equal(draft.excludedCount,1);
  assert.ok(draft.phases.every(p=>p.exercises.length===0&&p.unallocatedMinutes===p.minutes));
  assert.equal(draft.phases.reduce((n,p)=>n+p.minutes,0),minutes);
  assert.ok(draft.missing.length>=5);
 }
});
