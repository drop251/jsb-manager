'use strict';
const {CONTRACT_VERSION,CONTRACTS,NUMBER_FIELDS,validateWorkbookRow}=require('./catalogue-workbook-contract.cjs');
const {analyzeCatalogueImport}=require('./catalogue-import.cjs');
const {HEADERS,mapTaisoRecipe,restoreSourceRow}=require('./taiso-xlsx-recipe.cjs');
const same=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
function analyzeWorkbook(rows,discipline,version){
 const spec=CONTRACTS[discipline],errors=[];let errorCount=0;
 const add=(row,field,code)=>{errorCount++;if(errors.length<100)errors.push({row,field,code});};
 const invalid=()=>({valid:false,errorCount,errors,publishable:false});
 if(!spec||!Array.isArray(rows)||!Array.isArray(rows[0])||rows.length>2001){add(0,'file','invalid-xlsx');return invalid();}
 if(discipline==='taiso'&&same(rows[0],HEADERS)){
  try{
   const recipe=mapTaisoRecipe(rows);
   if(JSON.stringify(recipe.items.map(restoreSourceRow))!==JSON.stringify(rows.slice(1)))throw Error();
   return {valid:true,mode:'xlsx-recipe',publishable:false,columns:HEADERS.length,...recipe.report};
  }catch{add(0,'file','invalid-xlsx');return invalid();}
 }
 if(!same(rows[0],spec.map(([header])=>header))){add(1,'file','invalid-headers');return invalid();}
 if(typeof version!=='string'||!/^[A-Za-z0-9_.-]{1,80}$/.test(version)||version.toLowerCase().startsWith('recette-')){add(0,'version','invalid-version');return invalid();}
 if(rows.length<2){add(0,'exercises','empty-catalogue');return invalid();}
 const exercises=[];
 for(const [index,row] of rows.slice(1).entries()){
  if(!Array.isArray(row)||row.length!==spec.length){add(index+2,'file','invalid-columns');continue;}
  const record=Object.fromEntries(spec.map(([,key],i)=>[key,NUMBER_FIELDS.has(key)&&Number.isSafeInteger(row[i])?String(row[i]):row[i]]));
  const rowErrors=validateWorkbookRow(discipline,record);
  if(rowErrors.length){for(const e of rowErrors)add(index+2,e.field,e.code);continue;}
  const {reference,name,family,discipline:ignored,...fields}=record;
  const details={contractVersion:CONTRACT_VERSION,...Object.fromEntries(Object.entries(fields).filter(([,v])=>v!==null&&v!==''&&v!==undefined))};
  exercises.push({reference,name,family,details});
 }
 if(errorCount)return invalid();
 const checked=analyzeCatalogueImport(JSON.stringify({discipline,version,exercises}),discipline);
 if(!checked.ok){for(const e of checked.errors)add(e.row?e.row+1:0,e.field,e.code);return {...invalid(),errorCount:checked.errorCount};}
 return {valid:true,mode:'xlsx-contract',contractVersion:CONTRACT_VERSION,publishable:false,columns:spec.length,...checked.report};
}
module.exports=Object.freeze({analyzeWorkbook});
