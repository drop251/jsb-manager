'use strict';
const {randomBytes,createHash}=require('node:crypto');
const {authorize}=require('../core/platform-permissions.cjs');
const TYPES=new Set(['cgu','cgv','privacy']);
const result=(ok,status)=>Object.freeze({ok,status});
const hashText=text=>createHash('sha256').update(text,'utf8').digest('hex');
const validId=id=>typeof id==='string'&&/^[a-f0-9]{32}$/.test(id);
// actor is established exclusively by the authenticated server request guard.
// Storage must recheck admin identity and authorization transactionally for writes.
// Drafts are immutable candidates: editing creates a new candidate.
// publishDraft must atomically compare draft id + hash, assign a unique monotonic
// version per type, preserve all published versions, prevent overlapping effective
// dates and audit the actor. The published copy must never be edited or deleted.
// readPublished must return published documents only, not drafts or audit metadata.
function createLegalDocuments({store,now=Date.now,commercialEnabled=false}={}){
 if(!store||!['createDraft','publishDraft','readPublished','readDrafts'].every(k=>typeof store[k]==='function')||typeof now!=='function'||typeof commercialEnabled!=='boolean')throw new TypeError('Adaptateurs documentaires requis');
 const typeAllowed=t=>TYPES.has(t)&&(t!=='cgv'||commercialEnabled);
 function time(){const t=now();if(!Number.isSafeInteger(t)||t<0)throw Error('Horloge invalide');return t;}
 async function draft(actor,input){
  if(!authorize(actor,'legal','draft'))return result(false,403);
  if(!input||!typeAllowed(input.type)||typeof input.text!=='string'||!input.text.trim()||Buffer.byteLength(input.text,'utf8')>262144)return result(false,400);
  try{
   const document={id:randomBytes(16).toString('hex'),type:input.type,text:input.text,hash:hashText(input.text),createdAt:time(),createdBy:actor.id};
   if(await store.createDraft(document)!==true)return result(false,409);
   return Object.freeze({ok:true,status:201,id:document.id,hash:document.hash});
  }catch(_){return result(false,503);}
 }
 async function publish(actor,input){
  if(!authorize(actor,'legal','publish'))return result(false,403);
  if(!input||!typeAllowed(input.type)||!validId(input.id)||typeof input.hash!=='string'||!/^[a-f0-9]{64}$/.test(input.hash)||input.confirmed!==true||!Number.isSafeInteger(input.effectiveAt))return result(false,400);
  try{
   const publishedAt=time();
   if(input.effectiveAt<publishedAt)return result(false,400);
   const outcome=await store.publishDraft({id:input.id,type:input.type,expectedHash:input.hash,effectiveAt:input.effectiveAt,publishedAt,actorId:actor.id});
   if(outcome==='published')return result(true,200);
   if(outcome==='conflict')return result(false,409);
   throw Error('Résultat invalide');
  }catch(_){return result(false,503);}
 }
 async function listPublished(actor,type){
  if(!authorize(actor,'legal','read'))return result(false,403);
  if(!typeAllowed(type))return result(false,400);
  try{
   const documents=await store.readPublished(type);
   if(!Array.isArray(documents))throw Error('Résultat invalide');
   const projected=documents.map(d=>{
    if(!d||d.type!==type||!Number.isSafeInteger(d.version)||d.version<1||typeof d.text!=='string'||hashText(d.text)!==d.hash||!Number.isSafeInteger(d.publishedAt)||!Number.isSafeInteger(d.effectiveAt)||d.effectiveAt<d.publishedAt)throw Error('Document invalide');
    return Object.freeze({type,version:d.version,text:d.text,hash:d.hash,publishedAt:d.publishedAt,effectiveAt:d.effectiveAt});
   });
   return Object.freeze({ok:true,status:200,documents:Object.freeze(projected)});
  }catch(_){return result(false,503);}
 }
 async function listDrafts(actor,type){
  if(!authorize(actor,'legal','draft'))return result(false,403);
  if(!typeAllowed(type))return result(false,400);
  try{
   const documents=await store.readDrafts(type);
   if(!Array.isArray(documents))throw Error('Résultat invalide');
   return Object.freeze({ok:true,status:200,documents:Object.freeze(documents.map(d=>Object.freeze({id:d.id,type:d.type,text:d.text,hash:d.hash,createdAt:d.createdAt})))});
  }catch(_){return result(false,503);}
 }
 return Object.freeze({draft,publish,listPublished,listDrafts});
}
module.exports=Object.freeze({createLegalDocuments});
