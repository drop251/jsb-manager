'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createMfaVault}=require('../backend/mfa-vault.cjs');
const secret=Buffer.from('12345678901234567890');
const context={accountId:'admin-a',factorVersion:'factor-1'};
const keys=new Map([['key1',Buffer.alloc(32,1)],['key2',Buffer.alloc(32,2)]]);
const vault=id=>createMfaVault({activeKeyId:id,loadKey:async key=>keys.get(key)});
test('Coffre MFA : chiffrement authentifié, nonce distinct, déchiffrement exact',async()=>{
 const v=vault('key1'),a=await v.seal({...context,secret}),b=await v.seal({...context,secret});
 assert.notEqual(a.iv,b.iv);assert.notEqual(a.data,b.data);assert.equal(a.format,'aes-256-gcm-v1');
 assert.ok(!JSON.stringify(a).includes(secret.toString()));assert.ok(!JSON.stringify(a).includes(secret.toString('base64url')));
 assert.deepEqual(await v.open({...context,envelope:a}),secret);
});
test('Coffre MFA : copie entre comptes ou versions et modification du contenu refusées',async()=>{
 const v=vault('key1'),envelope=await v.seal({...context,secret});
 for(const patch of [{accountId:'admin-b'},{factorVersion:'factor-2'}])await assert.rejects(v.open({...context,...patch,envelope}),/Secret MFA indisponible/);
 for(const field of ['iv','data','tag']){
  const bytes=Buffer.from(envelope[field],'base64url');bytes[0]^=1;
  await assert.rejects(v.open({...context,envelope:{...envelope,[field]:bytes.toString('base64url')}}),/Secret MFA indisponible/);
 }
 await assert.rejects(v.open({...context,envelope:{...envelope,keyId:'key2'}}),/Secret MFA indisponible/);
});
test('Coffre MFA : rotation des clés et refus si ancienne clé indisponible',async()=>{
 const old=await vault('key1').seal({...context,secret}),next=vault('key2');
 const rotated=await next.seal({...context,secret:await next.open({...context,envelope:old})});
 assert.equal(rotated.keyId,'key2');assert.deepEqual(await next.open({...context,envelope:rotated}),secret);
 const onlyNew=createMfaVault({activeKeyId:'key2',loadKey:async id=>id==='key2'?keys.get(id):null});
 await assert.rejects(onlyNew.open({...context,envelope:old}),/Secret MFA indisponible/);
});
test('Coffre MFA : configuration et enveloppes invalides refusées',async()=>{
 assert.throws(()=>createMfaVault({}),TypeError);
 const v=vault('key1');
 await assert.rejects(v.seal({...context,secret:Buffer.alloc(19)}),TypeError);
 await assert.rejects(v.open({...context,envelope:null}),/Secret MFA indisponible/);
 await assert.rejects(v.open({...context,envelope:{format:'aes-256-gcm-v1',keyId:'key1',iv:'x',data:'x',tag:'x'}}),/Secret MFA indisponible/);
});
