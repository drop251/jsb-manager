'use strict';
const {randomBytes,createHash}=require('node:crypto');
const {normalizeEmail}=require('./login-service.cjs');
const {validPassword,hashPassword}=require('./passwords.cjs');
const ROLES=new Set(['coach','individual']);
const accepted=()=>Object.freeze({ok:true,status:202});
const rejected=()=>Object.freeze({ok:false,status:400});
const digest=token=>createHash('sha256').update(token,'utf8').digest('hex');
// Server adapters: createPendingAccount atomically enforces unique normalized
// email and persists account, verification hash and delivery outbox together.
// Only the outbox may temporarily hold the raw verification token; encrypt
// it at rest, restrict worker access and erase it after delivery/expiry.
// Never update an existing account through a duplicate registration.
function createRegistrationService({limiter,createPendingAccount,now=Date.now,verificationTtlMs=30*60*1000}={}){
 if(!limiter||typeof limiter.reserve!=='function'||typeof createPendingAccount!=='function'||typeof now!=='function')throw new TypeError('Adaptateurs d’inscription requis');
 if(!Number.isSafeInteger(verificationTtlMs)||verificationTtlMs<=0||verificationTtlMs>86400000)throw new RangeError('Durée invalide');
 async function register(input,sourceId){
  if(!input||typeof input!=='object')return rejected();
  const {email,password,role}=input,key=normalizeEmail(email);
  if(!key||!validPassword(password)||!ROLES.has(role))return rejected();
  try{
   if(!await limiter.reserve({accountKey:key,sourceId}))return Object.freeze({ok:false,status:429});
   const passwordHash=await hashPassword(password),token=randomBytes(32).toString('base64url');
   const issuedAt=now();
   if(!Number.isSafeInteger(issuedAt)||issuedAt<0||!Number.isSafeInteger(issuedAt+verificationTtlMs))throw Error('Horloge invalide');
   const id=randomBytes(16).toString('hex');
   const result=await createPendingAccount({
    account:{id,email:key,passwordHash,role,status:'pending',emailVerified:false,clubIds:[]},
    verification:{accountId:id,hash:digest(token),issuedAt,expiresAt:issuedAt+verificationTtlMs},
    delivery:{accountId:id,email:key,token,expiresAt:issuedAt+verificationTtlMs}
   });
   if(result!=='created'&&result!=='duplicate')throw Error('Résultat de stockage invalide');
   return accepted();
  }catch(_){return Object.freeze({ok:false,status:503});}
 }
 return Object.freeze({register});
}
module.exports=Object.freeze({createRegistrationService});
