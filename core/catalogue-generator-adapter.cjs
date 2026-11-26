'use strict';
// Preserve the canonical fiche and map only known legacy generator fields.
// No exercise is inferred, and unresolved restrictions never enter automatic selection.
const {CONTRACT_VERSION,validateWorkbookRow}=require('./catalogue-workbook-contract.cjs');
const {validatePedagogicalDetails}=require('./catalogue-details.cjs');
const {creerSelection}=require('../modules/taiso.js');
const sansA=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const selection=creerSelection({sansA,NIVEAUX_TAISO:['Débutant','Intermédiaire','Confirmé','Expert']});
const noRestriction=v=>v===undefined||['aucun','aucune','neant','sans restriction'].includes(sansA(v).trim());
function adaptExercise(discipline,item){
 if(!['judo','taiso'].includes(discipline)||!item||typeof item!=='object')return {ok:false,code:'invalid-exercise'};
 const d=validatePedagogicalDetails(discipline,item.details);
 if(!d||d.contractVersion!==CONTRACT_VERSION||validateWorkbookRow(discipline,{...d,reference:item.reference,name:item.name,family:item.family,discipline:discipline==='taiso'?'Taïso':'Judo'}).length)return {ok:false,code:'invalid-contract'};
 if(!noRestriction(d.restrictions))return {ok:false,code:'restriction-review-required'};
 const base={id:item.reference,reference:item.reference,nom:item.name,description:d.executionDescription,
  typeFiche:d.sheetType,public:[discipline==='taiso'?'Taïso':'Judo'],famillePrincipale:item.family,
  sousFamille:d.subfamily,categorie:d.classification,niveau:d.level,equipement:d.equipment,
  vigilance:d.safety,critere:d.successCriteria,dosage:d.dosage,moment:d.moment,format:d.format,
  accessibilite:d.accessibility,inspiration:d.inspiration,varianteFacile:d.easier,varianteDifficile:d.harder,
  tags:d.tagsText??'',objectif:d.objective,modeDosage:d.dosageMode,
  ...(d.effortSeconds?{duree_s:Number(d.effortSeconds)}:{}),
  ...(d.repetitions?{repetitions:Number(d.repetitions)}:{})};
 if(discipline==='taiso'){
  const sousGroupes=d.subgroup==='Gym douce, Training'?['Gym douce','Training']:[d.subgroup];
  return {ok:true,exercise:{...base,sousGroupes,muscles:d.targetMuscles},canonical:item};
 }
 // The age labels are explicitly mapped to the existing Judo engine.
 // Technique and theme remain unresolved rather than being inferred from a title.
 return {ok:true,exercise:{...base,sousGroupes:d.ageCategory.split(';').map(s=>s.trim()==='Éveils'?'Éveils (4-5 ans)':s.trim()),
  grade:d.grade,competenceCiblee:d.competence,rolePedagogique:d.pedagogicalRole,prerequis:d.prerequisites,
  niveauOpposition:d.opposition,organisation:d.organization,dureeBlocMin:Number(d.blockDuration),
  modeDosageJudo:d.dosageMode,...(d.repetitionsMax?{repetitionsMax:Number(d.repetitionsMax)}:{})},
  canonical:item,requiresTechniqueMapping:true};
}
const constraints=['Genoux','Dos','Épaules','Poignets','Sauts','Passage au sol'];
function selectTaisoCandidates(items,criteria){
 if(!Array.isArray(items)||!criteria||!['Gym douce','Training'].includes(criteria.groupe)||
   !['Débutant','Intermédiaire','Expert'].includes(criteria.niveau)||
   !['Répétitions','Durée'].includes(criteria.mode)||
   typeof criteria.supervision!=='boolean'||typeof criteria.binome!=='boolean'||typeof criteria.sansMateriel!=='boolean'||
   !Array.isArray(criteria.materiel)||criteria.materiel.length>40||criteria.materiel.some(x=>typeof x!=='string'||!x.trim()||x.length>120)||
   (!criteria.sansMateriel&&!criteria.materiel.length)||
   !Array.isArray(criteria.contraintes)||criteria.contraintes.some(x=>!constraints.includes(x)))return null;
 const rep={...criteria,niveau:selection.niveauEffectifTaiso(criteria)};
 const candidates=[],excluded=[];
 for(const item of items){
  const mapped=adaptExercise('taiso',item);
  if(!mapped.ok){excluded.push({reference:item?.reference,code:mapped.code});continue;}
  const e=mapped.exercise;
  const compatibleMode=e.modeDosage===criteria.mode||e.modeDosage==='Durée et répétitions';
  if(!compatibleMode||!e.sousGroupes.includes(rep.groupe)||!selection.niveauOk(e,rep.niveau)||
    (rep.groupe==='Gym douce'&&(selection.estImpact(e)||e.accessibilite==='Publics entraînés uniquement'))||
    !selection.okTaiso(e,rep)){excluded.push({reference:e.reference,code:'incompatible-criteria'});continue;}
  candidates.push(mapped);
 }
 return {candidates,excluded};
}
module.exports=Object.freeze({adaptExercise,selectTaisoCandidates});
