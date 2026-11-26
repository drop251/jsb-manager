'use strict';
const {createHmac,timingSafeEqual}=require('node:crypto');
const {createAuthStore}=require('./db/auth-store.cjs');
const {createQuotaStore}=require('./db/quota-store.cjs');
const {createRegistrationStore}=require('./db/registration-store.cjs');
const {createPasswordResetStore}=require('./db/password-reset-store.cjs');
const {createAdminMfaStore}=require('./db/admin-mfa-store.cjs');
const {createSessions}=require('./sessions.cjs');
const {createLoginLimiter}=require('./login-limiter.cjs');
const {createPublicLoginService,createAdminLoginService}=require('./login-service.cjs');
const {createRegistrationService}=require('./registration-service.cjs');
const {createEmailVerificationService}=require('./email-verification.cjs');
const {createVerificationResend}=require('./verification-resend.cjs');
const {createPasswordResetService}=require('./password-reset.cjs');
const {createDeliveryVault}=require('./delivery-vault.cjs');
const {createMfaVault}=require('./mfa-vault.cjs');
const {createAdminMfa}=require('./admin-mfa.cjs');
const {createAuthHttpHandler}=require('./auth-http.cjs');
const {createCatalogueReadService}=require('./catalogue-read.cjs');
const {analyzeCatalogueImport}=require('../core/catalogue-import.cjs');
const {authorize}=require('../core/platform-permissions.cjs');
const {createXlsxRecipeAnalyzer}=require('./xlsx-recipe-analyzer.cjs');
// Composition only, no listener, no environment defaults, no demo keys.
// Origins and key loaders must come from trusted deployment configuration.
function createAuthRuntime({pool,publicOrigin,adminOrigin,sourceId,quotaSecret,deliveryKeys,mfaKeys,xlsxPython,now=Date.now}={}){
 function origin(value){
  if(typeof value!=='string')throw TypeError('Origine requise');
  const u=new URL(value);if(u.protocol!=='https:'||u.origin!==value)throw TypeError('Origine HTTPS exacte requise');return u;
 }
 const pub=origin(publicOrigin),adm=origin(adminOrigin);
 if(pub.hostname===adm.hostname)throw TypeError('Hôtes public et admin distincts requis');
 if(!Buffer.isBuffer(quotaSecret)||quotaSecret.length<32||typeof sourceId!=='function'||typeof now!=='function')throw TypeError('Configuration serveur requise');
 if(!deliveryKeys||!mfaKeys||typeof deliveryKeys.loadKey!=='function'||typeof mfaKeys.loadKey!=='function')throw TypeError('Gestionnaires de clés requis');
 const quota=createQuotaStore(pool),auth=createAuthStore(pool);
 const sessions=createSessions({store:auth.store,loadAccount:auth.loadAccount,now});
 const limiter=(purpose,accountLimit,sourceLimit)=>createLoginLimiter({store:quota,secret:createHmac('sha256',quotaSecret).update('JSB/quota/v1/'+purpose).digest(),now,accountLimit,sourceLimit});
 // Separate key domains; check active keys at startup before any HTTP handler.
 const deliveryVault=createDeliveryVault(deliveryKeys),mfaVault=createMfaVault(mfaKeys);
 const registrationStore=createRegistrationStore({pool,encryptDelivery:deliveryVault.encryptDelivery});
 const resetStore=createPasswordResetStore({pool,encryptDelivery:deliveryVault.encryptDelivery});
 const mfaStore=createAdminMfaStore({pool,vault:mfaVault});
 const mfa=createAdminMfa({...mfaStore,now});
 const loginOptions={sessions,findAccountByEmail:auth.findAccountByEmail,verifyMfa:mfa.verifyMfa};
 const registration=createRegistrationService({limiter:limiter('registration',5,25),createPendingAccount:registrationStore.createPendingAccount,now});
 const verification=createEmailVerificationService({limiter:limiter('verification',5,40),consumeAndActivate:registrationStore.consumeAndActivate,now});
 const resend=createVerificationResend({limiter:limiter('resend',3,20),replacePendingVerification:registrationStore.replacePendingVerification,now});
 const passwordReset=createPasswordResetService({requestLimiter:limiter('reset-request',3,20),confirmLimiter:limiter('reset-confirm',5,40),...resetStore,now});
 const catalogue=createCatalogueReadService(pool);
 const publicHandler=createAuthHttpHandler({app:'public',origin:publicOrigin,sourceId,sessions,loginService:createPublicLoginService({...loginOptions,limiter:limiter('public-login',10,50)}),registration,verification,resend,passwordReset,catalogue,now});
 const importLimiter=limiter('catalogue-analysis',20,40);
 const xlsxAnalyzer=xlsxPython===undefined?null:createXlsxRecipeAnalyzer({pythonExecutable:xlsxPython});
 async function catalogueImport(actor,body,source){
  if(!authorize(actor,'catalogue','import'))return {ok:false,status:403};
  if(!await importLimiter.reserve({accountKey:actor.id,sourceId:source}))return {ok:false,status:429};
  if(body.format==='xlsx-recipe'||body.format==='xlsx-contract'){
   if(!['judo','taiso'].includes(body.discipline)||(body.format==='xlsx-recipe'&&body.discipline!=='taiso'))return {ok:false,status:400};
   if(!xlsxAnalyzer)return {ok:false,status:503};
   const analysis=await xlsxAnalyzer(body.base64,{discipline:body.discipline,version:body.version});
   return analysis?{ok:true,status:200,analysis}:{ok:false,status:503};
  }
  if(body.format!==undefined&&body.format!=='json')return {ok:false,status:400};
  const result=analyzeCatalogueImport(body.text,body.discipline);
  // Do not return the canonical dataset or retain a draft in this dry run.
  return {ok:true,status:200,analysis:result.ok?{valid:true,...result.report}:{valid:false,errorCount:result.errorCount,errors:result.errors}};
 }
 const adminHandler=createAuthHttpHandler({app:'admin',origin:adminOrigin,sourceId,sessions,loginService:createAdminLoginService({...loginOptions,limiter:limiter('admin-login',5,20)}),catalogue,catalogueImport,now});
 async function checkReady(){
  const [delivery,mfa]=await Promise.all([deliveryKeys.loadKey(deliveryKeys.activeKeyId),mfaKeys.loadKey(mfaKeys.activeKeyId)]);
  if(!Buffer.isBuffer(delivery)||delivery.length!==32||!Buffer.isBuffer(mfa)||mfa.length!==32||timingSafeEqual(delivery,mfa)||[delivery,mfa].some(k=>quotaSecret.length===k.length&&timingSafeEqual(k,quotaSecret)))throw Error('Clés serveur absentes ou non distinctes');
  // Check required schema, not merely connectivity. No data is returned.
  await pool.query("SELECT a.id FROM jsb_auth.accounts a, jsb_auth.sessions s, jsb_auth.action_tokens t, jsb_auth.delivery_outbox o, jsb_auth.quota_events q, jsb_auth.mfa_factors f WHERE false");
  await pool.query('SELECT r.version,e.pedagogical_details FROM jsb_catalogue.releases r, jsb_catalogue.exercises e, jsb_catalogue.current_release c WHERE false');
  return true;
 }
 return Object.freeze({publicHandler,adminHandler,checkReady});
}
module.exports=Object.freeze({createAuthRuntime});
