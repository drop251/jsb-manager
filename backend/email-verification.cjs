'use strict';
const {createHash}=require('node:crypto');
const invalid=()=>Object.freeze({ok:false,status:400});
// The adapter MUST consume the matching, unexpired token and activate the
// corresponding pending account in a single atomic transaction. It must
// reject suspended/deleted accounts, admin accounts, previously verified
// accounts and tokens issued in the future. No identity comes from the client.
function createEmailVerificationService({consumeAndActivate,limiter,now=Date.now}={}){
 if(typeof consumeAndActivate!=='function'||!limiter||typeof limiter.reserve!=='function'||typeof now!=='function')throw new TypeError('Adaptateurs de vérification requis');
 async function verify(token,sourceId){
  if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))return invalid();
  const hash=createHash('sha256').update(token,'utf8').digest('hex');
  try{
   if(!await limiter.reserve({accountKey:hash,sourceId}))return Object.freeze({ok:false,status:429});
   const time=now();
   if(!Number.isSafeInteger(time)||time<0)throw Error('Horloge invalide');
   const result=await consumeAndActivate({hash,now:time});
   if(result==='activated')return Object.freeze({ok:true,status:200});
   if(result==='invalid')return invalid();
   throw Error('Résultat de stockage invalide');
  }catch(_){return Object.freeze({ok:false,status:503});}
 }
 return Object.freeze({verify});
}
module.exports=Object.freeze({createEmailVerificationService});
