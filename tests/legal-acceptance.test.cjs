'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {createLegalDocuments}=require('../backend/legal-documents.cjs');
const {createLegalAcceptance}=require('../backend/legal-acceptance.cjs');
const actor=role=>({id:role,role,status:'active',authenticated:true});
const admin=actor('admin'),coach=actor('coach'),person=actor('individual');
function fixture(){
 let clock=1000;const drafts=new Map(),docs=[],records=new Map();
 const active=new Set(['coach','individual']);
 const store={
  createDraft:async d=>{drafts.set(d.id,d);return true;},
  publishDraft:async r=>{
   const d=drafts.get(r.id);if(!d||d.type!==r.type||d.hash!==r.expectedHash||docs.some(x=>x.id===r.id||x.type===r.type&&x.effectiveAt>=r.effectiveAt))return 'conflict';
   docs.push({...d,version:docs.filter(x=>x.type===r.type).length+1,effectiveAt:r.effectiveAt,publishedAt:r.publishedAt});return 'published';
  },
  readPublished:async type=>docs.filter(d=>d.type===type),
  readDrafts:async type=>[...drafts.values()].filter(d=>d.type===type),
  recordCurrent:async r=>{
   if(!active.has(r.accountId))return 'forbidden';
   const d=docs.filter(d=>d.type===r.type&&d.effectiveAt<=r.recordedAt).sort((a,b)=>b.version-a.version)[0];
   if(!d||d.version!==r.version||d.hash!==r.hash)return 'conflict';
   const key=JSON.stringify([r.accountId,r.type,r.version]);
   if(records.has(key))return 'already-recorded';
   records.set(key,{...r});return 'recorded';
  },
  readOwn:async id=>[...records.values()].filter(r=>r.accountId===id)
 };
 const legal=createLegalDocuments({store,now:()=>clock}),service=createLegalAcceptance({store,now:()=>clock});
 async function publish(type,text,effectiveAt=clock){
  const d=await legal.draft(admin,{type,text});
  assert.equal(d.ok,true);assert.equal((await legal.publish(admin,{type,id:d.id,hash:d.hash,effectiveAt,confirmed:true})).ok,true);
  const doc=docs.at(-1);
  return {type,kind:type==='cgu'?'acceptance':'acknowledgement',version:doc.version,hash:doc.hash,confirmed:true};
 }
 return {service,store,records,active,publish,advance:n=>clock+=n,get clock(){return clock;}};
}
test('Acceptations : identité et horodatage serveur, isolation Coach et Particulier',async()=>{
 const f=fixture(),r=await f.publish('cgu','Texte test uniquement');
 assert.equal((await f.service.record(coach,{...r,accountId:person.id,recordedAt:1})).status,200);
 assert.deepEqual((await f.service.history(person)).records,[]);
 const records=(await f.service.history(coach)).records;
 assert.deepEqual(records,[{type:'cgu',kind:'acceptance',version:1,hash:r.hash,recordedAt:1000}]);
 assert.equal((await f.service.record(person,r)).status,200);assert.equal(f.records.size,2);
 for(const a of [admin,null,{...coach,status:'suspended'}]){
  assert.equal((await f.service.record(a,r)).status,403);assert.equal((await f.service.history(a)).status,403);
 }
});
test('Acceptations : version en vigueur exacte, aucune acceptation anticipée ou périmée',async()=>{
 const f=fixture(),v1=await f.publish('cgu','Version test 1');
 assert.equal((await f.service.record(coach,v1)).ok,true);
 const v2=await f.publish('cgu','Version test 2',1100);
 assert.equal((await f.service.record(coach,v2)).status,409);
 f.advance(100);
 assert.equal((await f.service.record(person,v1)).status,409);
 assert.equal((await f.service.record(coach,{...v2,hash:'0'.repeat(64)})).status,409);
 assert.equal((await f.service.record(coach,v2)).status,200);
 assert.deepEqual((await f.service.history(coach)).records.map(x=>x.version),[1,2]);
});
test('Acceptations : répétitions concurrentes et horodatage initial conservé',async()=>{
 const f=fixture(),r=await f.publish('cgu','Texte test');
 const results=await Promise.all(Array.from({length:8},()=>f.service.record(coach,r)));
 assert.equal(results.every(x=>x.ok),true);assert.equal(f.records.size,1);
 f.advance(50);assert.equal((await f.service.record(coach,r)).ok,true);
 assert.equal((await f.service.history(coach)).records[0].recordedAt,1000);
});
test('Acceptations : prise de connaissance distincte, aucune CGV ni consentement facultatif implicite',async()=>{
 const f=fixture(),r=await f.publish('privacy','Texte test confidentialité');
 for(const patch of [{kind:'acceptance'},{kind:'consent'},{type:'cgv'},{confirmed:false},{version:0},{hash:'bad'}])
  assert.equal((await f.service.record(person,{...r,...patch})).status,400);
 assert.equal((await f.service.record(person,r)).status,200);
 assert.equal((await f.service.history(person)).records[0].kind,'acknowledgement');
});
test('Acceptations : compte révoqué, fuite inter-comptes et stockage indisponible',async()=>{
 const f=fixture(),r=await f.publish('cgu','Texte test');
 f.active.delete('coach');assert.equal((await f.service.record(coach,r)).status,403);
 await f.service.record(person,r);
 const leaked=createLegalAcceptance({store:{...f.store,readOwn:async()=>[...f.records.values()]}});
 assert.deepEqual(await leaked.history(coach),{ok:false,status:503});
 const broken=createLegalAcceptance({store:{...f.store,recordCurrent:async()=>{throw Error('secret');}}});
 assert.deepEqual(await broken.record(person,r),{ok:false,status:503});
});
