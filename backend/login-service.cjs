'use strict';
const {verifyPassword,validPassword}=require('./passwords.cjs');
// sourceId must be established by the trusted HTTP transport.
// findAccountByEmail and verifyMfa must be server-side adapters.
// No route may accept a client-supplied proof or role as trusted.
const failure=()=>Object.freeze({ok:false,status:401});
function normalizeEmail(value){
 if(typeof value!=='string'||value.length>320)return null;
 const email=value.trim().toLowerCase();
 return email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?email:null;
}
function createLoginService({limiter,sessions,findAccountByEmail,verifyMfa,verifyRecovery=async()=>false,checkPassword=verifyPassword}={}){
 if(!limiter||typeof limiter.reserve!=='function'||!sessions||typeof sessions.issue!=='function'||typeof findAccountByEmail!=='function'||typeof verifyMfa!=='function'||typeof verifyRecovery!=='function'||typeof checkPassword!=='function')throw new TypeError('Adaptateurs de connexion requis');
 async function login({email,password,sourceId,mfaCode}={}){
  const key=normalizeEmail(email);
  if(!key||!validPassword(password))return failure();
  try{
   if(!await limiter.reserve({accountKey:key,sourceId}))return Object.freeze({ok:false,status:429});
   const account=await findAccountByEmail(key);
   const match=await checkPassword(password,account?account.passwordHash:null);
   if(!match||!account||account.status!=='active'||account.emailVerified!==true||!['admin','coach','individual'].includes(account.role)||typeof account.id!=='string'||!account.id.trim())return failure();
   let mfaVerified=false;
   if(account.role==='admin'){
    if(typeof mfaCode!=='string'||!mfaCode||mfaCode.length>128)return failure();
    mfaVerified=(/^[A-Fa-f0-9]{8}(?:-[A-Fa-f0-9]{8}){3}$/.test(mfaCode)?await verifyRecovery(account.id,mfaCode):await verifyMfa(account.id,mfaCode))===true;
    if(!mfaVerified)return failure();
   }
   const session=await sessions.issue({accountId:account.id,credentialVerified:true,mfaVerified,...(account.credentialVersion===undefined?{}:{credentialVersion:account.credentialVersion,roleAtVerification:account.role})});
   if(!session)return failure();
   return Object.freeze({ok:true,status:200,token:session.token,expiresAt:session.expiresAt});
  }catch(_){return Object.freeze({ok:false,status:503});}
 }
 return Object.freeze({login});
}
module.exports=Object.freeze({createLoginService,normalizeEmail});
