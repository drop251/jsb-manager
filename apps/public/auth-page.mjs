import {createAuthClient} from '../shared/auth-client.mjs';
const form=document.querySelector('#login'),fields=document.querySelector('#fields'),status=document.querySelector('#status'),logout=document.querySelector('#logout');
let client=null,busy=false,refreshPending=false,session=null,channel=null,panel=null;
const actions=document.querySelector('#account-actions');
const panels=Array.from(document.querySelectorAll('.action-panel'));
const value=id=>document.getElementById(id).value;
const setValue=(id,v)=>{document.getElementById(id).value=v;};
function showPanel(id){
 panel=panels.find(p=>p.id===id)||null;
 clearSecrets();
 for(const p of panels)p.hidden=p!==panel;
 form.hidden=Boolean(panel);
 paint(status.textContent);
 if(panel)panel.querySelector('h2').focus({preventScroll:true});
 else if(!fields.disabled)document.querySelector('#email').focus({preventScroll:true});
}
const active=document.createElement('p');
active.id='active-session';active.className='note';active.setAttribute('aria-live','polite');
status.before(active);
const refreshButton=document.createElement('button');
refreshButton.type='button';refreshButton.id='refresh-session';refreshButton.textContent='Vérifier ma session';refreshButton.disabled=true;
logout.after(refreshButton);
const clearSecrets=()=>{for(const input of document.querySelectorAll('input[type=password],#verify-code,#reset-code'))input.value='';};
const label=role=>({coach:'Coach',individual:'Particulier',admin:'Administrateur'}[role]||'');
function paint(message){
 fields.disabled=busy||!session||Boolean(panel);
 actions.hidden=Boolean(panel)||!client;
 for(const button of actions.querySelectorAll('button'))button.disabled=busy||!session;
 for(const p of panels){
  for(const fs of p.querySelectorAll('fieldset'))fs.disabled=busy||!session||p!==panel;
  for(const button of p.querySelectorAll('[data-close-panel]'))button.disabled=busy;
 }
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
form.addEventListener('submit',e=>{e.preventDefault();if(fields.disabled)return;const email=document.querySelector('#email').value,password=document.querySelector('#password').value;clearSecrets();void transition(()=>client.login({email,password}));});
logout.addEventListener('click',()=>void transition(()=>client.logout()));
refreshButton.addEventListener('click',()=>{if(client&&!busy)void refresh()});
for(const button of actions.querySelectorAll('[data-panel]'))button.addEventListener('click',()=>{if(!busy&&session)showPanel(button.dataset.panel);});
for(const button of document.querySelectorAll('[data-close-panel]'))button.addEventListener('click',()=>{if(!busy)showPanel(null);});
async function accountAction(operation,onSuccess,invalidMessage){
 if(busy||!session||!panel)return;
 busy=true;paint('Vérification en cours…');
 try{
  const result=await operation();
  session=await client.session();
  if(result.ok){onSuccess();}
  else paint(result.status===429?'Trop de tentatives. Réessayez plus tard.':invalidMessage);
 }catch{session=null;paint('Service indisponible. Vérifiez votre session avant de réessayer.');}
 finally{clearSecrets();busy=false;paint(status.textContent);if(refreshPending){refreshPending=false;void refresh();}}
}
function bind(id,handler){
 document.getElementById(id).addEventListener('submit',e=>{e.preventDefault();if(busy||!session||e.currentTarget.closest('.action-panel')!==panel)return;handler();});
}
bind('register-form',()=>{
 const email=value('register-email'),password=value('register-password'),role=value('register-role');
 if(password!==value('register-confirm')){clearSecrets();paint('Les deux mots de passe doivent être identiques.');return;}
 clearSecrets();
 void accountAction(()=>client.register({email,password,role}),()=>{
  setValue('resend-email',email);showPanel('verify-panel');
  paint('Demande enregistrée. Si cette adresse est éligible, un code pourra être envoyé. L’envoi réel reste à configurer en préproduction.');
 },'Vérifiez le profil, l’adresse et le mot de passe.');
});
bind('verify-form',()=>{
 const code=value('verify-code').trim();clearSecrets();
 void accountAction(()=>client.verifyEmail(code),()=>{
  showPanel(null);paint('Adresse confirmée. Vous pouvez vous connecter à ce compte.');
 },'Code invalide, expiré ou déjà utilisé.');
});
bind('resend-form',()=>{
 const email=value('resend-email');
 void accountAction(()=>client.resendVerification(email),()=>paint('Demande enregistrée. Si l’adresse est éligible, un nouveau code pourra être envoyé.'),'Vérifiez votre adresse e-mail.');
});
bind('reset-request-form',()=>{
 const email=value('reset-email');
 void accountAction(()=>client.requestReset(email),()=>{
  showPanel('reset-confirm-panel');paint('Demande enregistrée. Si l’adresse est éligible, un code pourra être envoyé. L’envoi réel reste à configurer en préproduction.');
 },'Vérifiez votre adresse e-mail.');
});
bind('reset-confirm-form',()=>{
 const token=value('reset-code').trim(),password=value('reset-password');
 if(password!==value('reset-confirm')){clearSecrets();paint('Les deux mots de passe doivent être identiques.');return;}
 clearSecrets();
 void accountAction(()=>client.confirmReset({token,password}),()=>{
  channel?.postMessage('session-changed');showPanel(null);
  paint('Mot de passe réinitialisé. Les sessions du compte concerné ont été révoquées.');
 },'Code invalide, expiré ou mot de passe non conforme.');
});
if(location.protocol!=='https:'||!navigator.locks){paint('Connexion désactivée : origine HTTPS et navigateur compatible requis.');}
else{client=createAuthClient({origin:location.origin,fetchImpl:fetch.bind(window),locks:navigator.locks,allowedRoles:["coach","individual"]});if(typeof BroadcastChannel==='function'){try{channel=new BroadcastChannel('jsb-auth-session-v1');channel.onmessage=e=>{if(e.data==='session-changed')void refresh()};}catch{channel=null;}}
window.addEventListener('pageshow',e=>{if(e.persisted)void refresh()});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void refresh()});void refresh();}
