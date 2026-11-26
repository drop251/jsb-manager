'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Pool}=require('pg');
const {createCatalogueReadService}=require('../../catalogue-read.cjs');
test('Catalogues : séparation des disciplines, publication explicite et permissions',async()=>{
 assert.equal(process.env.PGDATABASE,'jsb_ci');
 const pool=new Pool({max:2});let safe=false;
 try{
  assert.equal((await pool.query('SELECT current_database() AS name')).rows[0].name,'jsb_ci');safe=true;
  const service=createCatalogueReadService(pool);
  const actor=role=>({id:'fixture',authenticated:true,status:'active',role});
  for(const role of ['coach','individual','admin'])assert.deepEqual((await service.read(actor(role),'judo')).catalogue,{discipline:'judo',state:'unpublished',version:null,publishedAt:null,count:0,families:[]});
  assert.equal((await service.read(null,'taiso')).status,403);
  assert.equal((await service.read({...actor('coach'),status:'suspended'},'taiso')).status,403);
  assert.equal((await service.read(actor('coach'),'other')).status,400);
  for(const discipline of ['judo','taiso']){
   await pool.query('INSERT INTO jsb_catalogue.releases(discipline,version,source_hash,published_at) VALUES ($1,$2,$3,$4)',[discipline,'ci-fixture','a'.repeat(64),1000]);
   await pool.query('INSERT INTO jsb_catalogue.exercises(discipline,version,reference,name,family) VALUES ($1,$2,$3,$4,$5)',[discipline,'ci-fixture','ci-1','Synthetic fixture',discipline==='judo'?'Fixture J':'Fixture T']);
  }
  assert.equal((await service.read(actor('coach'),'taiso')).catalogue.state,'unpublished');
  await pool.query("INSERT INTO jsb_catalogue.current_release(discipline,version) VALUES ('taiso','ci-fixture')");
  for(const role of ['coach','individual','admin']){
   const r=await service.read(actor(role),'taiso');
   assert.equal(r.catalogue.version,'ci-fixture');assert.equal(r.catalogue.count,1);
   assert.deepEqual(r.catalogue.families,[{family:'Fixture T',count:1}]);
   assert.equal((await service.read(actor(role),'judo')).catalogue.state,'unpublished');
  }

  const ref={version:'ci-fixture',reference:'ci-1'};
  assert.equal((await service.detail(actor('coach'),'taiso',ref)).exercise.state,'summary');
  assert.equal((await service.detail(actor('coach'),'judo',ref)).status,409);
  assert.equal((await service.detail(null,'taiso',ref)).status,403);
  assert.equal((await service.detail(actor('coach'),'taiso',{...ref,reference:'missing'})).status,404);
  const details=Object.fromEntries(['safety','dosage','successCriteria','level','subgroup','equipment','moment','easier','harder','accessibility','inspiration','format','targetMuscles'].map(k=>[k,'Synthetic '+k]));
  await pool.query("UPDATE jsb_catalogue.exercises SET pedagogical_details=$1 WHERE discipline='taiso' AND version='ci-fixture' AND reference='ci-1'",[JSON.stringify(details)]);
  for(const role of ['coach','individual','admin']){
   const result=await service.detail(actor(role),'taiso',ref);
   assert.equal(result.exercise.state,'complete');assert.deepEqual(result.exercise.details,details);
  }
  await pool.query("UPDATE jsb_catalogue.exercises SET pedagogical_details=$1 WHERE discipline='taiso' AND version='ci-fixture' AND reference='ci-1'",[JSON.stringify({safety:'Incomplete fixture'})]);
  assert.equal((await service.detail(actor('coach'),'taiso',ref)).status,503);
  const base={version:'ci-fixture'};
  assert.equal((await service.search(actor('coach'),'judo',base)).status,409);
  assert.equal((await service.search(null,'taiso',base)).status,403);
  assert.equal((await service.search(actor('coach'),'taiso',{...base,offset:-1})).status,400);
  assert.equal((await service.search(actor('coach'),'taiso',{...base,query:'%'})).results.total,0);
  const exact=await service.search(actor('individual'),'taiso',{...base,query:'CI-1',family:'Fixture T'});
  assert.deepEqual(exact.results.items,[{reference:'ci-1',name:'Synthetic fixture',family:'Fixture T'}]);
  assert.equal((await service.search(actor('admin'),'taiso',{...base,family:'Fixture J'})).results.total,0);
  for(let i=0;i<32;i++)await pool.query("INSERT INTO jsb_catalogue.exercises(discipline,version,reference,name,family) VALUES ('taiso','ci-fixture',$1,$2,'Fixture T')",['ci-page-'+i,'Page '+String(i).padStart(2,'0')]);
  const page1=(await service.search(actor('coach'),'taiso',base)).results;
  const page2=(await service.search(actor('coach'),'taiso',{...base,offset:30})).results;
  assert.equal(page1.total,33);assert.equal(page1.items.length,30);assert.equal(page2.items.length,3);
  assert.equal(new Set([...page1.items,...page2.items].map(i=>i.reference)).size,33);
  assert.equal((await service.search(actor('coach'),'taiso',{...base,version:'old'})).status,409);
 }finally{try{if(safe){await pool.query("DELETE FROM jsb_catalogue.current_release WHERE version='ci-fixture'");await pool.query("DELETE FROM jsb_catalogue.exercises WHERE version='ci-fixture'");await pool.query("DELETE FROM jsb_catalogue.releases WHERE version='ci-fixture'");}}finally{await pool.end();}}
});
