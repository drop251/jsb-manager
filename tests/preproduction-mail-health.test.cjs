'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readDeliveryHealth}=require('../backend/preproduction-mail-health.cjs');
test('Diagnostic messagerie : lecture seule et quatre compteurs anonymes',async()=>{
 const queries=[];
 const pool={query:async sql=>{queries.push(sql);return {rows:[queries.length===1?{name:'jsb_preprod'}:{ready:'2',processing:'1',delayed:'3',discardable:'4',unexpected:'ignored'}]};}};
 assert.deepEqual(await readDeliveryHealth(pool),{ready:2,processing:1,delayed:3,discardable:4});
 assert.equal(queries.length,2);
 for(const sql of queries)assert.match(sql,/^(SELECT|WITH)\b/);
 assert.doesNotMatch(queries[1],/encrypted_payload|account_id|email|lease_id/);
});
test('Diagnostic messagerie : refus de la mauvaise base et des compteurs incohérents',async()=>{
 let calls=0;
 await assert.rejects(readDeliveryHealth({query:async()=>{calls++;return {rows:[{name:'jsb_ci'}]};}}),/Base de préproduction/);
 assert.equal(calls,1);
 await assert.rejects(readDeliveryHealth({query:async sql=>({rows:[sql.includes('current_database')?{name:'jsb_preprod'}:{ready:'-1'}]})}),/Compteurs indisponibles/);
});
