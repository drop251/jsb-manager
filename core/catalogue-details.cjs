'use strict';
// Structure canonique, distincte du contenu source : aucun champ inventé.
// Une validation structurelle ne remplace pas la validation pédagogique.
const common=Object.freeze(['safety','dosage','successCriteria','level','subgroup','equipment','moment','easier','harder','accessibility','inspiration','format']);
const taiso=Object.freeze([...common,'targetMuscles']);
const judo=Object.freeze([...common,'competence','pedagogicalRole','prerequisites','opposition','organization','blockDuration']);
function validatePedagogicalDetails(discipline,input){
 const fields=discipline==='taiso'?taiso:discipline==='judo'?judo:null;
 if(!fields||!input||typeof input!=='object'||Array.isArray(input))return null;
 if(Object.keys(input).length!==fields.length)return null;
 const result={};
 for(const key of fields){
  if(!Object.hasOwn(input,key)||typeof input[key]!=='string'||!input[key].trim()||input[key].length>1800||input[key].includes('\u0000'))return null;
  result[key]=input[key];
 }
 if(Buffer.byteLength(JSON.stringify(result),'utf8')>30000)return null;
 return Object.freeze(result);
}
module.exports=Object.freeze({validatePedagogicalDetails});
