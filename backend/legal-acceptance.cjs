'use strict';
const {authorize}=require('../core/platform-permissions.cjs');
const result=(ok,status)=>Object.freeze({ok,status});
const validHash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
// CGU acceptance and privacy notice acknowledgement are different events.
// Neither event constitutes consent to optional personal data processing.
// CGV acceptance belongs to a future commercial transaction, not signup.
// The actor is resolved by trusted server authentication, never request JSON.
// recordCurrent atomically rechecks active account, exact published version/hash,
// current effective date and kind, then appends an immutable, idempotent record.
// An identical repeat preserves the first server timestamp. A stale version
// returns conflict; no user may alter another user's acceptance.
// readOwn must query only the given accountId and omit internal audit details.
function createLegalAcceptance({store,now=Date.now}={}){
 if(!store||typeof store.recordCurrent!=='function'||typeof store.readOwn!=='function'||typeof now!=='function')throw new TypeError('Adaptateurs d’acceptation requis');
 const kindFor=type=>type==='cgu'?'acceptance':type==='privacy'?'acknowledgement':null;
 function time(){const t=now();if(!Number.isSafeInteger(t)||t<0)throw Error('Horloge invalide');return t;}
 async function record(actor,input){
  if(!authorize(actor,'legalAcceptance','write',{ownerId:actor&&actor.id}))return result(false,403);
  if(!input||!kindFor(input.type)||input.kind!==kindFor(input.type)||input.confirmed!==true||!Number.isSafeInteger(input.version)||input.version<1||!validHash(input.hash))return result(false,400);
  try{
   const outcome=await store.recordCurrent({accountId:actor.id,type:input.type,kind:kindFor(input.type),version:input.version,hash:input.hash,recordedAt:time()});
   if(outcome==='recorded'||outcome==='already-recorded')return result(true,200);
   if(outcome==='conflict')return result(false,409);
   if(outcome==='forbidden')return result(false,403);
   throw Error('Résultat invalide');
  }catch(_){return result(false,503);}
 }
 async function history(actor){
  if(!authorize(actor,'legalAcceptance','read',{ownerId:actor&&actor.id}))return result(false,403);
  try{
   const records=await store.readOwn(actor.id);
   if(!Array.isArray(records))throw Error('Résultat invalide');
   const projected=records.map(r=>{
    if(!r||r.accountId!==actor.id||!kindFor(r.type)||r.kind!==kindFor(r.type)||!Number.isSafeInteger(r.version)||r.version<1||!validHash(r.hash)||!Number.isSafeInteger(r.recordedAt)||r.recordedAt<0)throw Error('Enregistrement invalide');
    return Object.freeze({type:r.type,kind:r.kind,version:r.version,hash:r.hash,recordedAt:r.recordedAt});
   });
   return Object.freeze({ok:true,status:200,records:Object.freeze(projected)});
  }catch(_){return result(false,503);}
 }
 return Object.freeze({record,history});
}
module.exports=Object.freeze({createLegalAcceptance});
