'use strict';
const {authorize}=require('../core/platform-permissions.cjs');

// Route et action définies par le serveur, jamais par le corps de la requête.
// Les adaptateurs injectés doivent vérifier la session et lire les ressources
// dans le stockage serveur. Aucun adaptateur de démonstration en production.
const SCOPES=Object.freeze({
 clubMembers:'clubId',attendance:'clubId',clubReports:'clubId',clubPlanning:'clubId',
 privateSessions:'ownerId',privateBackups:'ownerId',legalAcceptance:'ownerId',generator:'ownerId'
});
const error=status=>Object.freeze({ok:false,status});
function validId(v){return typeof v==='string' && v.trim().length>0 && v.length<=256;}
function createRequestGuard({resolveSession,resolveScope}={}){
 if(typeof resolveSession!=='function'||typeof resolveScope!=='function') throw new TypeError('Adaptateurs serveur requis');
 return async function guard({sessionToken,route,resourceId}={}){
  if(!validId(sessionToken)) return error(401);
  try{
   const actor=await resolveSession(sessionToken);
   if(!actor||actor.authenticated!==true||actor.status!=='active'||!validId(actor.id)) return error(401);
   if(!route||typeof route.resource!=='string'||typeof route.action!=='string') return error(403);
   const {resource,action}=route;
   let scope;
   if(Object.hasOwn(SCOPES,resource)){
    if(!validId(resourceId)) return error(403);
    const stored=await resolveScope(resource,resourceId);
    const field=SCOPES[resource];
    if(!stored||!validId(stored[field])) return error(403);
    scope=Object.freeze({[field]:stored[field]});
   }
   if(!authorize(actor,resource,action,scope)) return error(403);
   return Object.freeze({ok:true,status:200,actorId:actor.id,resource,action,resourceId,scope});
  }catch(_){return error(503);}
 };
}
module.exports=Object.freeze({createRequestGuard});
