'use strict';
const {randomBytes,createCipheriv,createDecipheriv}=require('node:crypto');
const validId=v=>typeof v==='string'&&v.length>0&&v.length<=256;
const validKeyId=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(v);
const aad=(accountId,factorVersion,keyId)=>Buffer.from(JSON.stringify(['JSB','admin-totp','v1',accountId,factorVersion,keyId]),'utf8');
function decode(v,size){
 if(typeof v!=='string'||v.length>256||!/^[A-Za-z0-9_-]+$/.test(v))throw Error('Enveloppe invalide');
 const b=Buffer.from(v,'base64url');
 if(b.length!==size||b.toString('base64url')!==v)throw Error('Enveloppe invalide');
 return b;
}
// Keys are provided by a trusted server-side key manager, never by the client.
// Encryption key must be independent from session, HMAC and database credentials.
// Retain previous key versions during rotation until all envelopes are migrated.
function createMfaVault({activeKeyId,loadKey}={}){
 if(!validKeyId(activeKeyId)||typeof loadKey!=='function')throw new TypeError('Gestionnaire de clés requis');
 async function keyFor(id){
  if(!validKeyId(id))throw Error('Clé invalide');
  const key=await loadKey(id);
  if(!Buffer.isBuffer(key)||key.length!==32)throw Error('Clé indisponible');
  return key;
 }
 function context(accountId,factorVersion){
  if(!validId(accountId)||!validId(factorVersion))throw new TypeError('Contexte MFA invalide');
 }
 async function seal({accountId,factorVersion,secret}={}){
  context(accountId,factorVersion);
  if(!Buffer.isBuffer(secret)||secret.length!==20)throw new TypeError('Secret TOTP invalide');
  const key=await keyFor(activeKeyId),iv=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',key,iv,{authTagLength:16});
  cipher.setAAD(aad(accountId,factorVersion,activeKeyId));
  const data=Buffer.concat([cipher.update(secret),cipher.final()]);
  return Object.freeze({format:'aes-256-gcm-v1',keyId:activeKeyId,iv:iv.toString('base64url'),data:data.toString('base64url'),tag:cipher.getAuthTag().toString('base64url')});
 }
 async function open({accountId,factorVersion,envelope}={}){
  context(accountId,factorVersion);
  try{
   if(!envelope||envelope.format!=='aes-256-gcm-v1'||!validKeyId(envelope.keyId))throw Error('Format invalide');
   const iv=decode(envelope.iv,12),data=decode(envelope.data,20),tag=decode(envelope.tag,16);
   const key=await keyFor(envelope.keyId);
   const decipher=createDecipheriv('aes-256-gcm',key,iv,{authTagLength:16});
   decipher.setAAD(aad(accountId,factorVersion,envelope.keyId));decipher.setAuthTag(tag);
   return Buffer.concat([decipher.update(data),decipher.final()]);
  }catch(_){throw Error('Secret MFA indisponible');}
 }
 return Object.freeze({seal,open});
}
module.exports=Object.freeze({createMfaVault});
