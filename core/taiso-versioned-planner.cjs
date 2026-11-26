'use strict';
// Versioned first-generation path: reuse the existing phase engine and its
// filters. Preserve the catalogue prescription; never invent a time/reps
// conversion, a number of series or a recovery from free-form text.
const {creerMoteur,creerSelection}=require('../modules/taiso.js');
const {selectTaisoCandidates}=require('./catalogue-generator-adapter.cjs');
const {validateOrganization,requestedCount,blockOrganization}=require('./taiso-organization.cjs');
const sa=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const rules=creerSelection({sansA:sa,NIVEAUX_TAISO:['Débutant','Intermédiaire','Confirmé','Expert']});
function hasard(graine){let x=graine%2147483647;if(x<=0)x+=2147483646;return ()=>{x=x*16807%2147483647;return (x-1)/2147483646;};}
function melanger(t,r){t=t.slice();for(let i=t.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[t[i],t[j]]=[t[j],t[i]];}return t;}
function momentsDe(e){const m=sa(e.moment),r=[];if(m.includes('echauffement')||m.includes('mobilite articulaire'))r.push('Échauffement');if(m.includes('corps'))r.push('Corps de séance');if(m.includes('fin de seance')||m.includes('retour au calme'))r.push('Fin de séance');return r;}
function repartirDurees(minutes,n){if(!n)return [];const base=Math.floor(minutes/n),reste=minutes%n;return Array.from({length:n},(_,i)=>base+(i<reste?1:0));}
function zoneDe(e){
 const c=e.categorie||'',t=sa(e.muscles);
 if(/^Cardio|^Pliom/.test(c))return 'cardio';if(/^Gainage/.test(c))return 'tronc';
 const haut=/epaule|pector|dorsa|biceps|triceps|bras|deltoid|trapez|omoplat|scapul/.test(t),bas=/quadri|fessi|ischio|mollet|adduct|abduct|jambe|cuisse|cheville|hanche/.test(t);
 if(haut&&!bas)return 'haut';if(bas&&!haut)return 'bas';if(/abdo|sangle|lombaire|oblique|transverse|gainage|tronc/.test(t))return 'tronc';return 'global';
}
const MOTS_ZONE={bas:/ischio|quadri|mollet|fessi|psoas|hanche|jambe|cuisse|adduct|cheville|pigeon|papillon/,haut:/epaule|pector|dos|bras|triceps|biceps|nuque|trapez/,tronc:/colonne|torsion|dos|abdo|lombaire|cobra|chat|enfant/};
function zonesTravaillees(blocs){const z={};for(const b of blocs)for(const it of b.items){const k=zoneDe(it.e);z[k]=(z[k]||0)+1;}return z;}
function cibleZones(e,zones){const t=sa(e.nom+' '+e.muscles+' '+e.description);return Object.keys(zones).reduce((n,k)=>n+(MOTS_ZONE[k]?.test(t)?zones[k]:0),0);}
const FORMAT='Séries classiques';
const FORMATS=Object.freeze([FORMAT,'Circuit','EMOM','Tabata','AMRAP','Pilates / yoga','Mixte']);
const estMobilite=e=>/^Mobilit/.test(e.categorie||'')&&momentsDe(e).includes('Échauffement');
function formatsFor(criteria){
 return FORMATS.filter(f=>!(criteria.groupe==='Gym douce'&&['Tabata','AMRAP'].includes(f))&&
  !(criteria.mode==='Répétitions'&&f==='Tabata')&&!(criteria.mode==='Durée'&&['EMOM','AMRAP'].includes(f)));
}
function compatibleFormat(e,format){
 const dos=sa(e.dosage),c=e.categorie||'';
 const displacement=/aller-retour|aller retour|\d+\s*m\b|traversee|parcours/.test(dos),breathing=/respiration/.test(dos);
 const iso=/tenu|maintien|gainage|planche|chaise/.test(sa(e.nom))&&e.modeDosage!=='Répétitions';
 const unilateral=/par (cote|jambe|bras)|chaque cote|inverser/.test(dos);
 if(/^Mobilit/.test(c))return false;
 if(format===FORMAT)return !displacement&&!breathing;
 if(format==='Pilates / yoga')return !rules.estImpact(e)&&!/^Cardio/.test(c)&&!displacement&&(/^Gainage|^Équilibre/.test(c)||/pilates|yoga/i.test(e.inspiration||''));
 if(displacement||breathing)return false;
 if(format==='Tabata')return !iso&&!unilateral&&!/^Équilibre/.test(c)&&e.duree_s===20;
 if(format==='EMOM'||format==='AMRAP')return !iso&&!/^Équilibre/.test(c)&&Number.isSafeInteger(e.repetitions);
 if(format==='Circuit')return !/^Équilibre/.test(c)||!iso;
 return false;
}
function construireBlocs(format,pool,minutes,doux,choisir,niveau,settings){
 if(minutes<8)return [];
 if(format==='Mixte'){
  const first=Math.round(minutes*.6);
  return [...construireBlocs('Circuit',pool,first,doux,choisir,niveau,settings?.circuit),...construireBlocs('Pilates / yoga',pool,minutes-first,doux,choisir,niveau,settings?.pilates)];
 }
 const eligible=pool.filter(e=>compatibleFormat(e,format)&&rules.niveauOk(e,niveau));
 const count=Math.min(minutes,requestedCount(format,settings)??Math.max(3,Math.round(minutes/5))),chosen=choisir(eligible,count,true);
 if(!chosen.length)return [];
 const allocations=repartirDurees(minutes,chosen.length);
 return [{nom:format,minutes,items:chosen.map((e,i)=>({e,duree:allocations[i]}))}];
}
const createEngine=settings=>creerMoteur({hasard,melanger,...rules,sg:e=>e.sousGroupes||[],estMobilite,illustre:()=>false,momentsDe,
 formatsDe:groupe=>FORMATS.filter(f=>groupe!=='Gym douce'||!['Tabata','AMRAP'].includes(f)),formatParDefaut:()=>FORMAT,construireBlocs:(f,p,m,d,c,n)=>construireBlocs(f,p,m,d,c,n,settings),zonesTravaillees,cibleZones,
 MOTS_CALME:/respir|relax|savasana|calme|meteo|doudou|dort|boule|recuperation|jambes au mur/,sa,repartirDurees});
