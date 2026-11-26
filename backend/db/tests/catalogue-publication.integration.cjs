'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomBytes}=require('node:crypto');
const {Pool}=require('pg');
const {createCataloguePublisher}=require('../catalogue-publisher.cjs');
const {analyzeCatalogueImport}=require('../../../core/catalogue-import.cjs');
test('Publication catalogue : transaction, empreinte, concurrence et conservation des versions',async()=>{
 assert.equal(process.env.PGDATABASE,'jsb_ci');
 const pool=new Pool({max:4});let safe=false;
 const id=randomBytes(16).toString('hex'),digest=randomBytes(32).toString('hex');
 try{
  assert.equal((await pool.query('SELECT current_database() AS name')).rows[0].name,'jsb_ci');safe=true;
  const now=Date.now();
  // Opaque fixture digest: no actual session token or usable credentials.
  await pool.query("INSERT INTO jsb_auth.accounts(id,email,password_hash,role,status,email_verified,created_at) VALUES ($1,'catalogue-publisher@example.test','fixture-only','admin','active',true,$2)",[id,now]);
  await pool.query("INSERT INTO jsb_auth.sessions(hash,account_id,role_at_issue,credential_version,issued_at,expires_at) VALUES ($1,$2,'admin',1,$3,$4)",[digest,id,now-1000,now+600000]);
  const actor={id,role:'admin',authenticated:true,status:'active'};
  const publisher=createCataloguePublisher(pool);
  function payload(version,previous=null,discipline='taiso'){
   const fields=['safety','dosage','successCriteria','level','subgroup','equipment','moment','easier','harder','accessibility','inspiration','format',...(discipline==='taiso'?['targetMuscles']:['competence','pedagogicalRole','prerequisites','opposition','organization','blockDuration'])];
   const details=Object.fromEntries(fields.map(k=>[k,'Synthetic '+k]));
   const text=JSON.stringify({discipline,version,exercises:[{reference:'fixture',name:'Synthetic '+version,family:'Fixture',details}]});
   return {discipline,text,expectedHash:analyzeCatalogueImport(text,discipline).report.hash,expectedPreviousVersion:previous,confirmed:true};
  }
  const first=payload('publish-fixture-1');
  assert.equal((await publisher.publish({...actor,role:'coach'},digest,first)).status,403);
  assert.equal((await publisher.publish(actor,'0'.repeat(64),first)).status,401);
  assert.equal((await publisher.publish(actor,digest,{...first,confirmed:false})).status,400);
  assert.equal((await publisher.publish(actor,digest,{...first,expectedHash:'0'.repeat(64)})).status,409);
  assert.equal((await pool.query('SELECT count(*) AS n FROM jsb_catalogue.releases')).rows[0].n,'0');
  assert.equal((await publisher.publish(actor,digest,first)).status,200);
  assert.equal((await publisher.publish(actor,digest,first)).status,409);
  const candidates=await Promise.all(['publish-fixture-2','publish-fixture-3'].map(v=>publisher.publish(actor,digest,payload(v,'publish-fixture-1'))));
  assert.deepEqual(candidates.map(r=>r.status).sort(),[200,409]);
  const winning=candidates.find(r=>r.ok).publication.version;
  assert.equal((await pool.query("SELECT version FROM jsb_catalogue.current_release WHERE discipline='taiso'")).rows[0].version,winning);
  assert.equal((await pool.query("SELECT count(*) AS n FROM jsb_catalogue.exercises WHERE discipline='taiso'")).rows[0].n,'2');
  assert.equal((await pool.query("SELECT previous_version FROM jsb_catalogue.publications WHERE discipline='taiso' AND version=$1",[winning])).rows[0].previous_version,'publish-fixture-1');
  assert.equal((await publisher.publish(actor,digest,payload('publish-fixture-j',null,'judo'))).status,200);
  assert.equal((await pool.query("SELECT version FROM jsb_catalogue.current_release WHERE discipline='judo'")).rows[0].version,'publish-fixture-j');
  // Workbook-shaped synthetic data only: never commit the real provisional catalogue.
  const {HEADERS,mapTaisoRecipe,restoreSourceRow}=require('../../../core/taiso-xlsx-recipe.cjs');
  const sourceRows=Array.from({length:228},(_,i)=>{
   const row=HEADERS.map((_,j)=>'Fixture '+i+' / '+j);
   row[2]='Taïso';row[3]='Exercice';row[7]='Renforcement';row[20]='a, b, a';return row;
  });
  const recipe=mapTaisoRecipe([[...HEADERS],...sourceRows]);
  assert.equal(analyzeCatalogueImport(JSON.stringify(recipe),'taiso').ok,false);
  // Only here, in the ephemeral test database, unwrap synthetic exercises
  // to exercise the real publication transaction at the observed volume.
  const forbidden=JSON.stringify({discipline:'taiso',version:'publish-fixture-volume',exercises:recipe.items.map(i=>i.exercise)});
  assert.equal((await publisher.publish(actor,digest,{discipline:'taiso',text:forbidden,expectedHash:analyzeCatalogueImport(forbidden,'taiso').report.hash,expectedPreviousVersion:winning,confirmed:true})).status,400);
  const text=JSON.stringify({discipline:'taiso',version:'publish-fixture-volume',exercises:recipe.items.map(i=>({...i.exercise,reference:'SYNTHETIC-'+String(i.sourceRow).padStart(4,'0')}))});
  const large=await publisher.publish(actor,digest,{discipline:'taiso',text,expectedHash:analyzeCatalogueImport(text,'taiso').report.hash,expectedPreviousVersion:winning,confirmed:true});
  assert.equal(large.status,200);assert.equal(large.publication.count,228);
  const stored=await pool.query("SELECT reference,name,family,pedagogical_details AS details FROM jsb_catalogue.exercises WHERE discipline='taiso' AND version='publish-fixture-volume' ORDER BY reference");
  assert.equal(stored.rowCount,228);
  assert.deepEqual(stored.rows.map(exercise=>restoreSourceRow({exercise})),sourceRows);
  assert.equal((await pool.query("SELECT count(*) AS n FROM jsb_catalogue.exercises WHERE discipline='taiso' AND version=$1",[winning])).rows[0].n,'1');
  const history=require('../catalogue-history.cjs').createCatalogueHistory(pool);
  const before=(await history.list(actor,'taiso')).history;
  assert.equal(before.activeVersion,'publish-fixture-volume');
  assert.equal(before.total,3);
  assert.equal(before.versions.find(v=>v.version==='publish-fixture-volume').count,228);
  assert.equal((await history.list({...actor,role:'coach'},'taiso')).status,403);
  const restore={discipline:'taiso',targetVersion:winning,expectedVersion:before.activeVersion,expectedGeneration:before.generation,confirmationVersion:winning,confirmed:true,reason:'Synthetic regression'};
  assert.equal((await history.restore(actor,digest,{...restore,reason:''})).status,400);
  assert.equal((await history.restore(actor,digest,{...restore,confirmed:false})).status,400);
  assert.equal((await history.restore(actor,digest,{...restore,targetVersion:'publish-fixture-j',confirmationVersion:'publish-fixture-j'})).status,409);
  assert.equal((await history.restore({...actor,role:'individual'},digest,restore)).status,403);
  assert.equal((await history.restore(actor,'0'.repeat(64),restore)).status,401);
  const results=await Promise.all([history.restore(actor,digest,restore),history.restore(actor,digest,restore)]);
  assert.deepEqual(results.map(x=>x.status).sort(),[200,409]);
  const after=(await history.list(actor,'taiso')).history;
  assert.equal(after.activeVersion,winning);
  assert.equal(after.total,3);
  assert.equal(after.restorations[0].restoredVersion,winning);
  assert.equal(after.restorations[0].previousVersion,'publish-fixture-volume');
  assert.equal(after.restorations[0].reason,'Synthetic regression');
  const back={...restore,targetVersion:'publish-fixture-volume',confirmationVersion:'publish-fixture-volume',expectedVersion:winning,expectedGeneration:after.generation};
  assert.equal((await history.restore(actor,digest,back)).status,200);
  assert.equal((await history.restore(actor,digest,restore)).status,409);
  assert.equal((await publisher.publish(actor,digest,{...payload('publish-fixture-stale','publish-fixture-volume'),expectedGeneration:before.generation})).status,409);
  assert.equal((await pool.query("SELECT count(*) AS n FROM jsb_catalogue.exercises WHERE discipline='taiso'")).rows[0].n,'230');
  assert.equal((await history.list(actor,'judo')).history.activeVersion,'publish-fixture-j');
  await pool.query("UPDATE jsb_auth.accounts SET status='suspended' WHERE id=$1",[id]);
  assert.equal((await publisher.publish(actor,digest,payload('publish-fixture-4','publish-fixture-volume'))).status,403);
 }finally{try{if(safe){
  await pool.query("DELETE FROM jsb_catalogue.restorations WHERE actor_id=$1",[id]);
  await pool.query("DELETE FROM jsb_catalogue.publications WHERE actor_id=$1",[id]);
  await pool.query("DELETE FROM jsb_catalogue.current_release WHERE version LIKE 'publish-fixture-%'");
  await pool.query("DELETE FROM jsb_catalogue.exercises WHERE version LIKE 'publish-fixture-%'");
  await pool.query("DELETE FROM jsb_catalogue.releases WHERE version LIKE 'publish-fixture-%'");
  await pool.query('DELETE FROM jsb_auth.accounts WHERE id=$1',[id]);
 }}finally{await pool.end();}}
});
