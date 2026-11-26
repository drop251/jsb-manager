'use strict';
const {createHash}=require('node:crypto');
// Provider adapter must implement bounded delivery time (< lease), TLS and
// idempotency by deliveryId. No network adapter or recipient is enabled here.
function createDeliveryWorker({store,vault,sendMail,allowRecipient,now=Date.now}={}){
 if(!['claim','current','finish','retry','purgeExpired'].every(k=>typeof store?.[k]==='function')||typeof vault?.decryptDelivery!=='function'||typeof sendMail!=='function'||typeof allowRecipient!=='function'||typeof now!=='function')throw TypeError('Adaptateurs de livraison requis');
 let busy=false;
 async function runOnce(){
  if(busy)return 'busy';
  busy=true;
  try{
   const job=await store.claim();
   if(!job)return 'idle';
   try{
    const payload=await vault.decryptDelivery(job);
    if(payload.expiresAt!==job.expiresAt||payload.expiresAt<=now()) {await store.finish(job);return 'discarded';}
    if(await allowRecipient(payload.email)!==true){await store.retry(job);return 'blocked';}
    const hash=createHash('sha256').update(payload.token).digest('hex');
    if(await store.current(job,hash,payload.email)!==true){await store.finish(job);return 'discarded';}
    const verify=job.purpose==='email-verification';
    const subject=verify?'JSB Manager — Confirmez votre adresse e-mail':'JSB Manager — Réinitialisation du mot de passe';
    const text=(verify?'Pour confirmer votre adresse e-mail, saisissez ce code dans JSB Manager :':'Pour réinitialiser votre mot de passe, saisissez ce code dans JSB Manager :')+'\n\n'+payload.token+'\n\nExpiration : '+new Date(payload.expiresAt).toISOString()+'.\nSi vous n’êtes pas à l’origine de cette demande, ignorez ce message. Ne partagez pas ce code.';
    // No URL tokens or tracking. The adapter must not log plaintext.
    const result=await sendMail({deliveryId:'jsb-auth-v1-'+job.id,to:payload.email,subject,text});
    if(result!==true){await store.retry(job);return 'retry';}
    return await store.finish(job)?'sent':'superseded';
   }catch(_){await store.retry(job);return 'retry';}
  }finally{busy=false;}
 }
 return Object.freeze({runOnce,purgeExpired:()=>store.purgeExpired()});
}
module.exports=Object.freeze({createDeliveryWorker});
