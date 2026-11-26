'use strict';
const {createHmac,timingSafeEqual}=require('node:crypto');
const {authorize}=require('../core/platform-permissions.cjs');
const {analyzeCatalogueImport}=require('../core/catalogue-import.cjs');
const {CONTRACT_VERSION}=require('../core/catalogue-workbook-contract.cjs');
const {createCataloguePublisher}=require('./db/catalogue-publisher.cjs');
const TTL=10*60*1000;
const allowed=(actor,hash)=>authorize(actor,'catalogue','import')&&typeof hash==='string'&&/^[a-f0-9]{64}$/.test(hash);
function createPublicationFlow({pool,key,now=Date.now,publisher=createCataloguePublisher(pool)}={}){
 if(!Buffer.isBuffer(key)||key.length!==32||typeof now!=='function')throw TypeError('Configuration publication invalide');
 const sign=(payload,actor,sessionHash)=>createHmac('sha256',key).update(JSON.stringify(['JSB/publication/v1',actor.id,sessionHash,payload])).digest();
 function canonicalCheck(canonical){
  if(!canonical||!Array.isArray(canonical.exercises)||!canonical.exercises.length||!canonical.exercises.every(e=>e?.details?.contractVersion===CONTRACT_VERSION))return null;
  const text=JSON.stringify(canonical),checked=analyzeCatalogueImport(text,canonical.discipline);
  if(!checked.ok||checked.report.version.toLowerCase().startsWith('recette-'))return null;
  return {text,report:checked.report};
 }
 async function prepare(actor,sessionHash,canonical){
  if(!allowed(actor,sessionHash))return null;
  const checked=canonicalCheck(canonical);if(!checked)return null;
  const {discipline,version,hash,count}=checked.report;
  const r=await pool.query('SELECT version FROM jsb_catalogue.current_release WHERE discipline=$1',[discipline]);
  const previousVersion=r.rows[0]?.version??null;
  const existing=await pool.query('SELECT 1 FROM jsb_catalogue.releases WHERE discipline=$1 AND version=$2',[discipline,version]);
  if(existing.rowCount!==0)return null;
  const expiresAt=now()+TTL;
  const payload=Buffer.from(JSON.stringify({discipline,version,hash,count,previousVersion,expiresAt})).toString('base64url');
  return {receipt:payload+'.'+sign(payload,actor,sessionHash).toString('base64url'),previousVersion,expiresAt};
 }
 function verify(actor,sessionHash,receipt){
  if(!allowed(actor,sessionHash)||typeof receipt!=='string'||receipt.length>2048)return null;
  const pieces=receipt.split('.');
  if(pieces.length!==2||!/^[A-Za-z0-9_-]+$/.test(pieces[0])||!/^[A-Za-z0-9_-]{43}$/.test(pieces[1]))return null;
  const [payload,mac]=pieces,actual=Buffer.from(mac,'base64url');
  if(actual.length!==32||actual.toString('base64url')!==mac||!timingSafeEqual(actual,sign(payload,actor,sessionHash)))return null;
  try{
   const p=JSON.parse(Buffer.from(payload,'base64url').toString('utf8')),t=now();
   return Number.isSafeInteger(p.expiresAt)&&p.expiresAt>t&&p.expiresAt<=t+TTL?p:null;
  }catch{return null;}
 }
 async function publish(actor,sessionHash,{receipt,canonical,confirmed,confirmationVersion}={}){
  if(!allowed(actor,sessionHash))return {ok:false,status:403};
  const p=verify(actor,sessionHash,receipt);
  if(!p)return {ok:false,status:409};
  if(confirmed!==true||confirmationVersion!==p.version)return {ok:false,status:400};
  const checked=canonicalCheck(canonical);
  if(!checked)return {ok:false,status:400};
  const r=checked.report;
  if(r.discipline!==p.discipline||r.version!==p.version||r.hash!==p.hash||r.count!==p.count)return {ok:false,status:409};
  return publisher.publish(actor,sessionHash,{discipline:r.discipline,text:checked.text,expectedHash:p.hash,expectedPreviousVersion:p.previousVersion,confirmed:true});
 }
 return Object.freeze({prepare,verify,publish});
}
module.exports=Object.freeze({createPublicationFlow});
