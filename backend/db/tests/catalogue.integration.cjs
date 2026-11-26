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
 }finally{try{if(safe){await pool.query("DELETE FROM jsb_catalogue.current_release WHERE version='ci-fixture'");await pool.query("DELETE FROM jsb_catalogue.exercises WHERE version='ci-fixture'");await pool.query("DELETE FROM jsb_catalogue.releases WHERE version='ci-fixture'");}}finally{await pool.end();}}
});
