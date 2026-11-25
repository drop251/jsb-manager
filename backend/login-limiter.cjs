'use strict';
const {createHmac}=require('node:crypto');
// Le stockage injecté doit réserver les tentatives atomiquement, sur toutes les instances.
// sourceId doit provenir du transport serveur/proxy de confiance, jamais d'un en-tête arbitraire.
function createLoginLimiter({store,secret,now=Date.now,windowMs=15*60*1000,accountLimit=10,sourceLimit=50}={}){
 if(!store||typeof store.reserve!=='function'||!Buffer.isBuffer(secret)||secret.length<32||typeof now!=='function')throw new TypeError('Configuration de limitation requise');
 for(const n of [windowMs,accountLimit,sourceLimit])if(!Number.isSafeInteger(n)||n<=0)throw new RangeError('Limite invalide');
 if(windowMs>86400000||accountLimit>1000||sourceLimit>10000)throw new RangeError('Limite excessive');
 const key=(kind,value)=>createHmac('sha256',secret).update(kind+'\0'+value).digest('hex');
 async function reserve({accountKey,sourceId}={}){
  if(typeof accountKey!=='string'||!accountKey||accountKey.length>320||typeof sourceId!=='string'||!sourceId||sourceId.length>256)return false;
  const time=now();if(!Number.isSafeInteger(time)||time<0)return false;
  // Les compteurs sont indépendants, avec une fenêtre glissante et une expiration.
  // reserve doit refuser sans incrémenter si un quota est épuisé.
  try{return (await store.reserve([{key:key('account',accountKey),limit:accountLimit},{key:key('source',sourceId),limit:sourceLimit}],time,windowMs))===true;}catch(_){return false;}
 }
 return Object.freeze({reserve});
}
module.exports=Object.freeze({createLoginLimiter});
