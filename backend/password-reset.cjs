'use strict';
const {randomBytes,createHash}=require('node:crypto');
const {normalizeEmail}=require('./login-service.cjs');
const {validPassword,hashPassword}=require('./passwords.cjs');
const digest=token=>createHash('sha256').update(token,'utf8').digest('hex');
const response=(ok,status)=>Object.freeze({ok,status});
// All adapters are trusted server-side. The request adapter must restrict
// eligibility to active, email-verified coach/individual accounts, atomically
// replace prior reset tokens and enqueue encrypted delivery. The confirmation
// adapter MUST atomically check token purpose, expiry and eligibility, consume
// all reset tokens, replace the password and revoke every session of the account.
// Reset tokens must use a separate namespace from verification tokens.
function createPasswordResetService({requestLimiter,confirmLimiter,replaceReset,consumeResetAndRevoke,now=Date.now,ttlMs=15*60*1000}={}){
 if(!requestLimiter||typeof requestLimiter.reserve!=='function'||!confirmLimiter||typeof confirmLimiter.reserve!=='function'||typeof replaceReset!=='function'||typeof consumeResetAndRevoke!=='function'||typeof now!=='function')throw new TypeError('Adaptateurs de récupération requis');
 if(!Number.isSafeInteger(ttlMs)||ttlMs<=0||ttlMs>3600000)throw new RangeError('Durée invalide');
 function time(){const value=now();if(!Number.isSafeInteger(value)||value<0)throw Error('Horloge invalide');return value;}
 async function request(email,sourceId){
  const key=normalizeEmail(email);
  if(!key)return response(false,400);
  try{
   if(!await requestLimiter.reserve({accountKey:key,sourceId}))return response(false,429);
   const issuedAt=time(),expiresAt=issuedAt+ttlMs;
   if(!Number.isSafeInteger(expiresAt))throw Error('Horloge invalide');
   const token=randomBytes(32).toString('base64url');
   const result=await replaceReset({email:key,reset:{hash:digest(token),issuedAt,expiresAt,purpose:'password-reset'},delivery:{email:key,token,expiresAt,purpose:'password-reset'}});
   if(result!=='created'&&result!=='ineligible')throw Error('Résultat de stockage invalide');
   return response(true,202);
  }catch(_){return response(false,503);}
 }
 async function confirm({token,password}={},sourceId){
  if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token)||!validPassword(password))return response(false,400);
  try{
   const hash=digest(token);
   if(!await confirmLimiter.reserve({accountKey:hash,sourceId}))return response(false,429);
   const passwordHash=await hashPassword(password);
   const result=await consumeResetAndRevoke({hash,purpose:'password-reset',now:time(),passwordHash});
   if(result==='updated')return response(true,200);
   if(result==='invalid')return response(false,400);
   throw Error('Résultat de stockage invalide');
  }catch(_){return response(false,503);}
 }
 return Object.freeze({request,confirm});
}
module.exports=Object.freeze({createPasswordResetService});
