'use strict';
const {randomBytes,createHash}=require('node:crypto');
const ROLES=new Set(['admin','coach','individual']);
const digest=token=>createHash('sha256').update(token,'utf8').digest('hex');
const validToken=t=>typeof t==='string'&&/^[A-Za-z0-9_-]{43}$/.test(t);
const validAccount=a=>a&&typeof a.id==='string'&&a.id.trim()!==''&&ROLES.has(a.role)&&a.status==='active';
const invalid=()=>null;
// Store contract: insert(record) must be unique, find(hash), remove(hash),
// removeAccount(accountId). Production adapters must implement atomic operations.
// Accounts and credentials are verified elsewhere; issue() is server-only.
function createSessions({store,loadAccount,now=Date.now,ttlMs=8*60*60*1000,adminTtlMs=60*60*1000}={}){
 if(!store||!['insert','find','remove','removeAccount'].every(k=>typeof store[k]==='function')||typeof loadAccount!=='function'||typeof now!=='function')throw new TypeError('Adaptateurs de session requis');
 for(const value of [ttlMs,adminTtlMs])if(!Number.isSafeInteger(value)||value<=0||value>30*24*60*60*1000)throw new RangeError('Durée de session invalide');
 if(adminTtlMs>ttlMs)throw new RangeError('Durée administrateur excessive');
 function time(){const t=now();if(!Number.isSafeInteger(t)||t<0)throw new Error('Horloge invalide');return t;}
 async function issue(verified){
  if(!verified||verified.credentialVerified!==true||typeof verified.accountId!=='string')return invalid();
  const a=await loadAccount(verified.accountId);
  if(!validAccount(a)||a.id!==verified.accountId||(a.role==='admin'&&verified.mfaVerified!==true))return invalid();
  const token=randomBytes(32).toString('base64url'), issuedAt=time(), expiresAt=issuedAt+(a.role==='admin'?adminTtlMs:ttlMs);
  await store.insert({hash:digest(token),accountId:a.id,roleAtIssue:a.role,issuedAt,expiresAt});
  return Object.freeze({token,expiresAt});
 }
 async function resolveSession(token){
  if(!validToken(token))return invalid();
  const hash=digest(token),record=await store.find(hash);
  if(!record||record.hash!==hash||!Number.isSafeInteger(record.issuedAt)||!Number.isSafeInteger(record.expiresAt)||record.expiresAt<=record.issuedAt)return invalid();
  const t=time();
  if(t<record.issuedAt||t>=record.expiresAt){await store.remove(hash);return invalid();}
  const a=await loadAccount(record.accountId);
  if(!validAccount(a)||a.id!==record.accountId||a.role!==record.roleAtIssue){await store.remove(hash);return invalid();}
  const clubIds=a.role==='coach'&&Array.isArray(a.clubIds)?a.clubIds.filter(id=>typeof id==='string'&&id.trim()!==''):[];
  return Object.freeze({id:a.id,role:a.role,status:a.status,authenticated:true,clubIds:Object.freeze(clubIds)});
 }
 async function revoke(token){if(validToken(token))await store.remove(digest(token));}
 async function revokeAccount(accountId){if(typeof accountId!=='string'||!accountId.trim())throw new TypeError('Compte invalide');await store.removeAccount(accountId);}
 return Object.freeze({issue,resolveSession,revoke,revokeAccount});
}
module.exports=Object.freeze({createSessions});
