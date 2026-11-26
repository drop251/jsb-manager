'use strict';
const {createHash}=require('node:crypto');
const {validatePedagogicalDetails}=require('./catalogue-details.cjs');
const MAX_BYTES=4*1024*1024,MAX_ROWS=2000,MAX_ERRORS=100;
const validText=(v,n)=>typeof v==='string'&&v===v.trim()&&v.length>0&&v.length<=n&&!/[\u0000-\u001f\u007f]/.test(v);
function analyzeCatalogueImport(text,discipline){
 const errors=[];let errorCount=0;
 const add=(row,field,code)=>{errorCount++;if(errors.length<MAX_ERRORS)errors.push({row,field,code});};
 const invalid=()=>({ok:false,errorCount,errors});
 if(!['judo','taiso'].includes(discipline)){add(0,'discipline','invalid-discipline');return invalid();}
 if(typeof text!=='string'||Buffer.byteLength(text,'utf8')>MAX_BYTES){add(0,'file','size-limit');return invalid();}
 let input;try{input=JSON.parse(text);}catch{add(0,'file','invalid-json');return invalid();}
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==3||input.discipline!==discipline||typeof input.version!=='string'||!/^[A-Za-z0-9_.-]{1,80}$/.test(input.version)||!Array.isArray(input.exercises)){
  add(0,'file','invalid-envelope');return invalid();
 }
 if(input.exercises.length<1||input.exercises.length>MAX_ROWS){add(0,'exercises','row-limit');return invalid();}
 const seen=new Set(),rows=[],families=new Map();
 for(const [i,item] of input.exercises.entries()){
  const row=i+1,before=errorCount;
  if(!item||typeof item!=='object'||Array.isArray(item)||Object.keys(item).length!==4){add(row,'exercise','invalid-shape');continue;}
  for(const [key,max] of [['reference',80],['name',250],['family',120]])if(!validText(item[key],max))add(row,key,'invalid-text');
  if(validText(item.reference,80)){
   const normalized=item.reference.normalize('NFC').toLowerCase();
   if(seen.has(normalized))add(row,'reference','duplicate-reference');
   seen.add(normalized);
  }
  const details=validatePedagogicalDetails(discipline,item.details);
  if(!details)add(row,'details','invalid-pedagogical-fields');
  if(before!==errorCount)continue;
  rows.push({reference:item.reference,name:item.name,family:item.family,details});
  families.set(item.family,(families.get(item.family)||0)+1);
 }
 if(errorCount)return invalid();
 const canonical={discipline,version:input.version,exercises:rows};
 const hash=createHash('sha256').update(JSON.stringify(canonical),'utf8').digest('hex');
 return {ok:true,canonical,report:{discipline,version:input.version,hash,count:rows.length,families:[...families].sort(([a],[b])=>a.localeCompare(b,'fr')).map(([family,count])=>({family,count})),sample:rows.slice(0,5).map(({reference,name,family})=>({reference,name,family}))}};
}
module.exports=Object.freeze({analyzeCatalogueImport,MAX_BYTES,MAX_ROWS});
