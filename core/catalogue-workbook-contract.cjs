'use strict';
// Versioned workbook contract. Exact column labels; no guesses from row number.
const COMMON=[
 ['Référence','reference'],['Nom (exercice)','name'],['Exécution','executionDescription'],
 ['Discipline','discipline'],['Type de fiche','sheetType'],['Point de sécurité','safety'],
 ['Dosage de base','dosage'],['Critère de réussite','successCriteria'],
 ['Famille principale','family'],['Sous-famille','subfamily'],['Niveau','level'],
 ['Sous-groupe','subgroup'],['Matériel','equipment']
];
const END=[
 ['Moment de la séance','moment'],['Variante plus facile','easier'],['Variante plus difficile','harder'],
 ['Accessibilité','accessibility'],['Inspiration','inspiration'],['Format','format'],
 ['Catégorie','classification'],['Tags','tagsText'],['Objectif','objective']
];
const CONTRACTS=Object.freeze({
 taiso:Object.freeze([...COMMON,['Muscles cibles','targetMuscles'],...END,
  ['Mode de dosage','dosageMode'],['Durée d’effort (s)','effortSeconds'],['Répétitions','repetitions'],['Restrictions d’utilisation','restrictions']]),
 judo:Object.freeze([...COMMON,...END,['Catégories d’âge','ageCategory'],['Grade','grade'],
  ['Compétence ciblée','competence'],['Rôle pédagogique','pedagogicalRole'],['Prérequis','prerequisites'],
  ['Niveau d’opposition','opposition'],['Organisation','organization'],['dureeBlocMin','blockDuration'],
  ['modeDosageJudo','dosageMode'],['Durée d’effort (s)','effortSeconds'],['Répétitions','repetitions'],
  ['repetitionsMax','repetitionsMax'],['Restrictions d’utilisation','restrictions']])
});
const AGE=Object.freeze(['Éveils','Pré-poussins','Poussins','Benjamins','Minimes','Cadets','Juniors','Adultes']);
const ROLES=Object.freeze(['Préparation','Découverte','Acquisition','Consolidation','Réinvestissement','Application','Opposition','Retour au calme']);
const OPPOSITION=Object.freeze(['Sans opposition','Coopération','Opposition dirigée','Opposition libre']);
const LEVELS=Object.freeze(['Débutant','Intermédiaire','Expert']);
const SUBGROUPS=Object.freeze(['Gym douce','Training','Gym douce, Training']);
const MODES=Object.freeze(['Répétitions','Durée','Durée + répétitions max']);
const OPTIONAL=new Set(['tagsText','restrictions','effortSeconds','repetitions','repetitionsMax']);
const NUMBER_FIELDS=new Set(['effortSeconds','repetitions','repetitionsMax','blockDuration']);
const integer=(s,max)=>typeof s==='string'&&/^[1-9][0-9]*$/.test(s)&&Number(s)<=max;
function validateWorkbookRow(discipline,record){
 const errors=[],add=(field,code)=>errors.push({field,code});
 const spec=CONTRACTS[discipline];if(!spec)return [{field:'discipline',code:'invalid-discipline'}];
 for(const [,key] of spec){
  const value=record[key];
  if(value===null||value===undefined||value===''){
   if(!OPTIONAL.has(key))add(key,'required');continue;
  }
  if(typeof value!=='string'||!value.trim()||value.includes('\u0000')||value.length>(key==='reference'?80:key==='name'?250:key==='family'?120:1800)){add(key,'invalid-text');continue;}
  if(NUMBER_FIELDS.has(key)&&!integer(value,key==='effortSeconds'?7200:key==='blockDuration'?120:10000))add(key,'positive-integer');
 }
 const expected=discipline==='taiso'?'Taïso':'Judo';
 if(record.discipline!==expected)add('discipline','invalid-discipline');
 if(record.sheetType!=='Exercice')add('sheetType','invalid-sheet-type');
 const prefix=discipline==='taiso'?'JSB-TAISO-':'JSB-JUDO-';
 if(typeof record.reference!=='string'||!record.reference.startsWith(prefix)||!/^JSB-(?:TAISO|JUDO)-[A-Z0-9][A-Z0-9_-]{0,59}$/.test(record.reference))add('reference','invalid-permanent-reference');
 if(discipline==='taiso'){
  if(!LEVELS.includes(record.level))add('level','invalid-level');
  if(!SUBGROUPS.includes(record.subgroup))add('subgroup','invalid-subgroup');
 }
 const mode=record.dosageMode,has=k=>record[k]!==null&&record[k]!==undefined&&record[k]!=='';
 if(!MODES.slice(0,discipline==='taiso'?2:3).includes(mode))add('dosageMode','invalid-mode');
 if(mode==='Répétitions'&&(!has('repetitions')||has('effortSeconds')||has('repetitionsMax')))add('dosageMode','repetition-fields');
 if(mode==='Durée'&&(!has('effortSeconds')||has('repetitions')||has('repetitionsMax')))add('dosageMode','duration-fields');
 if(mode==='Durée + répétitions max'&&(!has('effortSeconds')||!has('repetitionsMax')||has('repetitions')))add('dosageMode','combined-fields');
 if(discipline==='judo'){
  const ages=typeof record.ageCategory==='string'?record.ageCategory.split(';').map(x=>x.trim()):[];
  if(!ages.length||ages.some(a=>!AGE.includes(a))||new Set(ages).size!==ages.length)add('ageCategory','invalid-age');
  if(!ROLES.includes(record.pedagogicalRole))add('pedagogicalRole','invalid-role');
  if(!OPPOSITION.includes(record.opposition))add('opposition','invalid-opposition');
  if(mode===MODES[2]&&ages.some(a=>AGE.indexOf(a)<3))add('ageCategory','combined-age');
  if(ages.includes('Éveils')&&!OPPOSITION.slice(0,2).includes(record.opposition))add('opposition','eveil-opposition');
  if(ages.includes('Pré-poussins')&&record.opposition==='Opposition libre')add('opposition','pre-poussin-opposition');
 }
 return errors;
}
module.exports=Object.freeze({CONTRACTS,AGE,ROLES,OPPOSITION,LEVELS,SUBGROUPS,MODES,OPTIONAL,NUMBER_FIELDS,validateWorkbookRow});
