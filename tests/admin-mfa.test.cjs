'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {generateSecret,provisioningUri,codeForStep,createAdminMfa}=require('../backend/admin-mfa.cjs');
const secret=Buffer.from('12345678901234567890');
function fixture(){
 let time=300000,last=-1,active=true,version='v1',enabled=true;
 const service=createAdminMfa({now:()=>time,loadFactor:async id=>id==='admin'?{secret,version,enabled}:null,consumeStep:async r=>{
  if(!active||r.accountId!=='admin'||r.version!==version||r.step<=last)return false;
  last=r.step;return true;
 }});
 return {service,advance:n=>time+=n,disable:()=>enabled=false,suspend:()=>active=false};
}
test('TOTP : vecteurs RFC 6238 SHA1 ramenés à six chiffres',()=>{
 for(const [seconds,code] of [[59,'287082'],[1111111109,'081804'],[1111111111,'050471'],[1234567890,'005924'],[2000000000,'279037'],[20000000000,'353130']])
  assert.equal(codeForStep(secret,Math.floor(seconds/30)),code);
});
test('TOTP : génération et URI de configuration standard',()=>{
 const a=generateSecret(),b=generateSecret();assert.equal(a.length,20);assert.notDeepEqual(a,b);
 const uri=new URL(provisioningUri(secret,'admin@example.test'));
 assert.equal(uri.protocol,'otpauth:');assert.equal(uri.searchParams.get('secret'),'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');assert.equal(uri.searchParams.get('period'),'30');
 assert.throws(()=>provisioningUri(Buffer.alloc(1),'admin'),TypeError);
});
test('TOTP : code accepté une seule fois même en concurrence',async()=>{
 const {service,advance}=fixture();
 const code=codeForStep(secret,10);
 const results=await Promise.all(Array.from({length:5},()=>service.verifyMfa('admin',code)));
 assert.equal(results.filter(Boolean).length,1);
 assert.equal(await service.verifyMfa('admin',code),false);
 advance(30000);assert.equal(await service.verifyMfa('admin',codeForStep(secret,11)),true);
});
test('TOTP : fenêtre de tolérance limitée et refus des codes invalides',async()=>{
 const {service}=fixture();
 for(const code of [null,'12345','abcdef',codeForStep(secret,7),codeForStep(secret,13)])assert.equal(await service.verifyMfa('admin',code),false);
 assert.equal(await service.verifyMfa('unknown',codeForStep(secret,10)),false);
 assert.equal(await service.verifyMfa('admin',codeForStep(secret,9)),true);
 assert.equal(await service.verifyMfa('admin',codeForStep(secret,11)),true);
 assert.equal(await service.verifyMfa('admin',codeForStep(secret,10)),false);
});
test('TOTP : facteur désactivé, compte suspendu et changement de version refusés',async()=>{
 const a=fixture();a.disable();assert.equal(await a.service.verifyMfa('admin',codeForStep(secret,10)),false);
 const b=fixture();b.suspend();assert.equal(await b.service.verifyMfa('admin',codeForStep(secret,10)),false);
 const rotated=createAdminMfa({now:()=>300000,loadFactor:async()=>({secret,enabled:true,version:'old'}),consumeStep:async r=>r.version==='new'});
 assert.equal(await rotated.verifyMfa('admin',codeForStep(secret,10)),false);
});
