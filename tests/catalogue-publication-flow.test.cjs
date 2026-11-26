'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createPublicationFlow}=require('../backend/catalogue-publication-flow.cjs');
const {CONTRACTS,CONTRACT_VERSION}=require('../core/catalogue-workbook-contract.cjs');
const actor={id:'fixture-admin',role:'admin',status:'active',authenticated:true};
const session='a'.repeat(64),otherSession='b'.repeat(64);
function fixture(){
 const record=Object.fromEntries(CONTRACTS.taiso.map(([,key])=>[key,'Fixture '+key]));
 Object.assign(record,{reference:'JSB-TAISO-FIXTURE-1',discipline:'Taïso',sheetType:'Exercice',level:'Intermédiaire',subgroup:'Gym douce',dosageMode:'Répétitions',repetitions:'8',effortSeconds:null,tagsText:null,restrictions:null});
 const {reference,name,family,discipline,...values}=record;
 return {discipline:'taiso',version:'fixture-v1',exercises:[{reference,name,family,details:{contractVersion:CONTRACT_VERSION,...Object.fromEntries(Object.entries(values).filter(([,v])=>v!==null))}}]};
}
test('Confirmation administrative : intégrité, session, expiration et validation explicite',async()=>{
 let time=1000000,existing=false;
 const calls=[];
 const pool={query:async sql=>sql.includes('current_release')?{rows:[{version:'previous'}],rowCount:1}:{rows:existing?[{}]:[],rowCount:existing?1:0}};
 const flow=createPublicationFlow({pool,key:Buffer.alloc(32,7),now:()=>time,publisher:{publish:async(...args)=>{calls.push(args);return {ok:true,status:200};}}});
 const canonical=fixture();
 const draft=await flow.prepare(actor,session,canonical);
 assert.ok(draft);assert.equal(draft.previousVersion,'previous');
 const body={receipt:draft.receipt,canonical,confirmed:true,confirmationVersion:'fixture-v1'};
 assert.equal((await flow.publish({...actor,role:'coach'},session,body)).status,403);
 assert.equal((await flow.publish(actor,otherSession,body)).status,409);
 assert.equal((await flow.publish({...actor,id:'other'},session,body)).status,409);
 assert.equal((await flow.publish(actor,session,{...body,receipt:body.receipt+'.x'})).status,409);
 assert.equal((await flow.publish(actor,session,{...body,confirmed:false})).status,400);
 assert.equal((await flow.publish(actor,session,{...body,confirmationVersion:'wrong'})).status,400);
 const changed=fixture();changed.exercises[0].name='Changed';
 assert.equal((await flow.publish(actor,session,{...body,canonical:changed})).status,409);
 assert.equal(calls.length,0);
 assert.equal((await flow.publish(actor,session,body)).status,200);
 assert.equal(calls.length,1);assert.equal(calls[0][2].expectedPreviousVersion,'previous');
 time=draft.expiresAt;
 assert.equal((await flow.publish(actor,session,body)).status,409);
 existing=true;assert.equal(await flow.prepare(actor,session,canonical),null);
 const old=fixture();delete old.exercises[0].details.contractVersion;
 assert.equal(await flow.prepare(actor,session,old),null);
});
