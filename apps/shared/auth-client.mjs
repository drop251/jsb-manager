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
  const response=await fetchImpl(origin+path,{method:body===undefined?'GET':'POST',credentials:'same-origin',mode:'same-origin',cache:'no-store',redirect:'error',headers:{Accept:'application/json',...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
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
 return Object.freeze({session,login,logout});
}
