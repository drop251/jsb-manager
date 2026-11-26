'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createLegalDocuments}=require('../backend/legal-documents.cjs');
const actor=(role,id=role)=>({id,role,status:'active',authenticated:true});
const admin=actor('admin'),coach=actor('coach'),individual=actor('individual');
function fixture(commercialEnabled=false){
 let clock=1000;const drafts=new Map(),published=[],audit=[];
 const store={
  createDraft:async d=>{if(drafts.has(d.id))return false;drafts.set(d.id,{...d});return true;},
  publishDraft:async r=>{
   const d=drafts.get(r.id),sameType=published.filter(v=>v.type===r.type);
   if(!d||d.type!==r.type||d.hash!==r.expectedHash||sameType.some(v=>v.id===d.id)||sameType.some(v=>v.effectiveAt>=r.effectiveAt))return 'conflict';
   published.push({...d,version:sameType.length+1,publishedAt:r.publishedAt,effectiveAt:r.effectiveAt});
   audit.push({actorId:r.actorId,id:r.id,publishedAt:r.publishedAt});return 'published';
  },
  readPublished:async type=>published.filter(d=>d.type===type),
  readDrafts:async type=>[...drafts.values()].filter(d=>d.type===type)
 };
 return {store,drafts,published,audit,service:createLegalDocuments({store,now:()=>clock,commercialEnabled}),advance:n=>clock+=n};
}
test('Documents : accès aux brouillons et publication exclusivement administrateur',async()=>{
 const f=fixture(),s=f.service;
 for(const a of [coach,individual,null,{...admin,status:'suspended'}]){
  assert.equal((await s.draft(a,{type:'cgu',text:'Texte de test'})).status,403);
  assert.equal((await s.publish(a,{})).status,403);
  assert.equal((await s.listDrafts(a,'cgu')).status,403);
 }
 const d=await s.draft(admin,{type:'cgu',text:'Texte de test uniquement',createdBy:'other'});
 assert.equal(d.status,201);assert.equal(f.drafts.get(d.id).createdBy,'admin');
 assert.equal((await s.listDrafts(admin,'cgu')).documents.length,1);
 assert.deepEqual((await s.listPublished(coach,'cgu')).documents,[]);
 assert.deepEqual((await s.listPublished(individual,'cgu')).documents,[]);
});
test('Documents : confirmation explicite, empreinte exacte, publication unique et historique immuable',async()=>{
 const f=fixture(),s=f.service;
 const d=await s.draft(admin,{type:'cgu',text:'Version test 1'});
 const req={type:'cgu',id:d.id,hash:d.hash,effectiveAt:1100,confirmed:true};
 assert.equal((await s.publish(admin,{...req,confirmed:false})).status,400);
 assert.equal((await s.publish(admin,{...req,effectiveAt:999})).status,400);
 assert.equal((await s.publish(admin,{...req,hash:'0'.repeat(64)})).status,409);
 const concurrent=await Promise.all([s.publish(admin,req),s.publish(admin,req)]);
 assert.equal(concurrent.filter(r=>r.ok).length,1);
 const first=JSON.stringify(f.published[0]);
 const d2=await s.draft(admin,{type:'cgu',text:'Version test 2'});
 assert.equal((await s.publish(admin,{...req,id:d2.id,hash:d2.hash})).status,409);
 assert.equal((await s.publish(admin,{...req,id:d2.id,hash:d2.hash,effectiveAt:1200})).status,200);
 assert.equal(JSON.stringify(f.published[0]),first);
 const versions=(await s.listPublished(individual,'cgu')).documents;
 assert.deepEqual(versions.map(v=>v.version),[1,2]);assert.equal(versions[0].text,'Version test 1');
 assert.equal(Object.hasOwn(versions[0],'createdBy'),false);assert.equal(Object.hasOwn(versions[0],'id'),false);
 assert.equal(f.audit.length,2);assert.equal(f.audit[0].actorId,'admin');
});
test('Documents : types fermés, CGV conditionnelles et limite de taille',async()=>{
 const f=fixture();
 for(const input of [{type:'unknown',text:'Test'},{type:'cgv',text:'Test'},{type:'cgu',text:' '},{type:'cgu',text:'é'.repeat(131073)}])
  assert.equal((await f.service.draft(admin,input)).status,400);
 assert.equal((await f.service.listPublished(coach,'cgv')).status,400);
 assert.equal((await fixture(true).service.draft(admin,{type:'cgv',text:'Texte de test'})).status,201);
});
test('Documents : refus des données corrompues et erreurs internes sans divulgation',async()=>{
 const f=fixture(),s=f.service,d=await s.draft(admin,{type:'privacy',text:'Texte test confidentialité'});
 await s.publish(admin,{type:'privacy',id:d.id,hash:d.hash,effectiveAt:1100,confirmed:true});
 f.published[0].text='modifié';
 assert.deepEqual(await s.listPublished(coach,'privacy'),{ok:false,status:503});
 const broken=createLegalDocuments({store:{...f.store,readPublished:async()=>{throw Error('secret interne');}}});
 assert.deepEqual(await broken.listPublished(coach,'cgu'),{ok:false,status:503});
 assert.throws(()=>createLegalDocuments({}),TypeError);
});
