'use strict';
const {randomBytes,createHmac,timingSafeEqual}=require('node:crypto');
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32(bytes){
 let bits=0,value=0,out='';
 for(const b of bytes){value=(value<<8)|b;bits+=8;while(bits>=5){bits-=5;out+=alphabet[(value>>>bits)&31];}}
 if(bits)out+=alphabet[(value<<(5-bits))&31];
 return out;
}
function generateSecret(){return randomBytes(20);}
function provisioningUri(secret,accountLabel){
 if(!Buffer.isBuffer(secret)||secret.length!==20||typeof accountLabel!=='string'||!accountLabel.trim()||accountLabel.length>254)throw new TypeError('Configuration MFA invalide');
 const issuer='JSB Manager';
 return 'otpauth://totp/'+encodeURIComponent(issuer)+':'+encodeURIComponent(accountLabel)+'?secret='+base32(secret)+'&issuer='+encodeURIComponent(issuer)+'&algorithm=SHA1&digits=6&period=30';
}
function codeForStep(secret,step){
 if(!Buffer.isBuffer(secret)||secret.length!==20||!Number.isSafeInteger(step)||step<0)throw new TypeError('Paramètres TOTP invalides');
 const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(step));
 const hash=createHmac('sha1',secret).update(counter).digest(),offset=hash[hash.length-1]&15;
 return String((hash.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0');
}
// loadFactor returns only a decrypted, enabled factor from trusted server storage.
// consumeStep must atomically compare factor version, active admin role/status,
// and last accepted step; reject step <= last accepted step and persist the new step.
// Enrollment, secret encryption and recovery are separate services.
function createAdminMfa({loadFactor,consumeStep,now=Date.now}={}){
 if(typeof loadFactor!=='function'||typeof consumeStep!=='function'||typeof now!=='function')throw new TypeError('Adaptateurs MFA requis');
 async function verifyMfa(accountId,code){
  if(typeof accountId!=='string'||!accountId.trim()||typeof code!=='string'||!/^\d{6}$/.test(code))return false;
  const time=now();if(!Number.isSafeInteger(time)||time<0)return false;
  const factor=await loadFactor(accountId);
  if(!factor||factor.enabled!==true||typeof factor.version!=='string'||!factor.version||!Buffer.isBuffer(factor.secret)||factor.secret.length!==20)return false;
  const current=Math.floor(time/30000),input=Buffer.from(code);
  let matched=-1;
  for(const step of [current-1,current,current+1]){
   if(step>=0&&timingSafeEqual(input,Buffer.from(codeForStep(factor.secret,step))))matched=Math.max(matched,step);
  }
  if(matched<0)return false;
  return (await consumeStep({accountId,version:factor.version,step:matched}))===true;
 }
 return Object.freeze({verifyMfa});
}
module.exports=Object.freeze({generateSecret,provisioningUri,codeForStep,createAdminMfa});
