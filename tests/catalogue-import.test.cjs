'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {analyzeCatalogueImport,MAX_BYTES}=require('../core/catalogue-import.cjs');
const details=Object.fromEntries(['safety','dosage','successCriteria','level','subgroup','equipment','moment','easier','harder','accessibility','inspiration','format','targetMuscles'].map(k=>[k,'Fixture '+k]));
const exercise={reference:'A-01',name:'Fixture Alpha',family:'Fixture',details};
const input={discipline:'taiso',version:'test-v1',exercises:[exercise]};
const analyze=(v,d='taiso')=>analyzeCatalogueImport(JSON.stringify(v),d);
test('Import catalogue : empreinte stable et rapport borné sans modification des données',()=>{
 const a=analyze(input),b=analyze({...input,exercises:[{details:Object.fromEntries(Object.entries(details).reverse()),family:'Fixture',name:'Fixture Alpha',reference:'A-01'}]});
 assert.equal(a.ok,true);assert.equal(a.report.hash,b.report.hash);assert.match(a.report.hash,/^[a-f0-9]{64}$/);
 assert.equal(a.report.count,1);assert.deepEqual(a.report.families,[{family:'Fixture',count:1}]);
 assert.deepEqual(a.report.sample,[{reference:'A-01',name:'Fixture Alpha',family:'Fixture'}]);
 assert.notEqual(analyze({...input,exercises:[{...exercise,name:'Modified'}]}).report.hash,a.report.hash);
 assert.equal(analyzeCatalogueImport('x'.repeat(MAX_BYTES+1),'taiso').errors[0].code,'size-limit');
});
test('Import catalogue : discipline, doublons, données incomplètes et limites',()=>{
 assert.equal(analyze(input,'judo').ok,false);
 assert.equal(analyze({...input,exercises:[]}).ok,false);
 assert.equal(analyze({...input,exercises:[exercise,{...exercise,reference:'a-01'}]}).errors[0].code,'duplicate-reference');
 assert.equal(analyze({...input,exercises:[{...exercise,details:{safety:'Fixture'}}]}).errors[0].code,'invalid-pedagogical-fields');
 assert.equal(analyze({...input,exercises:[{...exercise,unexpected:true}]}).ok,false);
 const many=analyze({...input,exercises:Array.from({length:120},()=>null)});
 assert.equal(many.errorCount,120);assert.equal(many.errors.length,100);
 assert.equal(analyzeCatalogueImport('{','taiso').errors[0].code,'invalid-json');
});
