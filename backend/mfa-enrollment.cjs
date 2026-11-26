'use strict';
const {randomBytes,timingSafeEqual}=require('node:crypto');
const {generateSecret,provisioningUri,codeForStep}=require('./admin-mfa.cjs');
const result=(ok,status)=>Object.freeze({ok,status});
// resolveGrant verifies an out-of-band, short-lived, single-account enrollment
// grant issued after identity verification. It must reject public login tokens.
// savePending atomically checks grant, active verified admin, no enabled factor,
// and creates one pending factor, replacing only that grant's previous candidate.
// activate atomically rechecks grant, account and pending version/expiry, consumes
// grant, enables factor, records first accepted step, revokes existing sessions.
// Neither adapter may expose secret envelopes or grants to other accounts.
function createMfaEnrollment({resolveGrant,savePending,loadPending,activate,vault,limiter,now=Date.now,ttlMs=10*60*1000}={}){
 if(![resolveGrant,savePending,loadPending,activate,now].every(f=>typeof f==='function')||!vault||typeof vault.seal!=='function'||typeof vault.open!=='function'||!limiter||typeof limiter.reserve!=='function')throw new TypeError('Adaptateurs MFA requis');
 if(!Number.isSafeInteger(ttlMs)||ttlMs<=0||ttlMs>1800000)throw new RangeError('Durée invalide');
 const tokenValid=t=>typeof t==='string'&&/^[A-Za-z0-9_-]{43}$/.test(t);
 function time(){const t=now();if(!Number.isSafeInteger(t)||t<0)throw Error('Horloge invalide');return t;}
 function validGrant(g,t){return g&&typeof g.id==='string'&&g.id&&typeof g.accountId==='string'&&g.accountId&&typeof g.email==='string'&&g.email.trim()&&g.role==='admin'&&g.status==='active'&&g.emailVerified===true&&g.purpose==='admin-mfa-enrollment'&&Number.isSafeInteger(g.expiresAt)&&g.expiresAt>t;}
 async function begin(token,sourceId){
  if(!tokenValid(token))return result(false,401);
  try{
   const t=time(),grant=await resolveGrant(token);
   if(!validGrant(grant,t))return result(false,401);
   if(!await limiter.reserve({accountKey:grant.accountId,sourceId}))return result(false,429);
   const factorVersion=randomBytes(16).toString('hex'),secret=generateSecret();
   try{
    const expiresAt=Math.min(t+ttlMs,grant.expiresAt);
    const envelope=await vault.seal({accountId:grant.accountId,factorVersion,secret});
    if(await savePending({grantId:grant.id,accountId:grant.accountId,factorVersion,envelope,expiresAt,now:t})!==true)return result(false,403);
    return Object.freeze({ok:true,status:200,uri:provisioningUri(secret,grant.email),expiresAt});
   }finally{secret.fill(0);}
  }catch(_){return result(false,503);}
 }
 async function confirm(token,code,sourceId){
  if(!tokenValid(token)||typeof code!=='string'||!/^\d{6}$/.test(code))return result(false,400);
  try{
   const t=time(),grant=await resolveGrant(token);
   if(!validGrant(grant,t))return result(false,401);
   if(!await limiter.reserve({accountKey:grant.accountId,sourceId}))return result(false,429);
   const p=await loadPending({grantId:grant.id,accountId:grant.accountId});
   if(!p||typeof p.factorVersion!=='string'||!Number.isSafeInteger(p.expiresAt)||p.expiresAt<=t)return result(false,400);
   const secret=await vault.open({accountId:grant.accountId,factorVersion:p.factorVersion,envelope:p.envelope});
   let matched=-1;
   try{
    const current=Math.floor(t/30000),input=Buffer.from(code);
    for(const step of [current-1,current,current+1])if(step>=0&&timingSafeEqual(input,Buffer.from(codeForStep(secret,step))))matched=Math.max(matched,step);
   }finally{secret.fill(0);}
   if(matched<0)return result(false,400);
   return await activate({grantId:grant.id,accountId:grant.accountId,factorVersion:p.factorVersion,step:matched,now:time()})===true?result(true,200):result(false,400);
  }catch(_){return result(false,503);}
 }
 return Object.freeze({begin,confirm});
}
module.exports=Object.freeze({createMfaEnrollment});
