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

const workspace=document.querySelector('#workspace');
const workspacePages={"common":[["accounts","Comptes plateforme","Coach et Particulier",["Comptes Coach","Comptes Particulier","Suspension et réactivation — à raccorder"]],["stats","Statistiques","Indicateurs agrégés uniquement",["Comptes actifs","Inscriptions","Usage agrégé"]],["catalogue","Catalogue de référence","Référentiels indépendants",["Judo — base non validée","Taïso — référentiel à raccorder","Historique des versions"]],["legal","Documents légaux","CGU et confidentialité",["CGU","Politique de confidentialité","CGV — désactivées"]],["tests","Tests des générateurs","Recette isolée",["Judo","Taïso"]],["maintenance","Maintenance","Sécurité et messagerie",["État du serveur","Diagnostic e-mail — non raccordé","Journal administratif","Sauvegardes plateforme"]]]};
let workspaceIdentity=null;
const element=(tag,txt)=>{const node=document.createElement(tag);if(txt)node.textContent=txt;return node;};
function renderWorkspace(){
 const account=session?.state==='signed-in'&&!busy?session.account:null;
 const permitted=account&&account.role==='admin';
 if(!permitted){
  workspace.hidden=true;workspace.replaceChildren();workspaceIdentity=null;
  document.querySelector('main').classList.remove('has-session');return;
 }
 const identity=account.id+':'+account.role;
 workspace.hidden=false;document.querySelector('main').classList.add('has-session');
 if(workspaceIdentity===identity)return;
 workspaceIdentity=identity;
 const items=[...workspacePages.common];
 function home(focus=false){
  if(busy||workspaceIdentity!==identity)return;
  workspace.replaceChildren();
  const heading=element('h2','Tableau de bord Administrateur');heading.tabIndex=-1;
  workspace.append(heading,element('p','Navigation de préproduction. Les données et actions métier restent indisponibles.'));
  const grid=element('div');grid.className='workspace-grid';
  for(const [key,title,description,sections] of items){
   const button=element('button');button.type='button';button.dataset.workspacePage=key;
   if(key==='judo'||key==='taiso')button.dataset.discipline=key;
   button.append(element('strong',title),element('small',description));
   button.addEventListener('click',()=>{
    if(busy||workspaceIdentity!==identity)return;
    const detail=element('div');detail.className='workspace-detail';
    const h=element('h3',title);h.tabIndex=-1;detail.append(h,element('p','Fonctionnalités prévues — API métier non raccordée.'));
    const list=element('ul');for(const name of sections)list.append(element('li',name));detail.append(list);
    const back=element('button','Retour à l’accueil');back.type='button';back.id='workspace-back';back.addEventListener('click',()=>home(true));detail.append(back);
    workspace.replaceChildren(detail);h.focus({preventScroll:true});
   });grid.append(button);
  }
  workspace.append(grid);if(focus)heading.focus({preventScroll:true});
 }
 home();
}

function paint(message){
 renderWorkspace();
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
