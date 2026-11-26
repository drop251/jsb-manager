// Browser authentication transport. No storage of credentials or tokens.
// Host this module on the same HTTPS origin as the app and its API.
export function createAuthClient({origin,fetchImpl,locks,allowedRoles}={}){
 const url=new URL(origin);
 if(url.protocol!=='https:'||url.origin!==origin||typeof fetchImpl!=='function'||!Array.isArray(allowedRoles)||!allowedRoles.length||allowedRoles.some(r=>typeof r!=='string'||!r))throw TypeError('Configuration client invalide');
 const roles=new Set(allowedRoles);
 function account(value){
  if(!value||typeof value.id!=='string'||!value.id||!roles.has(value.role))throw Error('Identité serveur invalide');
  return Object.freeze({id:value.id,role:value.role});
 }
 async function request(path,body){
  // With mode same-origin, a no-referrer policy can serialize Origin as null
  // on POST (notably WebKit). Keep the strict server origin check; send only
  // the origin root as the referrer for same-origin mutations.
  const response=await fetchImpl(origin+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',mode:'same-origin',referrer:origin+'/',referrerPolicy:body===undefined?'no-referrer':'same-origin',cache:'no-store',redirect:'error',headers:{Accept:'application/json',...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(!response||!/^application\/json(?:;|$)/i.test(response.headers.get('content-type')||''))throw Error('API indisponible');
  const data=await response.json();
  if(!data||typeof data.ok!=='boolean'||data.ok!==(response.status===200||response.status===202))throw Error('Réponse API invalide');
  return {status:response.status,data};
 }
 async function session(){
  const r=await request('/api/session');
  if(r.status===401)return Object.freeze({state:'signed-out'});
  if(r.status!==200)throw Error('Session indisponible');
  return Object.freeze({state:'signed-in',account:account(r.data.account)});
 }
 // Web Locks serialize cooperating tabs on this origin. Unsupported browsers
 // must not silently bypass the lock. Server-side race protection is still required.
 async function exclusive(fn){
  if(!locks||typeof locks.request!=='function')throw Error('Navigateur non compatible avec le verrouillage de session');
  return locks.request('jsb-auth-transition-v1',{mode:'exclusive'},fn);
 }
 async function login({email,password,mfaCode}={}){
  return exclusive(async()=>{
   const r=await request('/api/login',{email,password,...(typeof mfaCode==='string'?{mfaCode}:{})});
   if(r.status===401||r.status===429)return Object.freeze({ok:false,status:r.status});
   if(r.status!==200)throw Error('Connexion indisponible');
   const expected=account(r.data.account),actual=await session();
   if(actual.state!=='signed-in'||actual.account.id!==expected.id||actual.account.role!==expected.role)throw Error('Session non confirmée');
   return Object.freeze({ok:true,account:actual.account});
  });
 }
 async function logout(){
  return exclusive(async()=>{
   const r=await request('/api/logout',{});
   if(r.status!==200)throw Error('Déconnexion indisponible');
   if((await session()).state!=='signed-out')throw Error('Déconnexion non confirmée');
   return Object.freeze({ok:true});
  });
 }
 // Only the public client exposes account lifecycle operations. The backend
 // remains authoritative and the admin origin has no matching routes.
 async function catalogue(discipline){
  if(!['judo','taiso'].includes(discipline))throw TypeError('Discipline invalide');
  const r=await request('/api/catalogue/'+discipline);
  if(r.status!==200)throw Error('Catalogue indisponible');
  const c=r.data.catalogue;
  if(!c||c.discipline!==discipline||!['published','unpublished'].includes(c.state)||!Number.isSafeInteger(c.count)||c.count<0||!Array.isArray(c.families)||c.families.some(f=>typeof f.family!=='string'||!Number.isSafeInteger(f.count)||f.count<1)||c.families.reduce((n,f)=>n+f.count,0)!==c.count)throw Error('Catalogue invalide');
  if(c.state==='unpublished'&&(c.version!==null||c.publishedAt!==null||c.count!==0))throw Error('Etat catalogue invalide');
  if(c.state==='published'&&(typeof c.version!=='string'||!Number.isSafeInteger(c.publishedAt)))throw Error('Version invalide');
  return c;
 }
 async function searchCatalogue(discipline,{version,query='',family='',offset=0}={}){
  if(!['judo','taiso'].includes(discipline))throw TypeError('Discipline invalide');
  const r=await request('/api/catalogue/'+discipline+'/search',{version,query,family,offset});
  if(r.status===409)return {state:'version-changed'};
  if(r.status!==200)throw Error('Recherche indisponible');
  const v=r.data.results;
  if(!v||v.discipline!==discipline||v.version!==version||v.offset!==offset||!Number.isSafeInteger(v.total)||v.total<0||!Array.isArray(v.items)||v.items.length!==Math.min(30,Math.max(0,v.total-offset))||v.items.some(i=>!i||typeof i.reference!=='string'||typeof i.name!=='string'||typeof i.family!=='string'))throw Error('Résultats invalides');
  return {state:'ready',...v};
 }
 async function exerciseDetail(discipline,{version,reference}={}){
  if(!['judo','taiso'].includes(discipline))throw TypeError('Discipline invalide');
  const r=await request('/api/catalogue/'+discipline+'/detail',{version,reference});
  if(r.status===409)return {state:'version-changed'};
  if(r.status===404)return {state:'not-found'};
  if(r.status!==200)throw Error('Fiche indisponible');
  const e=r.data.exercise;
  if(!e||e.discipline!==discipline||e.version!==version||e.reference!==reference||typeof e.name!=='string'||typeof e.family!=='string'||!['complete','summary'].includes(e.state))throw Error('Fiche invalide');
  if(e.state==='summary'&&e.details!==null)throw Error('Fiche invalide');
  if(e.state==='complete'){
   const keys=['safety','dosage','successCriteria','level','subgroup','equipment','moment','easier','harder','accessibility','inspiration','format',...(discipline==='judo'?['competence','pedagogicalRole','prerequisites','opposition','organization','blockDuration']:['targetMuscles'])];
   const extra=['executionDescription','subfamily','classification','sheetType','objective','tagsText','contractVersion','dosageMode','effortSeconds','repetitions','restrictions',...(discipline==='judo'?['ageCategory','grade','repetitionsMax']:[])];
   if(!e.details||typeof e.details!=='object'||Array.isArray(e.details)||Object.keys(e.details).some(k=>!keys.includes(k)&&!extra.includes(k)&&k!=='tags')||keys.some(k=>!Object.hasOwn(e.details,k)||typeof e.details[k]!=='string'||!e.details[k].trim()||e.details[k].length>1800)||extra.some(k=>Object.hasOwn(e.details,k)&&(typeof e.details[k]!=='string'||!e.details[k].trim()||e.details[k].length>1800))||(Object.hasOwn(e.details,'tags')&&(!Array.isArray(e.details.tags)||e.details.tags.length>50||e.details.tags.some(v=>typeof v!=='string'||!v.trim()||v.length>120))))throw Error('Contenu pédagogique invalide');
  }
  return e;
 }
 const api={session,login,logout,catalogue,searchCatalogue,exerciseDetail};
 if(roles.size===2&&roles.has('coach')&&roles.has('individual')){
  async function taisoCandidates({version,generation,criteria}={}){
   const r=await request('/api/generator/taiso/candidates',{version,generation,criteria});
   if(r.status===409)return {state:'version-changed'};
   if(r.status===429)return {state:'rate-limited'};
   if(r.status!==200)throw Error('Sélection indisponible');
   const v=r.data.selection;
   if(!v||v.discipline!=='taiso'||v.version!==version||v.generation!==generation||
     !Number.isSafeInteger(v.total)||v.total<0||!Number.isSafeInteger(v.excluded)||v.excluded<0||
     v.total+v.excluded>2000||!Array.isArray(v.items)||v.items.length!==Math.min(v.total,30)||
     v.items.some(i=>!i||['reference','name','family','dosage'].some(k=>typeof i[k]!=='string'||!i[k].trim())))throw Error('Sélection invalide');
   return {state:'ready',...v};
  }
  async function taisoDraft({version,generation,criteria,minutes,seed,objective='',format='Séries classiques',organization}={}){
   const r=await request('/api/generator/taiso/draft',{version,generation,criteria,minutes,seed,objective,format,organization});
   if(r.status===409)return {state:'version-changed'};
   if(r.status===429)return {state:'rate-limited'};
   if(r.status!==200)throw Error('Proposition indisponible');
   const d=r.data.draft;
   const integer=n=>Number.isSafeInteger(n)&&n>=0;
   if(!d||d.discipline!=='taiso'||d.version!==version||d.generation!==generation||d.minutes!==minutes||d.mode!==criteria.mode||d.seed!==seed||d.format!==format||typeof d.organizationPending!=='boolean'||d.requiresCoachReview!==true||
    !integer(d.candidateCount)||!integer(d.excludedCount)||d.candidateCount+d.excludedCount>2000||
    !Array.isArray(d.missing)||d.missing.some(x=>typeof x!=='string')||!Array.isArray(d.phases)||d.phases.length!==5||
    d.phases.some(p=>!p||typeof p.name!=='string'||!integer(p.minutes)||!integer(p.unallocatedMinutes)||!Array.isArray(p.exercises)||!Array.isArray(p.blocks)||p.blocks.some(b=>!b||typeof b.name!=='string'||!integer(b.minutes)||!Array.isArray(b.references)||b.references.some(r=>typeof r!=='string'||!p.exercises.some(e=>e.reference===r))||!b.organization||!['pending','incomplete','budgeted'].includes(b.organization.state)||b.organization.budgetSeconds!==b.minutes*60||!Array.isArray(b.organization.issues)||(b.organization.plannedSeconds===null?b.organization.remainingSeconds!==null:(!integer(b.organization.plannedSeconds)||b.organization.remainingSeconds!==b.organization.budgetSeconds-b.organization.plannedSeconds)))||
     p.exercises.some(e=>!e||['reference','name','family','dosage','safety'].some(k=>typeof e[k]!=='string'||!e[k].trim())||!integer(e.allocationMinutes)||e.allocationMinutes<1||e.prescription?.mode!==d.mode||
      (d.mode==='Durée'?(!integer(e.prescription.effortSeconds)||e.prescription.effortSeconds<1||e.prescription.effortSeconds>7200):(!integer(e.prescription.repetitions)||e.prescription.repetitions<1||e.prescription.repetitions>10000)))||
     p.exercises.reduce((n,e)=>n+e.allocationMinutes,0)+p.unallocatedMinutes!==p.minutes)||
    d.phases.reduce((n,p)=>n+p.minutes,0)!==minutes)throw Error('Proposition invalide');
   return {state:'ready',...d};
  }
  async function action(path,body,expected){
   return exclusive(async()=>{
    const r=await request(path,body);
    if(r.status===expected)return Object.freeze({ok:true,status:r.status});
    if([400,429].includes(r.status))return Object.freeze({ok:false,status:r.status});
    throw Error('Service indisponible');
   });
  }
  Object.assign(api,{
   taisoCandidates,taisoDraft,
   register:({email,password,role}={})=>{
    if(!roles.has(role))return Promise.resolve(Object.freeze({ok:false,status:400}));
    return action('/api/register',{email,password,role},202);
   },
   verifyEmail:token=>action('/api/verify-email',{token},200),
   resendVerification:email=>action('/api/resend-verification',{email},202),
   requestReset:email=>action('/api/password-reset/request',{email},202),
   confirmReset:({token,password}={})=>action('/api/password-reset/confirm',{token,password},200)
  });
 }
 return Object.freeze(api);
}
