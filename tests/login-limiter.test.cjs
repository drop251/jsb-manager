'use strict';
const {createLoginLimiter}=require('../backend/login-limiter.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
function fixture(){
 let time=1000;const entries=new Map();
 const store={async reserve(quotas,now,window){
  const lists=quotas.map(q=>(entries.get(q.key)||[]).filter(t=>t>now-window));
  if(quotas.some((q,i)=>lists[i].length>=q.limit))return false;
  quotas.forEach((q,i)=>entries.set(q.key,[...lists[i],now]));return true;
 }};
 const limiter=createLoginLimiter({store,secret:Buffer.alloc(32,1),now:()=>time,windowMs:100,accountLimit:2,sourceLimit:3});
 return {limiter,entries,advance:n=>time+=n};
}
test('Limitation : même compte depuis plusieurs sources',async()=>{
 const {limiter,advance}=fixture();
 assert.equal(await limiter.reserve({accountKey:'coach@example.test',sourceId:'source-a'}),true);
 assert.equal(await limiter.reserve({accountKey:'coach@example.test',sourceId:'source-b'}),true);
 assert.equal(await limiter.reserve({accountKey:'coach@example.test',sourceId:'source-c'}),false);
 advance(100);
 assert.equal(await limiter.reserve({accountKey:'coach@example.test',sourceId:'source-c'}),true);
});
test('Limitation : même source avec plusieurs comptes',async()=>{
 const {limiter,entries}=fixture();
 for(const accountKey of ['coach','particulier','admin'])assert.equal(await limiter.reserve({accountKey,sourceId:'source-a'}),true);
 assert.equal(await limiter.reserve({accountKey:'autre',sourceId:'source-a'}),false);
 assert.equal(await limiter.reserve({accountKey:'autre',sourceId:'source-b'}),true);
 for(const key of entries.keys())assert.match(key,/^[a-f0-9]{64}$/);
});
test('Limitation : réservations concurrentes bornées',async()=>{
 const {limiter}=fixture();
 const results=await Promise.all(Array.from({length:20},()=>limiter.reserve({accountKey:'coach',sourceId:'source-a'})));
 assert.equal(results.filter(Boolean).length,2);
});
test('Limitation : refus si stockage indisponible ou entrées invalides',async()=>{
 const {limiter}=fixture();
 for(const request of [{},{accountKey:'a',sourceId:''},{accountKey:'a'.repeat(321),sourceId:'b'}])assert.equal(await limiter.reserve(request),false);
 const broken=createLoginLimiter({store:{reserve:async()=>{throw Error('offline');}},secret:Buffer.alloc(32)});
 assert.equal(await broken.reserve({accountKey:'a',sourceId:'b'}),false);
 assert.throws(()=>createLoginLimiter({}),TypeError);
});
