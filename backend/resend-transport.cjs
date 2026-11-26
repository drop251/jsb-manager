'use strict';
const {normalizeEmail}=require('./login-service.cjs');
// Transactional mail only. Configuration is private and activation is explicit.
// The injected fetch makes tests completely independent of external delivery.
function createResendTransport({apiKey,from,namespace,fetchImpl=globalThis.fetch}={}){
 if(typeof apiKey!=='string'||!apiKey.trim()||/\s/.test(apiKey)||typeof fetchImpl!=='function')throw TypeError('Configuration transport requise');
 if(normalizeEmail(from)!==from||typeof from!=='string'||/[\r\n,<>]/.test(from))throw TypeError('Adresse expéditeur invalide');
 if(typeof namespace!=='string'||!/^[A-Za-z0-9_-]{16,64}$/.test(namespace))throw TypeError('Identifiant de déploiement requis');
 return async function sendMail({deliveryId,to,subject,text}={}){
  if(typeof deliveryId!=='string'||!/^jsb-auth-v1-[0-9]+$/.test(deliveryId)||normalizeEmail(to)!==to||typeof to!=='string'||/[\r\n,<>]/.test(to)||typeof subject!=='string'||subject.length>200||/[\r\n]/.test(subject)||typeof text!=='string'||text.length>4096)return false;
  try{
   const response=await fetchImpl('https://api.resend.com/emails',{
    method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),
    headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json','Idempotency-Key':namespace+'/'+deliveryId},
    body:JSON.stringify({from:'JSB Manager <'+from+'>',to:[to],subject,text})
   });
   if(!response.ok){await response.body?.cancel();return false;}
   const result=await response.json();
   return typeof result?.id==='string'&&result.id.length>0;
  }catch(_){return false;}
 };
}
module.exports=Object.freeze({createResendTransport});
