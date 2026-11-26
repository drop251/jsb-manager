'use strict';
const {randomBytes,createHmac}=require('node:crypto');
const validId=v=>typeof v==='string'&&v.length>0&&v.length<=256;
const validCode=v=>typeof v==='string'&&/^[A-Fa-f0-9]{8}-[A-Fa-f0-9]{8}-[A-Fa-f0-9]{8}-[A-Fa-f0-9]{8}$/.test(v);
// Independent server-only HMAC key. Never store or log plaintext recovery codes.
// Provisioning requires a fresh, trusted password + TOTP proof, not a public
// session or recovery-code proof. The storage adapter must atomically consume
// the proof, check active verified admin and factor version, replace all hashes.
// consumeCode must atomically check active admin, enabled factor and version,
// remove exactly one matching hash, and return true only on successful removal.
// This verifier is a second factor only; the login service must first verify
// password and apply quotas. No standalone account recovery endpoint.
function createAdminRecovery({secret,resolveProof,replaceCodes,loadFactor,consumeCode,limiter,now=Date.now}={}){
 if(!Buffer.isBuffer(secret)||secret.length<32||![resolveProof,replaceCodes,loadFactor,consumeCode,now].every(f=>typeof f==='function')||!limiter||typeof limiter.reserve!=='function')throw new TypeError('Adaptateurs de secours requis');
 const key=Buffer.from(secret);
 const digest=(id,version,code)=>createHmac('sha256',key).update(JSON.stringify(['jsb-admin-recovery-v1',id,version,code.toUpperCase()])).digest('hex');
 function time(){const t=now();if(!Number.isSafeInteger(t)||t<0)throw Error('Horloge invalide');return t;}
 async function provision(proofToken,sourceId){
  if(typeof proofToken!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(proofToken))return Object.freeze({ok:false,status:401});
  try{
   const t=time(),p=await resolveProof(proofToken);
   if(!p||!validId(p.id)||!validId(p.accountId)||!validId(p.factorVersion)||p.role!=='admin'||p.status!=='active'||p.emailVerified!==true||p.purpose!=='admin-recovery-provision'||p.passwordVerified!==true||p.totpVerified!==true||!Number.isSafeInteger(p.issuedAt)||p.issuedAt>t||t-p.issuedAt>300000||!Number.isSafeInteger(p.expiresAt)||p.expiresAt<=t)return Object.freeze({ok:false,status:401});
   if(!await limiter.reserve({accountKey:p.accountId,sourceId}))return Object.freeze({ok:false,status:429});
   const codes=Array.from({length:10},()=>randomBytes(16).toString('hex').toUpperCase().match(/.{8}/g).join('-'));
   const hashes=codes.map(c=>digest(p.accountId,p.factorVersion,c));
   if(new Set(hashes).size!==10)throw Error('Collision');
   if(await replaceCodes({proofId:p.id,accountId:p.accountId,factorVersion:p.factorVersion,hashes,now:time()})!==true)return Object.freeze({ok:false,status:403});
   return Object.freeze({ok:true,status:200,codes:Object.freeze(codes)});
  }catch(_){return Object.freeze({ok:false,status:503});}
 }
 async function verifyRecovery(accountId,code){
  if(!validId(accountId)||!validCode(code))return false;
  const f=await loadFactor(accountId);
  if(!f||f.enabled!==true||!validId(f.version))return false;
  return (await consumeCode({accountId,factorVersion:f.version,hash:digest(accountId,f.version,code),now:time()}))===true;
 }
 return Object.freeze({provision,verifyRecovery});
}
module.exports=Object.freeze({createAdminRecovery});
