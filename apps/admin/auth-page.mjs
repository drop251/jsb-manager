import {createAuthClient} from '../shared/auth-client.mjs';
const form=document.querySelector('#login'),fields=document.querySelector('#fields'),status=document.querySelector('#status'),logout=document.querySelector('#logout');
let client=null,busy=false,refreshPending=false,session=null,channel=null;
const active=document.createElement('p');
active.id='active-session';active.className='note';active.setAttribute('aria-live','polite');
status.before(active);
const refreshButton=document.createElement('button');
refreshButton.type='button';refreshButton.id='refresh-session';refreshButton.textContent='Vérifier ma session';refreshButton.disabled=true;
logout.after(refreshButton);
const clearSecrets=()=>{document.querySelector('#password').value='';const mfa=document.querySelector('#mfa');if(mfa)mfa.value='';};
const label=role=>({coach:'Coach',individual:'Particulier',admin:'Administrateur'}[role]||'');
function paint(message){
 fields.disabled=busy||!session||session.state==='signed-in';
 logout.hidden=session?.state!=='signed-in';logout.disabled=busy||logout.hidden;
 active.textContent=session?.state==='signed-in'?'Compte actif : '+label(session.account.role):session?.state==='signed-out'?'Aucun compte connecté':'Session non confirmée';
 refreshButton.disabled=busy||!client;
 status.textContent=message;
}
async function refresh(){
 if(busy){refreshPending=true;return;}
 busy=true;session=null;clearSecrets();paint('Vérification de la session…');
 try{session=await client.session();paint(session.state==='signed-in'?'Session vérifiée : '+label(session.account.role)+'.':'Connectez-vous à votre compte.');}
 catch{paint('Serveur indisponible. Connexion verrouillée.');}
 finally{busy=false;paint(status.textContent);if(refreshPending){refreshPending=false;void refresh();}}
}
async function transition(operation){
 if(busy||!session)return;
 busy=true;paint('Vérification en cours…');
 try{
  const result=await operation();session=await client.session();
  if(result.ok)channel?.postMessage('session-changed');
  paint(result.ok?(session.state==='signed-in'?'Session vérifiée : '+label(session.account.role)+'.':'Vous êtes déconnecté.'):result.status===429?'Trop de tentatives. Réessayez plus tard.':'Identifiants incorrects ou accès refusé.');
 }catch{session=null;channel?.postMessage('session-changed');paint('État de session non confirmé. Accès verrouillé. Vérifiez la session.');}
 finally{clearSecrets();busy=false;paint(status.textContent);if(refreshPending){refreshPending=false;void refresh();}}
}
form.addEventListener('submit',e=>{e.preventDefault();if(fields.disabled)return;const email=document.querySelector('#email').value,password=document.querySelector('#password').value,mfaCode=document.querySelector('#mfa').value;clearSecrets();void transition(()=>client.login({email,password,mfaCode}));});
logout.addEventListener('click',()=>void transition(()=>client.logout()));
refreshButton.addEventListener('click',()=>{if(client&&!busy)void refresh()});
if(location.protocol!=='https:'||!navigator.locks){paint('Connexion désactivée : origine HTTPS et navigateur compatible requis.');}
else{client=createAuthClient({origin:location.origin,fetchImpl:fetch.bind(window),locks:navigator.locks,allowedRoles:["admin"]});if(typeof BroadcastChannel==='function'){try{channel=new BroadcastChannel('jsb-auth-session-v1');channel.onmessage=e=>{if(e.data==='session-changed')void refresh()};}catch{channel=null;}}
window.addEventListener('pageshow',e=>{if(e.persisted)void refresh()});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void refresh()});void refresh();}
