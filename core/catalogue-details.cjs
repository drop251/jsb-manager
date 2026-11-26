'use strict';
// Structure canonique, distincte du contenu source : aucun champ inventé.
// Une validation structurelle ne remplace pas la validation pédagogique.
const common=Object.freeze(['safety','dosage','successCriteria','level','subgroup','equipment','moment','easier','harder','accessibility','inspiration','format']);
const taiso=Object.freeze([...common,'targetMuscles']);
const judo=Object.freeze([...common,'competence','pedagogicalRole','prerequisites','opposition','organization','blockDuration']);
// Extension canonique facultative tant que le classeur de référence n'a pas
// été rapproché du modèle. L'absence d'une valeur reste une absence.
const optionalText=Object.freeze(['executionDescription','subfamily','classification','sheetType','objective','tagsText','contractVersion','dosageMode','effortSeconds','repetitions','restrictions']);
const judoOnly=Object.freeze(['ageCategory','grade','repetitionsMax']);
function validatePedagogicalDetails(discipline,input){
 const fields=discipline==='taiso'?taiso:discipline==='judo'?judo:null;
 if(!fields||!input||typeof input!=='object'||Array.isArray(input))return null;
 const extra=discipline==='judo'?[...optionalText,...judoOnly]:optionalText;
 const optionalFields=new Set([...extra,'tags']);
 if(Object.keys(input).some(key=>!fields.includes(key)&&!optionalFields.has(key)))return null;
 const result={};
 for(const key of fields){
  if(!Object.hasOwn(input,key)||typeof input[key]!=='string'||!input[key].trim()||input[key].length>1800||input[key].includes('\u0000'))return null;
  result[key]=input[key];
 }
 for(const key of extra){
  if(!Object.hasOwn(input,key))continue;
  const value=input[key];
  if(typeof value!=='string'||!value.trim()||value.length>1800||value.includes('\u0000'))return null;
  result[key]=value;
 }
 if(Object.hasOwn(input,'tags')){
  if(!Array.isArray(input.tags)||input.tags.length>50||input.tags.some(v=>typeof v!=='string'||!v.trim()||v.length>120||v.includes('\u0000')))return null;
  // Keep source order and exact spelling; never silently deduplicate.
  result.tags=Object.freeze([...input.tags]);
 }
 if(Buffer.byteLength(JSON.stringify(result),'utf8')>30000)return null;
 return Object.freeze(result);
}
module.exports=Object.freeze({validatePedagogicalDetails});
