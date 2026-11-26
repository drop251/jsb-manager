import {createAuthClient} from '../shared/auth-client.mjs';
const form=document.querySelector('#login'),fields=document.querySelector('#fields'),status=document.querySelector('#status'),logout=document.querySelector('#logout');
let client=null,busy=false,refreshPending=false,session=null;
const clearSecrets=()=>{document.querySelector('#password').value='';const mfa=document.querySelector('#mfa');if(mfa)mfa.value='';};
const label=role=>({coach:'Coach',individual:'Particulier',admin:'Administrateur'}[role]||'');
function paint(message){
 fields.disabled=busy||!session;
 logout.hidden=session?.state!=='signed-in';logout.disabled=busy||logout.hidden;
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
  paint(result.ok?(session.state==='signed-in'?'Session vérifiée : '+label(session.account.role)+'.':'Vous êtes déconnecté.'):result.status===429?'Trop de tentatives. Réessayez plus tard.':'Identifiants incorrects ou accès refusé.');
 }catch{session=null;paint('État de session non confirmé. Accès verrouillé. Rechargez la page.');}
 finally{clearSecrets();busy=false;paint(status.textContent);if(refreshPending){refreshPending=false;void refresh();}}
}
form.addEventListener('submit',e=>{e.preventDefault();if(fields.disabled)return;const email=document.querySelector('#email').value,password=document.querySelector('#password').value;clearSecrets();void transition(()=>client.login({email,password}));});
logout.addEventListener('click',()=>void transition(()=>client.logout()));
if(location.protocol!=='https:'||!navigator.locks){paint('Connexion désactivée : origine HTTPS et navigateur compatible requis.');}
else{client=createAuthClient({origin:location.origin,fetchImpl:fetch.bind(window),locks:navigator.locks,allowedRoles:["coach","individual"]});window.addEventListener('pageshow',e=>{if(e.persisted)void refresh()});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void refresh()});void refresh();}
