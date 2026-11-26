'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {validatePedagogicalDetails}=require('../core/catalogue-details.cjs');
const common=Object.fromEntries(['safety','dosage','successCriteria','level','subgroup','equipment','moment','easier','harder','accessibility','inspiration','format'].map(k=>[k,'Fixture '+k]));
const judo=Object.fromEntries(['competence','pedagogicalRole','prerequisites','opposition','organization','blockDuration'].map(k=>[k,'Fixture '+k]));
test('Fiches : les champs Judo et Taïso sont distincts et obligatoires',()=>{
 assert.deepEqual(validatePedagogicalDetails('taiso',{...common,targetMuscles:'Fixture'}),{...common,targetMuscles:'Fixture'});
 assert.deepEqual(validatePedagogicalDetails('judo',{...common,...judo}),{...common,...judo});
 assert.equal(validatePedagogicalDetails('judo',{...common,targetMuscles:'Fixture'}),null);
 assert.equal(validatePedagogicalDetails('taiso',{...common,...judo}),null);
 for(const key of Object.keys(judo)){
  const input={...common,...judo};delete input[key];assert.equal(validatePedagogicalDetails('judo',input),null,key);
 }
 for(const safety of ['',null,'   ','x'.repeat(1801)])assert.equal(validatePedagogicalDetails('taiso',{...common,targetMuscles:'Fixture',safety}),null);
 assert.equal(validatePedagogicalDetails('taiso',{...common,targetMuscles:'Fixture',extra:'Fixture'}),null);
 assert.equal(validatePedagogicalDetails('other',common),null);
});

test('Fiches enrichies : préservation des champs facultatifs sans déduction',()=>{
 const base={...common,targetMuscles:'Fixture'};
 const extra={executionDescription:'Fixture\nÉtape suivante',subfamily:'Sous-famille fixture',classification:'Classification fixture',tags:['Équilibre','éQUILIBRE','Équilibre']};
 const result=validatePedagogicalDetails('taiso',{...base,...extra});
 assert.deepEqual(result,{...base,...extra});
 assert.ok(Object.isFrozen(result.tags));
 assert.equal(Object.hasOwn(validatePedagogicalDetails('taiso',base),'executionDescription'),false);
 for(const invalid of [{tags:'Fixture'},{tags:['']},{tags:[null]},{tags:Array(51).fill('Fixture')},{executionDescription:''},{classification:2},{subfamily:'x'.repeat(1801)}]){
  assert.equal(validatePedagogicalDetails('taiso',{...base,...invalid}),null);
 }
 assert.deepEqual(validatePedagogicalDetails('judo',{...common,...judo,tags:[]}).tags,[]);
});
