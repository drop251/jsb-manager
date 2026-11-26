'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createResendTransport}=require('../backend/resend-transport.cjs');
test('Transport transactionnel : requêtes simulées, délai et clé de déduplication',async()=>{
 const requests=[];
 const transport=createResendTransport({apiKey:'fixture-not-a-real-key',from:'sender@example.test',namespace:'fixture-environment-01',fetchImpl:async(url,options)=>{
  requests.push({url,options});return new Response(JSON.stringify({id:'simulated-message'}),{status:200});
 }});
 const message={deliveryId:'jsb-auth-v1-42',to:'recipient@example.test',subject:'Message de recette',text:'Contenu fictif.'};
 assert.equal(await transport(message),true);
 assert.equal(await transport(message),true);
 assert.equal(requests[0].url,'https://api.resend.com/emails');
 assert.equal(requests[0].options.redirect,'error');
 assert.ok(requests[0].options.signal instanceof AbortSignal);
 assert.equal(requests[0].options.headers['Idempotency-Key'],requests[1].options.headers['Idempotency-Key']);
 assert.deepEqual(JSON.parse(requests[0].options.body).to,[message.to]);
 assert.equal(await transport({...message,to:'invalid-address'}),false);
 assert.equal(requests.length,2);
});
test('Transport : erreur distante ou réponse incomplète',async()=>{
 for(const fetchImpl of [async()=>{throw Error('simulated failure');},async()=>new Response('{}',{status:429}),async()=>new Response('{}',{status:200})]){
  const transport=createResendTransport({apiKey:'fixture-not-a-real-key',from:'sender@example.test',namespace:'fixture-environment-01',fetchImpl});
  assert.equal(await transport({deliveryId:'jsb-auth-v1-1',to:'recipient@example.test',subject:'Recette',text:'Fixture'}),false);
 }
});