function planFromCandidates(selection,criteria,{minutes,seed,objective='',format=FORMAT,organization,edits=[]}={}){
 if(!selection||!Array.isArray(selection.candidates)||!Array.isArray(selection.excluded)||
 ![45,60,75,90].includes(minutes)||!Number.isSafeInteger(seed)||seed<1||seed>2147483646||
 typeof objective!=='string'||objective.length>120||!formatsFor(criteria).includes(format)||!Array.isArray(edits)||edits.length>60)return null;
 const settings=validateOrganization(format,criteria.mode,organization);
 if(settings===false)return null;
 const engine=createEngine(settings);
 const items=selection.candidates.map(x=>x.exercise),byReference=new Map(selection.candidates.map(x=>[x.exercise.id,x.canonical]));
 const routine=items.filter(estMobilite).slice(0,3).map(e=>e.id);
 const proposal=engine.genererSeanceTaiso({...criteria,duree:minutes,format,routine,objectif:objective},items,items,seed);
 const phases=proposal.phases.map(p=>{
  const exercises=p.exercices.map(x=>{
   const e=byReference.get(x.e.id);
   const prescription=criteria.mode==='Durée'?{mode:'Durée',effortSeconds:Number(e.details.effortSeconds)}:{mode:'Répétitions',repetitions:Number(e.details.repetitions)};
   return {reference:e.reference,name:e.name,family:e.family,allocationMinutes:x.duree,dosage:e.details.dosage,prescription,safety:e.details.safety};
  });
  return {name:p.nom,minutes:p.minutes,exercises,blocks:(p.blocs||[]).map(b=>{const references=b.items.map(x=>x.e.id);const blockSettings=format==='Mixte'?(b.nom==='Circuit'?settings?.circuit:settings?.pilates):settings;return {name:b.nom,minutes:b.minutes,references,organization:blockOrganization(b.nom,criteria.mode,blockSettings,exercises.filter(e=>references.includes(e.reference)),b.minutes)};}),unallocatedMinutes:Math.max(0,p.minutes-exercises.reduce((n,x)=>n+x.allocationMinutes,0))};
 });
 // Edits are replayed from the original seed on the server. They never
 // carry exercise text, prescriptions, or private data from the client.
 const removedPhases=new Set();
 const allUsed=()=>new Set(phases.flatMap(p=>p.exercises.map(e=>e.reference)));
 function replacementAllowed(e,block){
  return e&&momentsDe(e).includes('Corps de séance')&&compatibleFormat(e,block.name);
 }
 const itemMap=new Map(items.map(e=>[e.id,e]));
 for(const op of edits){
  if(!op||typeof op!=='object'||Array.isArray(op)||!['remove','up','down','replace'].includes(op.action)||
   Object.keys(op).some(k=>!['action','phase','reference','replacement'].includes(k))||
   typeof op.phase!=='string'||typeof op.reference!=='string'||
   (op.action==='replace'?typeof op.replacement!=='string':Object.hasOwn(op,'replacement')))return null;
  const phase=phases.find(p=>p.name===op.phase);
  if(!phase)return null;
  const i=phase.exercises.findIndex(e=>e.reference===op.reference);
  if(i<0)return null;
  const block=phase.blocks.find(b=>b.references.includes(op.reference));
  if(phase.name==='Corps de séance'&&!block)return null;
  if(op.action==='replace'){
   // Only the body blocks support replacement at this stage. No guessing
   // of a warm-up, mobility or recovery role from an arbitrary reference.
   if(!block||allUsed().has(op.replacement)||!replacementAllowed(itemMap.get(op.replacement),block))return null;
   const source=byReference.get(op.replacement),old=phase.exercises[i];
   const prescription=criteria.mode==='Durée'?{mode:'Durée',effortSeconds:Number(source.details.effortSeconds)}:{mode:'Répétitions',repetitions:Number(source.details.repetitions)};
   phase.exercises[i]={reference:source.reference,name:source.name,family:source.family,allocationMinutes:old.allocationMinutes,dosage:source.details.dosage,prescription,safety:source.details.safety};
   block.references[block.references.indexOf(op.reference)]=op.replacement;
  }else if(op.action==='remove'){
   phase.exercises.splice(i,1);
   if(block)block.references.splice(block.references.indexOf(op.reference),1);
   removedPhases.add(phase.name);
  }else{
   const j=i+(op.action==='up'?-1:1);
   if(j<0||j>=phase.exercises.length||(block&&!block.references.includes(phase.exercises[j].reference)))return null;
   const other=phase.exercises[j].reference;
   [phase.exercises[i],phase.exercises[j]]=[phase.exercises[j],phase.exercises[i]];
   if(block){const a=block.references.indexOf(op.reference),b=block.references.indexOf(other);[block.references[a],block.references[b]]=[block.references[b],block.references[a]];}
  }
 }
 for(const phase of phases){
  phase.unallocatedMinutes=phase.minutes-phase.exercises.reduce((n,e)=>n+e.allocationMinutes,0);
  for(const block of phase.blocks){
   const blockSettings=format==='Mixte'?(block.name==='Circuit'?settings?.circuit:settings?.pilates):settings;
   block.organization=blockOrganization(block.name,criteria.mode,blockSettings,phase.exercises.filter(e=>block.references.includes(e.reference)),block.minutes);
   // Choices are bounded, are not prescriptions, and are rechecked on use.
   block.alternatives=items.filter(e=>!allUsed().has(e.id)&&replacementAllowed(e,block)).slice(0,12).map(e=>({reference:e.id,name:e.nom}));
  }
 }
 const missing=[...proposal.manques];
 for(const name of removedPhases)if(!missing.includes(name))missing.push(name);
 const body=phases.find(p=>p.name==='Corps de séance');
 if(body&&(!body.blocks.length||(!settings&&body.exercises.length<Math.max(3,Math.round(body.minutes/5)))||body.blocks.some(b=>b.organization.state==='incomplete')||(format==='Mixte'&&body.blocks.length!==2))&&!missing.includes(body.name))missing.push(body.name);
 return {format,minutes,seed,mode:criteria.mode,phases,missing,candidateCount:items.length,excludedCount:selection.excluded.length,requiresCoachReview:true,editCount:edits.length,organizationPending:!settings||!body?.blocks.length||body.blocks.some(b=>b.organization.state!=='budgeted')||(format==='Mixte'&&body.blocks.length!==2)};
}
function generateTaisoDraft(items,criteria,options){
 const selection=selectTaisoCandidates(items,criteria);
 return selection?planFromCandidates(selection,criteria,options):null;
}
module.exports=Object.freeze({generateTaisoDraft,planFromCandidates,formatsFor});
