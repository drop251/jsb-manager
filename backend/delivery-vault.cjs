'use strict';
const {randomBytes,createCipheriv,createDecipheriv}=require('node:crypto');
const {normalizeEmail}=require('./login-service.cjs');
const keyIdOk=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(v);
const contextOk=(id,purpose)=>typeof id==='string'&&/^[a-f0-9]{32}$/.test(id)&&['email-verification','password-reset'].includes(purpose);
const aad=(id,purpose,keyId)=>Buffer.from(JSON.stringify(['JSB','delivery','v1',id,purpose,keyId]));
function decode(s,min,max){
 if(typeof s!=='string'||s.length>4096||!/^[A-Za-z0-9_-]+$/.test(s))throw Error('Enveloppe invalide');
 const b=Buffer.from(s,'base64url');
 if(b.length<min||b.length>max||b.toString('base64url')!==s)throw Error('Enveloppe invalide');
 return b;
}
function validPayload(p){
 return p&&typeof p.email==='string'&&normalizeEmail(p.email)===p.email&&typeof p.token==='string'&&/^[A-Za-z0-9_-]{43}$/.test(p.token)&&Number.isSafeInteger(p.expiresAt)&&p.expiresAt>0;
}
// Use a dedicated server-managed key, independent of MFA and rate-limit keys.
// Never log plaintext or return it to clients. Keep old key versions until expiry.
function createDeliveryVault({activeKeyId,loadKey}={}){
 if(!keyIdOk(activeKeyId)||typeof loadKey!=='function')throw TypeError('Gestionnaire de clés requis');
 async function keyFor(id){
  if(!keyIdOk(id))throw Error('Clé invalide');
  const k=await loadKey(id);if(!Buffer.isBuffer(k)||k.length!==32)throw Error('Clé indisponible');return k;
 }
 async function encryptDelivery({accountId,purpose,email,token,expiresAt}={}){
  const p={email,token,expiresAt};
  if(!contextOk(accountId,purpose)||!validPayload(p))throw Error('Livraison invalide');
  const key=await keyFor(activeKeyId),iv=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',key,iv,{authTagLength:16});
  cipher.setAAD(aad(accountId,purpose,activeKeyId));
  const ciphertext=Buffer.concat([cipher.update(JSON.stringify(p),'utf8'),cipher.final()]);
  return Buffer.from(JSON.stringify({format:'aes-256-gcm-v1',keyId:activeKeyId,iv:iv.toString('base64url'),data:ciphertext.toString('base64url'),tag:cipher.getAuthTag().toString('base64url')}));
 }
 async function decryptDelivery({accountId,purpose,encryptedPayload}={}){
  try{
   if(!contextOk(accountId,purpose)||!Buffer.isBuffer(encryptedPayload)||encryptedPayload.length>8192)throw Error('Livraison invalide');
   const e=JSON.parse(encryptedPayload.toString('utf8'));
   if(!e||e.format!=='aes-256-gcm-v1'||!keyIdOk(e.keyId))throw Error('Enveloppe invalide');
   const key=await keyFor(e.keyId),iv=decode(e.iv,12,12),data=decode(e.data,1,2048),tag=decode(e.tag,16,16);
   const decipher=createDecipheriv('aes-256-gcm',key,iv,{authTagLength:16});
   decipher.setAAD(aad(accountId,purpose,e.keyId));decipher.setAuthTag(tag);
   const p=JSON.parse(Buffer.concat([decipher.update(data),decipher.final()]).toString('utf8'));
   if(!validPayload(p))throw Error('Livraison invalide');
   return Object.freeze({accountId,purpose,email:p.email,token:p.token,expiresAt:p.expiresAt});
  }catch(_){throw Error('Livraison chiffrée indisponible');}
 }
 return Object.freeze({encryptDelivery,decryptDelivery});
}
module.exports=Object.freeze({createDeliveryVault});
