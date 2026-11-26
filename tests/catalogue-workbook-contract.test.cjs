'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {CONTRACTS,CONTRACT_VERSION,validateWorkbookRow}=require('../core/catalogue-workbook-contract.cjs');
const {analyzeWorkbook}=require('../core/catalogue-workbook-analysis.cjs');
const {analyzeCatalogueImport}=require('../core/catalogue-import.cjs');
function fixture(discipline,overrides={}){
 const row=Object.fromEntries(CONTRACTS[discipline].map(([,key])=>[key,'Fixture '+key]));
 Object.assign(row,{reference:discipline==='taiso'?'JSB-TAISO-FIXTURE-1':'JSB-JUDO-FIXTURE-1',discipline:discipline==='taiso'?'Taïso':'Judo',sheetType:'Exercice',dosageMode:'Répétitions',repetitions:'8',effortSeconds:null,tagsText:null,restrictions:null});
 if(discipline==='taiso')Object.assign(row,{level:'Intermédiaire',subgroup:'Gym douce, Training'});
 else Object.assign(row,{ageCategory:'Benjamins; Minimes',pedagogicalRole:'Acquisition',opposition:'Coopération',blockDuration:'10',repetitionsMax:null});
 return {...row,...overrides};
}
const rows=(discipline,...records)=>[CONTRACTS[discipline].map(([label])=>label),...records.map(r=>CONTRACTS[discipline].map(([,key])=>r[key]))];
test('Contrat Excel 1 : en-têtes exacts, modèles indépendants, refus de publication automatique',()=>{
 for(const discipline of ['taiso','judo']){
  const spec=CONTRACTS[discipline],record=fixture(discipline);
  assert.equal(spec.length,discipline==='taiso'?27:35);
  assert.deepEqual(validateWorkbookRow(discipline,record),[]);
  const result=analyzeWorkbook(rows(discipline,record),discipline,'v1');
  assert.equal(result.valid,true,JSON.stringify(result));assert.equal(result.publishable,false);
  assert.equal(result.contractVersion,CONTRACT_VERSION);assert.equal(result.columns,spec.length);
  assert.equal(result.count,1);assert.equal(result.sample[0].reference,record.reference);
  assert.equal(analyzeWorkbook(rows(discipline,record,record),discipline,'v1').valid,false);
  assert.equal(analyzeWorkbook(rows(discipline),discipline,'v1').valid,false);
  assert.equal(analyzeWorkbook(rows(discipline,record),discipline,'recette-v1').valid,false);
  assert.equal(analyzeWorkbook(rows(discipline,fixture(discipline,{reference:'RECETTE-L0002'})),discipline,'v1').valid,false);
 }
});
test('Contrat Excel 1 : prescriptions alternatives Taïso et modes Judo conditionnels',()=>{
 const t=fixture('taiso',{dosageMode:'Durée et répétitions',effortSeconds:30,repetitions:8});
 assert.equal(analyzeWorkbook(rows('taiso',t),'taiso','v1').valid,true);
 assert.equal(analyzeWorkbook(rows('taiso',{...t,effortSeconds:null}),'taiso','v1').valid,false);
 assert.equal(analyzeWorkbook(rows('taiso',{...t,dosageMode:'Durée + répétitions max'}),'taiso','v1').valid,false);
 const j=fixture('judo',{dosageMode:'Durée + répétitions max',effortSeconds:30,repetitions:null,repetitionsMax:5});
 assert.equal(analyzeWorkbook(rows('judo',j),'judo','v1').valid,true);
 for(const changed of [{ageCategory:'Poussins; Benjamins'},{ageCategory:'Éveils'},{repetitionsMax:null},{repetitionsMax:2.5},{blockDuration:null},{opposition:'Opposition libre',ageCategory:'Pré-poussins'}]){
  assert.equal(analyzeWorkbook(rows('judo',{...j,...changed}),'judo','v1').valid,false,JSON.stringify(changed));
 }
 assert.equal(analyzeWorkbook(rows('judo',fixture('judo',{ageCategory:'Éveils',opposition:'Opposition dirigée'})),'judo','v1').valid,false);
 assert.equal(analyzeWorkbook(rows('judo',j),'taiso','v1').valid,false);
});
test('Les règles Excel restent actives après conversion en JSON canonique',()=>{
 const record=fixture('taiso'),{reference,name,family,discipline,...values}=record;
 const details={contractVersion:CONTRACT_VERSION,...Object.fromEntries(Object.entries(values).filter(([,v])=>v!==null))};
 const envelope={discipline:'taiso',version:'v1',exercises:[{reference,name,family,details}]};
 assert.equal(analyzeCatalogueImport(JSON.stringify(envelope),'taiso').ok,true);
 assert.equal(analyzeCatalogueImport(JSON.stringify({...envelope,exercises:[{reference,name,family,details:{...details,repetitions:'0'}}]}),'taiso').ok,false);
 assert.equal(analyzeCatalogueImport(JSON.stringify({...envelope,exercises:[{reference,name,family,details:{...details,contractVersion:'unknown'}}]}),'taiso').ok,false);
});
