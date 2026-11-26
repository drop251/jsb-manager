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

test('Formats Taïso : paramètres explicites, sélection des stations et budget exact',()=>{
 const {generateTaisoDraft,formatsFor}=require('../core/taiso-versioned-planner.cjs');
 const items=Array.from({length:16},(_,i)=>fixture('taiso',{
  reference:'JSB-TAISO-FORMAT-'+i,classification:i<8?'Renforcement':'Gainage',
  moment:'Corps de séance',dosageMode:'Durée et répétitions',effortSeconds:'20',repetitions:'8',
  dosage:'8 répétitions ou 20 s, récupération 45 s',inspiration:i<8?'Fixture':'Pilates',level:'Débutant'
 }));
 const original=JSON.stringify(items),options={minutes:60,seed:42},timed={...criteria,mode:'Durée'};
 const circuit={stations:4,rounds:3,recoverySeconds:20,repWindowSeconds:null,roundRestSeconds:60};
 const series={series:2,recoverySeconds:30,repWindowSeconds:null};
 const cases=[
  ['Circuit',timed,circuit,600],
  ['EMOM',criteria,{stations:3,rounds:4},720],
  ['Tabata',timed,{pairs:2},480],
  ['AMRAP',criteria,{stations:4,limitMinutes:10},600],
  ['Pilates / yoga',timed,series,null],
  ['Séries classiques',timed,series,null],
  ['Mixte',timed,{circuit,pilates:series},null]
 ];
 for(const [format,profile,organization,expected] of cases){
  const plan=generateTaisoDraft(items,profile,{...options,format,organization});
  assert.ok(plan,format);
  const body=plan.phases.find(p=>p.name==='Corps de séance');
  assert.equal(body.blocks.length,format==='Mixte'?2:1,format);
  assert.equal(plan.requiresCoachReview,true);
  assert.equal(plan.organizationPending,false,JSON.stringify(body.blocks));
  assert.equal(body.blocks[0].organization.state,'budgeted');
  if(expected!==null)assert.equal(body.blocks[0].organization.plannedSeconds,expected,format);
  assert.ok(body.blocks.every(b=>b.organization.remainingSeconds===b.minutes*60-b.organization.plannedSeconds));
  assert.equal(new Set(body.exercises.map(x=>x.reference)).size,body.exercises.length);
  assert.ok(body.exercises.every(e=>e.dosage==='8 répétitions ou 20 s, récupération 45 s'));
  assert.ok(body.exercises.every(e=>profile.mode==='Durée'?e.prescription.effortSeconds===20:e.prescription.repetitions===8));
 }
 assert.equal(JSON.stringify(items),original);
 assert.equal(generateTaisoDraft(items,criteria,{...options,format:'Tabata',organization:{pairs:1}}),null);
 assert.equal(generateTaisoDraft(items,timed,{...options,format:'EMOM',organization:{stations:3,rounds:4}}),null);
 assert.ok(!formatsFor({...timed,groupe:'Gym douce'}).includes('Tabata'));
 const tooLong=generateTaisoDraft(items,timed,{...options,format:'Circuit',organization:{...circuit,rounds:6,recoverySeconds:180}});
 assert.equal(tooLong.organizationPending,true);
 assert.ok(tooLong.phases[2].blocks[0].organization.issues.includes('budget-exceeded'));
 assert.ok(tooLong.missing.includes('Corps de séance'));
 const tooFew=generateTaisoDraft(items.slice(0,1),timed,{...options,format:'Circuit',organization:circuit});
 assert.equal(tooFew.organizationPending,true);
 assert.ok(tooFew.phases[2].blocks[0].organization.issues.includes('insufficient-stations'));
 assert.equal(generateTaisoDraft(items,timed,{...options,format:'Circuit',organization:{...circuit,stations:9}}),null);
 const pending=generateTaisoDraft(items,timed,{...options,format:'Circuit'});
 assert.equal(pending.organizationPending,true);
 assert.equal(pending.phases[2].blocks[0].organization.plannedSeconds,null);
});

test('Edition Taïso : rejeu déterministe, références autorisées et recalcul des budgets',()=>{
 const {generateTaisoDraft}=require('../core/taiso-versioned-planner.cjs');
 const items=Array.from({length:10},(_,i)=>fixture('taiso',{
  reference:'JSB-TAISO-EDIT-'+i,name:'Fixture '+i,classification:'Renforcement',
  moment:'Corps de séance',dosageMode:'Durée et répétitions',effortSeconds:'20',repetitions:'8',
  dosage:'8 répétitions ou 20 s, récupération 45 s'
 }));
 items.push(fixture('taiso',{reference:'JSB-TAISO-EDIT-BLOCKED',moment:'Corps de séance',restrictions:'Candidat à la recette'}));
 const options={minutes:60,seed:42,format:'Circuit',organization:{stations:4,rounds:3,recoverySeconds:20,repWindowSeconds:30,roundRestSeconds:60}};
 const original=JSON.stringify(items),base=generateTaisoDraft(items,criteria,options),body=base.phases[2],block=body.blocks[0];
 assert.equal(block.references.length,4);
 assert.ok(block.alternatives.length>0);
 const ref=block.references[0],alternative=block.alternatives[0].reference;
 const replace={action:'replace',phase:body.name,reference:ref,replacement:alternative};
 const next=generateTaisoDraft(items,criteria,{...options,edits:[replace]});
 assert.equal(next.editCount,1);
 assert.equal(next.phases[2].blocks[0].references[0],alternative);
 assert.equal(next.phases[2].exercises[0].prescription.repetitions,8);
 assert.equal(next.phases[2].exercises[0].dosage,items.find(e=>e.reference===alternative).details.dosage);
 const down={action:'down',phase:body.name,reference:alternative};
 const moved=generateTaisoDraft(items,criteria,{...options,edits:[replace,down]});
 assert.equal(moved.phases[2].blocks[0].references[1],alternative);
 assert.equal(moved.phases[2].exercises[1].reference,alternative);
 const remove={action:'remove',phase:body.name,reference:alternative};
 const edited=generateTaisoDraft(items,criteria,{...options,edits:[replace,down,remove]});
 assert.equal(edited.editCount,3);
 assert.equal(edited.phases[2].exercises.length,3);
 assert.ok(edited.phases[2].unallocatedMinutes>0);
 assert.equal(edited.organizationPending,true);
 assert.ok(edited.missing.includes(body.name));
 assert.ok(edited.phases[2].blocks[0].organization.issues.includes('insufficient-stations'));
 assert.deepEqual(generateTaisoDraft(items,criteria,{...options,edits:[replace,down,remove]}),edited);
 assert.equal(JSON.stringify(items),original);
 for(const invalid of [
  {...replace,replacement:'JSB-TAISO-EDIT-BLOCKED'},
  {...replace,replacement:block.references[1]},
  {...replace,replacement:'unknown'},
  {...replace,phase:'Mobilité'},
  {...replace,extra:'forged'},
  {action:'up',phase:body.name,reference:ref},
  {action:'remove',phase:body.name,reference:'unknown'}
 ])assert.equal(generateTaisoDraft(items,criteria,{...options,edits:[invalid]}),null,JSON.stringify(invalid));
});
