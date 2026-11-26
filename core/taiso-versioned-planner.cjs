'use strict';
// Versioned first-generation path: reuse the existing phase engine and its
// filters. Preserve the catalogue prescription; never invent a time/reps
// conversion, a number of series or a recovery from free-form text.
const {creerMoteur,creerSelection}=require('../modules/taiso.js');
const {selectTaisoCandidates}=require('./catalogue-generator-adapter.cjs');
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
function construireBlocs(format,pool,minutes,doux,choisir,niveau){
 if(minutes<8)return [];
 if(format==='Mixte'){
  const first=Math.round(minutes*.6);
  return [...construireBlocs('Circuit',pool,first,doux,choisir,niveau),...construireBlocs('Pilates / yoga',pool,minutes-first,doux,choisir,niveau)];
 }
 const eligible=pool.filter(e=>compatibleFormat(e,format)&&rules.niveauOk(e,niveau));
 const count=Math.max(3,Math.round(minutes/5)),chosen=choisir(eligible,count,true);
 if(!chosen.length)return [];
 const allocations=repartirDurees(minutes,chosen.length);
 return [{nom:format,minutes,items:chosen.map((e,i)=>({e,duree:allocations[i]}))}];
}
const engine=creerMoteur({hasard,melanger,...rules,sg:e=>e.sousGroupes||[],estMobilite,illustre:()=>false,momentsDe,
 formatsDe:groupe=>FORMATS.filter(f=>groupe!=='Gym douce'||!['Tabata','AMRAP'].includes(f)),formatParDefaut:()=>FORMAT,construireBlocs,zonesTravaillees,cibleZones,
 MOTS_CALME:/respir|relax|savasana|calme|meteo|doudou|dort|boule|recuperation|jambes au mur/,sa,repartirDurees});
function planFromCandidates(selection,criteria,{minutes,seed,objective='',format=FORMAT}={}){
 if(!selection||!Array.isArray(selection.candidates)||!Array.isArray(selection.excluded)||
 ![45,60,75,90].includes(minutes)||!Number.isSafeInteger(seed)||seed<1||seed>2147483646||
 typeof objective!=='string'||objective.length>120||!formatsFor(criteria).includes(format))return null;
 const items=selection.candidates.map(x=>x.exercise),byReference=new Map(selection.candidates.map(x=>[x.exercise.id,x.canonical]));
 const routine=items.filter(estMobilite).slice(0,3).map(e=>e.id);
 const proposal=engine.genererSeanceTaiso({...criteria,duree:minutes,format,routine,objectif:objective},items,items,seed);
 const phases=proposal.phases.map(p=>{
  const exercises=p.exercices.map(x=>{
   const e=byReference.get(x.e.id);
   const prescription=criteria.mode==='Durée'?{mode:'Durée',effortSeconds:Number(e.details.effortSeconds)}:{mode:'Répétitions',repetitions:Number(e.details.repetitions)};
   return {reference:e.reference,name:e.name,family:e.family,allocationMinutes:x.duree,dosage:e.details.dosage,prescription,safety:e.details.safety};
  });
  return {name:p.nom,minutes:p.minutes,exercises,blocks:(p.blocs||[]).map(b=>({name:b.nom,minutes:b.minutes,references:b.items.map(x=>x.e.id)})),unallocatedMinutes:Math.max(0,p.minutes-exercises.reduce((n,x)=>n+x.allocationMinutes,0))};
 });
 const missing=[...proposal.manques];
 const body=phases.find(p=>p.name==='Corps de séance');
 if(body&&body.exercises.length<Math.max(3,Math.round(body.minutes/5))&&!missing.includes(body.name))missing.push(body.name);
 return {format,minutes,seed,mode:criteria.mode,phases,missing,candidateCount:items.length,excludedCount:selection.excluded.length,requiresCoachReview:true,organizationPending:format!==FORMAT};
}
function generateTaisoDraft(items,criteria,options){
 const selection=selectTaisoCandidates(items,criteria);
 return selection?planFromCandidates(selection,criteria,options):null;
}
module.exports=Object.freeze({generateTaisoDraft,planFromCandidates,formatsFor});
