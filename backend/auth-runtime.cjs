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
const {createPublicationFlow}=require('./catalogue-publication-flow.cjs');
const {createCatalogueHistory}=require('./db/catalogue-history.cjs');
// Composition only, no listener, no environment defaults, no demo keys.
// Origins and key loaders must come from trusted deployment configuration.
function createAuthRuntime({pool,publicOrigin,adminOrigin,sourceId,quotaSecret,deliveryKeys,mfaKeys,xlsxPython,enableCataloguePublication=false,now=Date.now}={}){
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
 if(typeof enableCataloguePublication!=='boolean')throw TypeError('Configuration publication invalide');
 const publication=enableCataloguePublication?createPublicationFlow({pool,key:createHmac('sha256',quotaSecret).update('JSB/catalogue-publication/v1').digest(),now}):null;
 const publishLimiter=limiter('catalogue-publication',5,10);
 const history=createCatalogueHistory(pool),historyLimiter=limiter('catalogue-history',60,120),restoreLimiter=limiter('catalogue-restoration',5,10);
 async function catalogueHistory(actor,body,source){
  if(!authorize(actor,'catalogue','import'))return {ok:false,status:403};
  if(!await historyLimiter.reserve({accountKey:actor.id,sourceId:source}))return {ok:false,status:429};
  const result=await history.list(actor,body.discipline,{offset:body.offset});
  if(result.ok)result.history.restoreEnabled=!!publication;
  return result;
 }
 async function catalogueRestore(actor,body,source,sessionHash){
  if(!publication||!authorize(actor,'catalogue','import'))return {ok:false,status:403};
  if(!await restoreLimiter.reserve({accountKey:actor.id,sourceId:source}))return {ok:false,status:429};
  return history.restore(actor,sessionHash,body);
 }
 async function analyzeCandidate(body,includeCanonical=false){
  if(body.format==='xlsx-recipe'||body.format==='xlsx-contract'){
   if(!['judo','taiso'].includes(body.discipline)||(body.format==='xlsx-recipe'&&body.discipline!=='taiso'))return {status:400};
   if(!xlsxAnalyzer)return {status:503};
   const result=await xlsxAnalyzer(body.base64,{discipline:body.discipline,version:body.version,includeCanonical});
   if(!result)return {status:503};
   const {canonical,...analysis}=result;
   return {status:200,analysis,canonical};
  }
  if(body.format!==undefined&&body.format!=='json')return {status:400};
  const result=analyzeCatalogueImport(body.text,body.discipline);
  return {status:200,analysis:result.ok?{valid:true,...result.report}:{valid:false,errorCount:result.errorCount,errors:result.errors},canonical:includeCanonical?result.canonical:undefined};
 }
 async function catalogueImport(actor,body,source,sessionHash){
  if(!authorize(actor,'catalogue','import'))return {ok:false,status:403};
  if(!await importLimiter.reserve({accountKey:actor.id,sourceId:source}))return {ok:false,status:429};
  const result=await analyzeCandidate(body,!!publication);
  if(result.status!==200)return {ok:false,status:result.status};
  const analysis=result.analysis;
  if(publication&&analysis.valid&&result.canonical){
   const confirmation=await publication.prepare(actor,sessionHash,result.canonical);
   if(confirmation)analysis.confirmation=confirmation;
  }
  return {ok:true,status:200,analysis};
 }
 async function cataloguePublish(actor,body,source,sessionHash){
  if(!publication||!authorize(actor,'catalogue','import'))return {ok:false,status:403};
  if(!await publishLimiter.reserve({accountKey:actor.id,sourceId:source}))return {ok:false,status:429};
  if(!publication.verify(actor,sessionHash,body.receipt))return {ok:false,status:409};
  if(body.confirmed!==true||typeof body.confirmationVersion!=='string')return {ok:false,status:400};
  const result=await analyzeCandidate(body,true);
  if(result.status!==200)return {ok:false,status:result.status};
  if(!result.analysis.valid||!result.canonical)return {ok:false,status:400};
  return publication.publish(actor,sessionHash,{receipt:body.receipt,canonical:result.canonical,confirmed:body.confirmed,confirmationVersion:body.confirmationVersion});
 }
 const adminHandler=createAuthHttpHandler({app:'admin',origin:adminOrigin,sourceId,sessions,loginService:createAdminLoginService({...loginOptions,limiter:limiter('admin-login',5,20)}),catalogue,catalogueImport,catalogueHistory,...(publication?{cataloguePublish,catalogueRestore}:{}),now});
 async function checkReady(){
  const [delivery,mfa]=await Promise.all([deliveryKeys.loadKey(deliveryKeys.activeKeyId),mfaKeys.loadKey(mfaKeys.activeKeyId)]);
  if(!Buffer.isBuffer(delivery)||delivery.length!==32||!Buffer.isBuffer(mfa)||mfa.length!==32||timingSafeEqual(delivery,mfa)||[delivery,mfa].some(k=>quotaSecret.length===k.length&&timingSafeEqual(k,quotaSecret)))throw Error('Clés serveur absentes ou non distinctes');
  // Check required schema, not merely connectivity. No data is returned.
  await pool.query("SELECT a.id FROM jsb_auth.accounts a, jsb_auth.sessions s, jsb_auth.action_tokens t, jsb_auth.delivery_outbox o, jsb_auth.quota_events q, jsb_auth.mfa_factors f WHERE false");
  await pool.query('SELECT r.version,e.pedagogical_details FROM jsb_catalogue.releases r, jsb_catalogue.exercises e, jsb_catalogue.current_release c WHERE false');
  await pool.query('SELECT p.version,c.generation,r.generation FROM jsb_catalogue.publications p, jsb_catalogue.current_release c, jsb_catalogue.restorations r WHERE false');
  return true;
 }
 return Object.freeze({publicHandler,adminHandler,checkReady});
}
module.exports=Object.freeze({createAuthRuntime});
