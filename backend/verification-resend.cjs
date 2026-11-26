'use strict';
const {randomBytes,createHash}=require('node:crypto');
const {normalizeEmail}=require('./login-service.cjs');
// replacePendingVerification atomically checks eligibility, invalidates prior
// verification tokens, and writes the replacement token and delivery outbox.
// Only pending, unverified coach/individual accounts are eligible.
// The encrypted outbox is accessible only to its delivery worker.
function createVerificationResend({limiter,replacePendingVerification,now=Date.now,ttlMs=30*60*1000}={}){
 if(!limiter||typeof limiter.reserve!=='function'||typeof replacePendingVerification!=='function'||typeof now!=='function')throw new TypeError('Adaptateurs requis');
 if(!Number.isSafeInteger(ttlMs)||ttlMs<=0||ttlMs>86400000)throw new RangeError('Durée invalide');
 async function resend(email,sourceId){
  const key=normalizeEmail(email);
  if(!key)return Object.freeze({ok:false,status:400});
  try{
   if(!await limiter.reserve({accountKey:key,sourceId}))return Object.freeze({ok:false,status:429});
   const issuedAt=now(),expiresAt=issuedAt+ttlMs;
   if(!Number.isSafeInteger(issuedAt)||issuedAt<0||!Number.isSafeInteger(expiresAt))throw Error('Horloge invalide');
   const token=randomBytes(32).toString('base64url');
   const hash=createHash('sha256').update(token,'utf8').digest('hex');
   const result=await replacePendingVerification({email:key,verification:{hash,issuedAt,expiresAt},delivery:{email:key,token,expiresAt}});
   if(result!=='replaced'&&result!=='ineligible')throw Error('Résultat de stockage invalide');
   return Object.freeze({ok:true,status:202});
  }catch(_){return Object.freeze({ok:false,status:503});}
 }
 return Object.freeze({resend});
}
module.exports=Object.freeze({createVerificationResend});
