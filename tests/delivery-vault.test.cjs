'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomBytes}=require('node:crypto');
const {createDeliveryVault}=require('../backend/delivery-vault.cjs');
const keys=new Map([['v1',Buffer.alloc(32,7)],['v2',Buffer.alloc(32,8)]]);
const vault=id=>createDeliveryVault({activeKeyId:id,loadKey:async k=>keys.get(k)});
const payload={accountId:'a'.repeat(32),purpose:'email-verification',email:'coach@example.test',token:randomBytes(32).toString('base64url'),expiresAt:20000};
test('Delivery vault: round trip, randomized encryption, no plaintext',async()=>{
 const v=vault('v1'),a=await v.encryptDelivery(payload),b=await v.encryptDelivery(payload);
 assert.notDeepEqual(a,b);
 assert.equal(a.includes(payload.token),false);
 assert.equal(a.includes(payload.email),false);
 assert.deepEqual(await v.decryptDelivery({...payload,encryptedPayload:a}),payload);
});
test('Delivery vault: context substitution and tampering rejected',async()=>{
 const v=vault('v1'),encryptedPayload=await v.encryptDelivery(payload);
 for(const changes of [{accountId:'b'.repeat(32)},{purpose:'password-reset'}]){
  await assert.rejects(v.decryptDelivery({...payload,encryptedPayload,...changes}),/indisponible/);
 }
 const e=JSON.parse(encryptedPayload.toString());
 const bytes=Buffer.from(e.data,'base64url');bytes[0]^=1;e.data=bytes.toString('base64url');
 await assert.rejects(v.decryptDelivery({...payload,encryptedPayload:Buffer.from(JSON.stringify(e))}),/indisponible/);
});
test('Delivery vault: key rotation and missing keys',async()=>{
 const old=await vault('v1').encryptDelivery(payload),current=vault('v2');
 assert.deepEqual(await current.decryptDelivery({...payload,encryptedPayload:old}),payload);
 const fresh=await current.encryptDelivery(payload);
 assert.equal(JSON.parse(fresh.toString()).keyId,'v2');
 const missing=createDeliveryVault({activeKeyId:'v2',loadKey:async()=>undefined});
 await assert.rejects(missing.decryptDelivery({...payload,encryptedPayload:old}),/indisponible/);
 await assert.rejects(missing.encryptDelivery(payload),/indisponible/);
});
test('Delivery vault: invalid payloads and envelopes rejected',async()=>{
 const v=vault('v1');
 for(const patch of [{token:'bad'},{email:'INVALID'},{expiresAt:0},{purpose:'other'},{accountId:'bad'}]){
  await assert.rejects(v.encryptDelivery({...payload,...patch}),/invalide/);
 }
 for(const encryptedPayload of [Buffer.from('not json'),Buffer.alloc(8193),Buffer.from('{}')]){
  await assert.rejects(v.decryptDelivery({...payload,encryptedPayload}),/indisponible/);
 }
});
