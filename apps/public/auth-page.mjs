import {legalView} from '../shared/legal-ui.mjs';
import {mountAttendance} from './attendance-ui.mjs';
import {hasVault,createVault,openVault,vaultPatch} from './offline-vault.mjs';
import '../shared/edge-swipe.js';
import {createAuthClient} from '../shared/auth-client.mjs';
// Safari iOS peut ignorer les limites du viewport : annuler uniquement le zoom multipoint.
// Ne pas intercepter le défilement, le retour tactile à un doigt ni la sélection de texte.
for(const type of ['gesturestart','gesturechange','gestureend']){
 document.addEventListener(type,event=>{if(event.cancelable)event.preventDefault();},{passive:false});
}
document.addEventListener('touchmove',event=>{
 if(event.touches.length>1&&event.cancelable)event.preventDefault();
},{passive:false});
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

const workspace=document.querySelector('#workspace');
const accountTools=document.querySelector('.account-tools');
let settingsOpen=false,changeOpen=false;
const changeButton=document.createElement('button');
changeButton.type='button';changeButton.id='change-account';changeButton.textContent='Changer de compte';changeButton.hidden=true;
form.before(changeButton);
changeButton.addEventListener('click',()=>{
 if(busy||session?.state!=='signed-in'||!settingsOpen||panel)return;
 changeOpen=!changeOpen;clearSecrets();paint(status.textContent);
 if(changeOpen)document.querySelector('#email').focus({preventScroll:true});
});
const workspacePages={"common":[["judo","Judo","Préparation pédagogique",["Catalogue Judo — base en construction","Préparer une séance Judo","Mes séances Judo"]],["taiso","Taïso","Renforcement et préparation physique",["Catalogue Taïso — référentiel à raccorder","Préparer une séance Taïso","Mes séances Taïso"]]],"coach":["club","Gestion du club","Licenciés, présences et planning",["Licenciés","Présences","Bilans","Planning"]],"individual":["personal","Suivi personnel","Mon activité et mes entraînements",["Historique personnel","Progression personnelle"]]};
let workspaceIdentity=null;
const element=(tag,txt)=>{const node=document.createElement(tag);if(txt)node.textContent=txt;return node;};

// Préférences visuelles propres à l'appareil et à cette origine; aucune donnée de compte.
const DISPLAY_KEY='jsb-affichage-v36';
const TEXT_SIZES=[0,100,115,130,160,200];
function readDisplay(){
 let stored={};try{stored=JSON.parse(localStorage.getItem(DISPLAY_KEY)||'{}')||{};}catch{}
 return {theme:['system','light','dark'].includes(stored.theme)?stored.theme:'system',texte:TEXT_SIZES.includes(stored.texte)?stored.texte:100,contraste:stored.contraste===true,animations:stored.animations===true};
}
let display=readDisplay();
function applyDisplay(){
 const root=document.documentElement;
 if(display.theme==='system')root.removeAttribute('data-theme');else root.dataset.theme=display.theme;
 root.style.font='';root.style.fontSize=display.texte?display.texte+'%':'';
 if(!display.texte&&CSS.supports('font','-apple-system-body'))root.style.font='-apple-system-body';
 root.toggleAttribute('data-texte-grand',(parseFloat(getComputedStyle(root).fontSize)||16)>=19);
 root.toggleAttribute('data-contraste',display.contraste);
 root.toggleAttribute('data-anim',display.animations);
}
function setDisplay(patch){
 display={...display,...patch};
 applyDisplay();
 try{localStorage.setItem(DISPLAY_KEY,JSON.stringify(display));return true;}catch{return false;}
}
applyDisplay();
function displaySettings(){
 const section=element('section');section.className='display-settings';section.setAttribute('aria-labelledby','display-title');
 const title=element('h3','Affichage et accessibilité');title.id='display-title';
 const feedback=element('p');feedback.className='note';feedback.setAttribute('role','status');
 function update(patch){feedback.textContent=setDisplay(patch)?'Préférence enregistrée sur cet appareil.':'Préférence appliquée pour cette ouverture uniquement.';}
 function choices(id,legend,values,current,key){
  const fieldset=element('fieldset');fieldset.append(element('legend',legend));
  const options=element('div');options.className='display-options';
  for(const [value,name] of values){
   const label=element('label'),input=element('input');input.type='radio';input.name=id;input.value=String(value);input.checked=value===current;
   input.addEventListener('change',()=>{if(input.checked)update({[key]:value});});
   label.append(input,element('span',name));options.append(label);
  }
  fieldset.append(options);return fieldset;
 }
 function toggle(key,name,description){
  const label=element('label');label.className='display-toggle';
  const text=element('span');text.append(element('strong',name),element('small',description));
  const input=element('input');input.type='checkbox';input.id='display-'+key;input.checked=display[key];input.addEventListener('change',()=>update({[key]:input.checked}));
  label.append(text,input);return label;
 }
 section.append(title,choices('display-theme','Thème',[['light','Clair'],['dark','Sombre'],['system','Système']],display.theme,'theme'),choices('display-text','Taille du texte',[[0,'Système'],[100,'Standard'],[115,'Grand'],[130,'Très grand'],[160,'Énorme'],[200,'Maximal']],display.texte,'texte'),toggle('contraste','Contraste renforcé','Accentue les textes et les bordures.'),toggle('animations','Réduire les animations','Limite les transitions et les effets visuels.'),element('p','Ces préférences sont locales à cet appareil, indépendantes de votre compte.'),feedback);
 return section;
}


function versionSettings(){
 const section=element('section');section.className='display-settings';section.setAttribute('aria-labelledby','version-title');
 const title=element('h3','Version et mises à jour');title.id='version-title';
 const installed=document.querySelector('meta[name="jsb-release"]')?.content;
 const valid=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
 const current=element('p',valid(installed)?'Version chargée : V36 · '+installed.slice(0,12):'Version chargée : V36 (empreinte indisponible)');
 const status=element('p');status.id='version-status';status.setAttribute('role','status');
 const check=element('button','Rechercher une mise à jour');check.type='button';check.id='version-check';check.disabled=!valid(installed);
 const reload=element('button','Actualiser l’application');reload.type='button';reload.id='version-reload';reload.hidden=true;
 reload.addEventListener('click',()=>{if(!busy&&section.isConnected)location.reload();});
 check.addEventListener('click',async()=>{
  if(check.disabled||busy||!section.isConnected)return;
  check.disabled=true;reload.hidden=true;status.textContent='Vérification en cours…';
  try{
   const response=await fetch(location.pathname,{method:'HEAD',credentials:'same-origin',mode:'same-origin',cache:'no-store',redirect:'error',headers:{Accept:'text/html'}});
   const remote=response.headers.get('X-JSB-Release');
   if(!response.ok||!valid(remote))throw Error('version');
   if(!section.isConnected)return;
   if(remote===installed)status.textContent='Votre version est à jour.';
   else{status.textContent='Nouvelle version disponible : V36 · '+remote.slice(0,12)+'. Actualisez lorsque vous êtes prêt.';reload.hidden=false;}
  }catch{if(section.isConnected)status.textContent='Vérification indisponible. Vérifiez votre connexion ou votre accès privé et réessayez.';}
  finally{check.disabled=false;}
 });
 section.append(title,current,check,status,reload,element('p','Aucune actualisation automatique pendant la préparation d’une séance.'));
 return section;
}

const ICONES = {
    suivi: 'M3 12h4l2.5-6 5 12 2.5-6H21',
    accueil: 'M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z',
    taiso: 'M3 10v4M6 8v8M18 8v8M21 10v4M6 12h12',
    judo: 'M3 10h18v4H3zM10 14l-3 6M14 14l3 6M10 10h4v4h-4z',
    seance: 'M8 4h8v3H8zM6 5.5H5a1 1 0 0 0-1 1V20a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V6.5a1 1 0 0 0-1-1h-1M8 12h8M8 16h5',
    presences: 'M9 11.5 11 13.5 15 9.5M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z',
    retour: 'M15 5l-7 7 7 7'
  };
const NAV_ICONS={home:'accueil',club:'presences',personal:'suivi',catalogue:'seance',legal:'seance',tests:'presences',stats:'suivi',accounts:'accounts',maintenance:'settings',settings:'settings'};
const EXTRA_ICONS={accounts:'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6M2 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6M22 20v-2a6 6 0 0 0-5-6',settings:'M4 6h16M4 12h16M4 18h16M8 4v4M16 10v4M10 16v4'};
function navIcon(key){
 const name=NAV_ICONS[key]||key,ns='http://www.w3.org/2000/svg';
 const svg=document.createElementNS(ns,'svg'),path=document.createElementNS(ns,'path');
 for(const [k,v] of Object.entries({viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'1.8','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false'}))svg.setAttribute(k,v);
 path.setAttribute('d',ICONES[name]||EXTRA_ICONS[name]||ICONES.seance);svg.append(path);return svg;
}
function workspaceTile(key,title,description){
 const icon=element('span');icon.className='bloc-ico';icon.append(navIcon(key));
 const name=element('strong',title);name.className='bloc-nom';
 const desc=element('small',description);desc.className='bloc-txt';
 return [icon,name,desc];
}


let disposeSwipe=null;
function resetSwipe(){
 workspace.removeAttribute('data-swipe-moving');
 workspace.style.removeProperty('--jsb-swipe-x');
 document.documentElement.removeAttribute('data-jsb-swipe-active');
}
function stopSwipe(){
 if(disposeSwipe){disposeSwipe();disposeSwipe=null;}
 resetSwipe();workspace.classList.remove('swipe-returned');
}
function protectSwipeEditor(editor){
 editor.dataset.swipeProtected='';
 for(const name of ['input','change','click'])editor.addEventListener(name,()=>{
  editor.dataset.swipeDirty='';
 },true);
}
function setWorkspaceView(...nodes){
 stopSwipe();workspace.replaceChildren(...nodes);
 const nav=workspace.querySelector('.jsb-nav');
 if(!nav||nav.querySelector('[aria-current="page"]')?.dataset.navPage==='home')return;
 const valid=()=>!busy&&session?.state==='signed-in'&&!workspace.hidden&&nav.isConnected&&workspace.contains(nav);
 const blocked=()=>Boolean(workspace.querySelector('[data-swipe-dirty]')||document.querySelector('[role="dialog"][aria-modal="true"]:not([hidden])')||(!accountTools.hidden&&!form.hidden)||document.activeElement?.matches('input,textarea,select,[contenteditable="true"]'));
 const reduced=()=>display.animations||matchMedia('(prefers-reduced-motion: reduce)').matches;
 disposeSwipe=window.JSBEdgeSwipe.attach({
  listenerTarget:document,
  getRoot:()=>document.querySelector('main'),
  getEnabled:valid,isBlocked:blocked,
  canGoBack:()=>Boolean(nav.querySelector('[data-nav-page="home"]')),
  ignoreSelector:window.JSBEdgeSwipe.IGNORE_SELECTOR+',label,summary,form,.account-tools,.jsb-nav,[data-swipe-protected]',
  onProgress:({distancePx})=>{
   if(reduced())return;
   document.documentElement.dataset.jsbSwipeActive='';
   workspace.dataset.swipeMoving='';
   workspace.style.setProperty('--jsb-swipe-x',Math.min(distancePx*.55,64)+'px');
  },
  onCancel:resetSwipe,
  onCommit:()=>{
   resetSwipe();
   if(!valid()||blocked())return;
   const back=workspace.querySelector('#settings-back');if(back)back.click();else nav.querySelector('[data-nav-page="home"]')?.click();
   if(!reduced())workspace.classList.add('swipe-returned');
  }
 });
}

async function ensureOfflineReader(){
 if(!navigator.serviceWorker||!window.caches)throw Error('Lecteur indisponible');
 await navigator.serviceWorker.register('/public/offline-sw.js',{scope:'/'});
 await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(Error('Lecteur indisponible')),10000))]);
 const paths=["/public/offline.html","/public/offline.mjs","/public/offline-vault.mjs","/public/attendance-vault.mjs","/public/attendance-ui.mjs","/shared/attendance-sync.js"],deadline=Date.now()+10000;
 while(Date.now()<deadline){
  if(await caches.has('jsb-manager-offline-reader-v3')){
   const cache=await caches.open('jsb-manager-offline-reader-v3');
   if((await Promise.all(paths.map(path=>cache.match(path)))).every(Boolean))return;
  }
  await new Promise(resolve=>setTimeout(resolve,200));
 }
 throw Error('Lecteur hors connexion non confirmé');
}
function renderWorkspace(){
 const account=session?.state==='signed-in'&&!busy&&!panel?session.account:null;
 const permitted=account&&['coach','individual'].includes(account.role);
 if(!permitted){
  stopSwipe();workspace.hidden=true;workspace.replaceChildren();workspaceIdentity=null;
  document.querySelector('main').classList.remove('has-session');return;
 }
 const identity=account.id+':'+account.role;
 workspace.hidden=false;document.querySelector('main').classList.add('has-session');
 if(workspaceIdentity===identity)return;
 workspaceIdentity=identity;
 const items=[...workspacePages.common,workspacePages[account.role]];
 function navigation(current){
  const nav=element('nav');nav.className='jsb-nav';nav.setAttribute('aria-label','Navigation principale');
  const shortLabels={home:'Accueil',judo:'Judo',taiso:'Taïso',club:'Club',personal:'Suivi',accounts:'Comptes',stats:'Statistiques',catalogue:'Catalogue',legal:'Documents',tests:'Tests',maintenance:'Maintenance',settings:'Réglages'};
  for(const key of ['home',...items.map(item=>item[0]),'settings']){
   const button=element('button');button.type='button';button.dataset.navPage=key;const text=element('span',shortLabels[key]||key);text.className='onglet-txt';button.append(navIcon(key),text);
   if(current===key)button.setAttribute('aria-current','page');
   button.addEventListener('click',()=>{
    if(busy||workspaceIdentity!==identity||key===current)return;
    if(key==='settings'){settings();return;}
    home(key==='home');
    if(key!=='home')workspace.querySelector('[data-workspace-page="'+key+'"]')?.click();
   });
   nav.append(button);
  }
  return nav;
 }
 function settings(section='menu'){
  if(busy||workspaceIdentity!==identity)return;
  settingsOpen=section==='account';changeOpen=false;
  clearSecrets();
  const groups=[['Général',[['general','Général','settings'],['display','Affichage et accessibilité','suivi'],['version','Version et mises à jour','seance']]],['Application',[['application','Réglages de l’application','settings'],['offline','Hors connexion','seance']]],['Compte',[['account','Compte et sécurité','accounts'],['legal','Conditions générales et confidentialité','legal']]]];
  const titles=Object.fromEntries(groups.flatMap(([,items])=>items.map(([id,title])=>[id,title])));
  const heading=element('h2',titles[section]||'Réglages');heading.tabIndex=-1;
  if(section==='menu'){
   const menu=element('div');menu.className='settings-menu';
   for(const [name,items] of groups){
    const group=element('section');group.className='settings-group';group.setAttribute('aria-label',name);
    const label=element('h3',name),list=element('div');list.className='settings-list';
    for(const [id,title,icon] of items){
     const button=element('button');button.type='button';button.className='settings-row';button.dataset.settingsPage=id;
     const tile=element('span');tile.className='settings-icon';tile.append(navIcon(icon));
     const text=element('span',title);text.className='settings-label';
     const chevron=element('span');chevron.className='settings-chevron';chevron.append(navIcon('retour'));
     button.append(tile,text,chevron);button.addEventListener('click',()=>settings(id));list.append(button);
    }
    group.append(label,list);menu.append(group);
   }
   setWorkspaceView(navigation('settings'),heading,menu);
  }else{
   const back=element('button','Réglages');back.type='button';back.id='settings-back';back.className='workspace-return settings-back';back.prepend(navIcon('retour'));back.addEventListener('click',()=>settings());
   const nodes=[navigation('settings'),back,heading];
   if(section==='display')nodes.push(displaySettings());
   else if(section==='version')nodes.push(versionSettings());
   else if(section==='general'){const panel=element('section');panel.append(element('p','Application V36 · préproduction privée.'),element('p','Interface à échelle fixe, navigation tactile et réglages d’affichage propres à cet appareil.'));nodes.push(panel);}
   else if(section==='application'){const panel=element('section');panel.append(element('p',"Les préférences de séance se règlent dans chaque discipline. Les fonctions métier disponibles dépendent du référentiel publié."));nodes.push(panel);}
   else if(section==='offline'){const panel=element('section'),link=element('a','Ouvrir le lecteur hors connexion');link.href='/public/offline.html';panel.append(element('p',hasVault()?'Un coffre chiffré est présent sur cet appareil.':'Aucun coffre chiffré enregistré.'),element('p','Pour préparer une séance hors ligne, utilisez la commande de la séance Taïso enregistrée. Le lecteur ne valide pas les droits de session.'),link);nodes.push(panel);}
   else if(section==='legal'){const panel=legalView({client,account,admin:false,live:()=>!busy&&workspaceIdentity===identity});protectSwipeEditor(panel);nodes.push(panel);}
   setWorkspaceView(...nodes);
  }
  accountTools.hidden=section!=='account';paint(status.textContent);
  window.scrollTo(0,0);heading.focus({preventScroll:true});
 }
 function home(focus=false){
  if(busy||workspaceIdentity!==identity)return;
  settingsOpen=false;changeOpen=false;
  accountTools.hidden=true;
  setWorkspaceView(navigation('home'));
  const heading=element('h2','Tableau de bord');heading.tabIndex=-1;
  const intro=element('div');intro.className='workspace-hero';intro.append(heading,element('p','Mon espace '+label(account.role)));workspace.append(intro);
  const summary=element('section');summary.className='workspace-overview';summary.setAttribute('aria-label','État des fonctionnalités');
  const heading2=element('h3','Catalogue et espaces');
  summary.append(element('strong','Préproduction privée'),element('p','Les catalogues publiés et les préparations Taïso sont accessibles selon leur disponibilité. Les autres fonctions restent à raccorder.'));workspace.append(summary,heading2);
  const grid=element('div');grid.className='workspace-grid blocs raccourcis';
  for(const [key,title,description,sections] of items){
   const button=element('button');button.type='button';button.dataset.workspacePage=key;
   if(key==='judo'||key==='taiso')button.dataset.discipline=key;
   button.className='bloc';button.append(...workspaceTile(key,title,description));
   button.addEventListener('click',()=>{
    if(busy||workspaceIdentity!==identity)return;
    const detail=element('div');detail.className='workspace-detail';
    const h=element('h3',title);h.tabIndex=-1;detail.append(h,element('p','Catalogue en lecture seule lorsque publié. Autres fonctionnalités à raccorder.'));
    const list=element('ul');for(const name of sections)list.append(element('li',name));detail.append(list);
    const back=element('button','Retour à l’accueil');back.type='button';back.id='workspace-back';back.className='workspace-return';back.prepend(navIcon('retour'));back.addEventListener('click',()=>home(true));detail.append(back);
    setWorkspaceView(navigation(key),detail);window.scrollTo(0,0);h.focus({preventScroll:true});
    if(key==='club'&&account.role==='coach'){
     const section=element('section');section.className='workspace-detail';section.setAttribute('aria-label','Présences');protectSwipeEditor(section);
     section.append(element('h3','Présences'),element('p','Registre privé du compte Coach. Préproduction : utilisez uniquement des données fictives.'));
     detail.insertBefore(section,list);
     const offline=element('a','Ouvrir le lecteur hors connexion');offline.href='/public/offline.html';section.append(offline);
     mountAttendance(section,{client,account,live:()=>!busy&&workspaceIdentity===identity&&section.isConnected,prepareOffline:ensureOfflineReader});
    }
    if(key==='judo'||key==='taiso'){
     const catalogue=element('p','Chargement du référentiel…');catalogue.setAttribute('role','status');detail.insertBefore(catalogue,list);
     void client.catalogue(key).then(async data=>{
      // Revalidate the identity after the asynchronous read. Never append a
      // previous account's response to a new workspace.
      const checked=await client.session();
      if(busy||workspaceIdentity!==identity||!detail.isConnected)return;
      if(checked.state!=='signed-in'||checked.account.id!==account.id||checked.account.role!==account.role){void refresh();return;}
      catalogue.textContent=data.state==='unpublished'?'Aucun catalogue publié pour cette discipline.':'Version '+data.version+' · '+data.count+' exercice(s)';
      if(key==='taiso'&&data.state==='published'){
       const preparation=element('section');preparation.className='workspace-detail';protectSwipeEditor(preparation);preparation.setAttribute('aria-label','Contrôle de compatibilité Taïso');
       preparation.append(element('h3','Préparer une séance Taïso'),element('p','Choisissez le format et vérifiez les exercices compatibles. Chaque proposition reste à valider avant utilisation.'));
       if(data.journaled!==true||typeof data.generation!=='string')preparation.append(element('p','Le catalogue actif n’est pas encore éligible à la préparation versionnée.'));
       else{
        const form=element('div');
        const makeSelect=(id,label,options,initial)=>{
         const l=element('label',label),s=element('select');s.id=id;l.htmlFor=id;
         for(const name of options){const option=element('option',name);option.value=name;s.append(option);}
         s.value=initial;form.append(l,s);return s;
        };
        const group=makeSelect('taiso-group','Groupe',['Gym douce','Training'],'Training');
        const level=makeSelect('taiso-level','Niveau maximal',['Débutant','Intermédiaire','Expert'],'Intermédiaire');
        const mode=makeSelect('taiso-mode','Mode de dosage',['Répétitions','Durée'],'Répétitions');
        const duration=makeSelect('taiso-duration','Durée totale (minutes)',['45','60','75','90'],'60');
        const format=makeSelect('taiso-format','Format',['Séries classiques','Circuit','EMOM','Tabata','AMRAP','Pilates / yoga','Mixte'],'Séries classiques');
        function makeCheck(id,label,checked=false){
         const row=element('div'),input=element('input'),l=element('label',label);input.type='checkbox';input.id=id;input.checked=checked;l.htmlFor=id;row.append(input,l);form.append(row);return input;
        }
        const configure=makeCheck('taiso-configure','Préciser l’organisation du corps de séance');
        const org=element('section');org.className='exercise-group';form.append(org);
        let settingsReader=()=>undefined;
        function rebuildOrganization(){
         org.replaceChildren();
         if(!configure.checked){settingsReader=()=>undefined;return;}
         function fields(kind,prefix){
          org.append(element('h4',kind));
          const controls=[];
          function number(key,label,min,max){
           const l=element('label',label),input=element('input');input.type='number';input.min=String(min);input.max=String(max);input.step='1';input.id=prefix+key;input.required=true;l.htmlFor=input.id;org.append(l,input);controls.push([key,input,min,max]);
          }
          if(['Circuit','EMOM','AMRAP'].includes(kind))number('stations','Nombre de stations',2,8);
          if(kind==='Circuit'||kind==='EMOM')number('rounds','Nombre de tours',1,kind==='Circuit'?6:10);
          if(kind==='Circuit'||kind==='Séries classiques'||kind==='Pilates / yoga'){
           if(kind!=='Circuit')number('series','Séries par exercice',1,8);
           number('recoverySeconds',kind==='Circuit'?'Récupération après chaque station (s)':'Récupération entre séries (s)',0,180);
           if(mode.value==='Répétitions')number('repWindowSeconds','Budget par passage en répétitions (s)',15,180);
           if(kind==='Circuit')number('roundRestSeconds','Pause entre tours (s)',0,180);
          }
          if(kind==='Tabata'){number('pairs','Nombre de paires d’exercices (8 intervalles par paire)',1,4);org.append(element('p','20 s d’effort / 10 s de récupération ; deux exercices alternés.'));}
          if(kind==='EMOM')org.append(element('p','Une station par minute. La récupération correspond au temps restant ; la faisabilité doit être vérifiée.'));
          if(kind==='AMRAP')number('limitMinutes','Durée maximale du bloc (min)',1,30);
          return ()=>{
           const out={};
           for(const [key,input,min,max] of controls){const n=Number(input.value);if(!input.value.trim()||!Number.isSafeInteger(n)||n<min||n>max)throw Error('Renseignez tous les paramètres dans les limites indiquées.');out[key]=n;}
           if(mode.value==='Durée'&&['Circuit','Séries classiques','Pilates / yoga'].includes(kind))out.repWindowSeconds=null;
           return out;
          };
         }
         if(format.value==='Mixte'){const circuit=fields('Circuit','taiso-circuit-'),pilates=fields('Pilates / yoga','taiso-pilates-');settingsReader=()=>({circuit:circuit(),pilates:pilates()});}
         else settingsReader=fields(format.value,'taiso-org-');
         org.append(element('p','Ces réglages organisent le bloc ; ils ne modifient pas le dosage source. Le coach doit vérifier leur compatibilité.'));
        }
        function refreshFormats(){
         const previous=format.value;
         const allowed=['Séries classiques','Circuit','EMOM','Tabata','AMRAP','Pilates / yoga','Mixte'].filter(f=>!(group.value==='Gym douce'&&['Tabata','AMRAP'].includes(f))&&!(mode.value==='Répétitions'&&f==='Tabata')&&!(mode.value==='Durée'&&['EMOM','AMRAP'].includes(f)));
         format.replaceChildren();
         for(const name of allowed){const option=element('option',name);option.value=name;format.append(option);}
         format.value=allowed.includes(previous)?previous:allowed[0];rebuildOrganization();
        }
        group.addEventListener('change',refreshFormats);mode.addEventListener('change',refreshFormats);
        format.addEventListener('change',rebuildOrganization);configure.addEventListener('change',rebuildOrganization);
        refreshFormats();
        const noEquipment=makeCheck('taiso-no-equipment','Sans matériel (poids du corps et tatami)',true);
        const equipmentLabel=element('label','Matériel disponible (séparer par des points-virgules)'),equipment=element('input');equipment.id='taiso-equipment';equipmentLabel.htmlFor=equipment.id;equipment.maxLength=1000;equipment.disabled=true;
        form.append(equipmentLabel,equipment);
        const partner=makeCheck('taiso-partner','Travail en binôme autorisé');
        const supervision=makeCheck('taiso-supervision','Encadrement présent');
        form.append(element('h4','Contraintes à prendre en compte'));
        const restrictions=['Genoux','Dos','Épaules','Poignets','Sauts','Passage au sol'].map((name,i)=>[name,makeCheck('taiso-constraint-'+i,name)]);
        const check=element('button','Vérifier les exercices compatibles');check.type='button';
        const generate=element('button','Proposer une séance');generate.type='button';
        const result=element('div');result.id='taiso-candidate-result';result.setAttribute('role','status');
        let requestId=0,savedDraft=null;
        const live=()=>!busy&&workspaceIdentity===identity&&preparation.isConnected;
        form.addEventListener('change',event=>{if(result.contains(event.target))return;requestId++;equipment.disabled=noEquipment.checked;if(noEquipment.checked)equipment.value='';level.disabled=group.value==='Gym douce';if(level.disabled)level.value='Débutant';result.replaceChildren();check.disabled=generate.disabled=false;});
        form.addEventListener('input',event=>{if(result.contains(event.target))return;requestId++;result.replaceChildren();check.disabled=generate.disabled=false;});

        const library=element('section');library.className='workspace-detail';
        const libraryStatus=element('div');libraryStatus.setAttribute('role','status');libraryStatus.id='taiso-saved-list';
        const showSaved=element('button','Mes brouillons Taïso');showSaved.type='button';
        const newDraft=element('button','Nouvelle séance');newDraft.type='button';
        const editing=element('p','Nouvelle séance');editing.id='taiso-editing';
        let libraryRun=0;
        function draftError(response){
         if(response.state==='account-changed'){void refresh();return 'Compte modifié.';}
         if(response.state==='conflict')return 'Brouillon ou catalogue modifié. Rechargez la liste avant de réessayer.';
         if(response.state==='rate-limited')return 'Trop de demandes. Réessayez plus tard.';
         return 'Opération non confirmée. Rechargez la liste.';
        }
        async function editProposal(answer,planSettings,operation){
         if(!live()||!result.isConnected)return;
         const edits=[...(planSettings.edits||[]),operation];
         if(edits.length>60)return;
         const run=++requestId;
         const titleBefore=result.querySelector('#taiso-draft-title')?.value??'';
         const controls=[...result.querySelectorAll('button,input,select')];
         controls.forEach(c=>c.disabled=true);
         check.disabled=generate.disabled=true;
         const notice=element('p','Vérification de la modification…');notice.setAttribute('role','status');result.append(notice);
         try{
          const nextSettings={...planSettings,edits};
          const next=await client.taisoDraft(nextSettings);
          const current=await client.session();
          if(!live()||run!==requestId)return;
          if(current.state!=='signed-in'||current.account.id!==account.id||current.account.role!==account.role){void refresh();return;}
          if(next.state!=='ready'){renderProposal(answer,planSettings,false);result.append(element('p','Modification non appliquée. Vérifiez le catalogue et réessayez.'));return;}
          renderProposal(next,nextSettings,false);
          result.append(element('p','Modification appliquée au brouillon en cours. Enregistrez pour la conserver.'));
         }catch{
          if(live()&&run===requestId){renderProposal(answer,planSettings,false);result.append(element('p','Modification refusée ou indisponible. La proposition précédente est conservée.'));}
         }finally{
          if(live()&&run===requestId){
           check.disabled=generate.disabled=false;
           const title=result.querySelector('#taiso-draft-title');
           if(title){title.value=titleBefore;title.dispatchEvent(new Event('input',{bubbles:true}));}
          }
         }
        }
        function renderProposal(answer,planSettings,loaded){
           result.replaceChildren(element('h4','Proposition à valider · '+answer.minutes+' min'),element('p',answer.format+' · '+answer.mode+' · catalogue '+answer.version));
           if(answer.missing.length)result.append(element('p','Couverture insuffisante : '+answer.missing.join(' ; ')+'. Aucun exercice manquant n’a été inventé.'));
           for(const phase of answer.phases){
            const section=element('section');section.className='exercise-group';
            section.append(element('h4',phase.name+' · '+phase.minutes+' min'));
            for(const block of phase.blocks){
             const o=block.organization;
             section.append(element('h5',block.name+' · '+block.references.length+' exercice(s)'),element('p','Budget : '+o.budgetSeconds+' s'));
             if(o.plannedSeconds!==null)section.append(element('p','Organisation prévue : '+o.plannedSeconds+' s · '+(o.remainingSeconds<0?'Dépassement : '+(-o.remainingSeconds):'Temps restant : '+o.remainingSeconds)+' s'));
             const messages={'organization-not-configured':'Paramètres à renseigner','insufficient-stations':'Nombre de stations insuffisant','incompatible-tabata-prescription':'Prescription Tabata incompatible','budget-exceeded':'Budget du bloc dépassé'};
             for(const issue of o.issues)section.append(element('p',messages[issue]||'Organisation à vérifier'));
            }
            for(const e of phase.exercises){
             section.append(element('h5',e.name),element('p','Budget indicatif : '+e.allocationMinutes+' min'),element('p','Prescription sélectionnée : '+(answer.mode==='Durée'?e.prescription.effortSeconds+' s d’effort':e.prescription.repetitions+' répétitions')),element('p','Dosage source : '+e.dosage),element('p','Sécurité : '+e.safety));
             const actions=element('div');actions.className='exercise-group';
             const block=phase.blocks.find(b=>b.references.includes(e.reference));
             const order=block?block.references:phase.exercises.map(x=>x.reference),position=order.indexOf(e.reference);
             const limit=(planSettings.edits||[]).length>=60;
             const modify=(action,replacement)=>void editProposal(answer,planSettings,{action,phase:phase.name,reference:e.reference,...(replacement?{replacement}:{})});
             const up=element('button','Monter');up.type='button';up.disabled=limit||position<=0;up.setAttribute('aria-label','Monter '+e.name);
             const down=element('button','Descendre');down.type='button';down.disabled=limit||position<0||position>=order.length-1;down.setAttribute('aria-label','Descendre '+e.name);
             const remove=element('button','Retirer');remove.type='button';remove.disabled=limit;remove.setAttribute('aria-label','Retirer '+e.name);
             up.addEventListener('click',()=>modify('up'));down.addEventListener('click',()=>modify('down'));remove.addEventListener('click',()=>modify('remove'));
             actions.append(up,down,remove);
             if(block?.alternatives?.length){
              const chooser=element('select');chooser.setAttribute('aria-label','Remplacement de '+e.name);
              const placeholder=element('option','Choisir une alternative');placeholder.value='';chooser.append(placeholder);
              for(const candidate of block.alternatives){const option=element('option',candidate.name);option.value=candidate.reference;chooser.append(option);}
              const replace=element('button','Remplacer');replace.type='button';replace.disabled=true;chooser.disabled=limit;
              chooser.addEventListener('change',()=>{replace.disabled=limit||!chooser.value;});
              replace.addEventListener('click',()=>{if(chooser.value)modify('replace',chooser.value);});
              actions.append(chooser,replace);
             }
             section.append(actions);
            }
            if(phase.unallocatedMinutes)section.append(element('p',phase.unallocatedMinutes+' min non attribuées — à organiser.'));
            result.append(section);
           }
           if(answer.organizationPending)result.append(element('p','Organisation incomplète : ajustez les paramètres ou la sélection.'));
           result.append(element('p','Les budgets ne sont pas des chronomètres. Vérifiez les séries, récupérations et adaptations avant utilisation. '+(loaded?'Brouillon enregistré, non validé.':'Aucune séance n’est encore enregistrée.')));
         const titleLabel=element('label','Nom du brouillon'),title=element('input');title.id='taiso-draft-title';titleLabel.htmlFor=title.id;title.maxLength=120;title.value=savedDraft?.title??'';
         const save=element('button',savedDraft?'Enregistrer les modifications':'Enregistrer le brouillon');save.type='button';
         const feedback=element('p');feedback.id='taiso-save-status';
         const run=requestId,target=savedDraft;
         const eligible=()=>{save.disabled=!title.value.trim()||title.value.trim().length>120;};
         eligible();title.addEventListener('input',eligible);
         save.addEventListener('click',async()=>{
          if(!live()||run!==requestId||save.disabled||!save.isConnected)return;
          save.disabled=true;
          try{
           const response=await client.privateTaisoDraft('save',account.id,{title:title.value.trim(),settings:planSettings,...(target?{id:target.id,revision:savedDraft?.revision??target.revision}:{})});
           if(!live()||run!==requestId)return;
           if(response.state!=='ready'){feedback.textContent=draftError(response);return;}
           savedDraft={...response.saved,settings:planSettings};editing.textContent='Brouillon : '+savedDraft.title+' · révision '+savedDraft.revision;
           feedback.textContent='Brouillon enregistré. Révision '+savedDraft.revision+'.';
           save.textContent='Enregistrer les modifications';
           // Re-render so a subsequent save updates the same new id.
           renderProposal(answer,planSettings,true);
           const status=result.querySelector('#taiso-save-status');if(status)status.textContent='Brouillon enregistré. Révision '+savedDraft.revision+'.';
           libraryRun++;libraryStatus.replaceChildren();
          }catch{if(live()&&run===requestId)feedback.textContent='Sauvegarde non confirmée. Consultez la liste avant de réessayer.';}
          finally{if(live()&&run===requestId&&save.isConnected)eligible();}
         });
         result.append(titleLabel,title,save,feedback);
         if(loaded&&savedDraft){
          const stored=savedDraft,tools=element('section');tools.className='exercise-group';
          tools.append(element('h4','Séance enregistrée'),element('p',stored.validatedAt?'Validation déclarée — révision '+stored.revision:'Brouillon non validé — révision '+stored.revision));
          const complete=answer.missing.length===0&&answer.organizationPending===false&&answer.phases.every(p=>p.exercises.length>0&&p.unallocatedMinutes===0)&&answer.phases[2].blocks.length>0&&answer.phases[2].blocks.every(b=>b.organization.state==='budgeted');
          const message=element('p');message.id='taiso-validation-status';message.setAttribute('role','status');
          if(!complete)tools.append(element('p','Validation indisponible : complétez les phases et l’organisation.'));
          else if(!stored.validatedAt){
           const att=element('input');att.type='checkbox';att.id='taiso-review-confirm';
           const label=element('label','Je confirme avoir contrôlé les exercices, les prescriptions, la sécurité et l’organisation.');label.htmlFor=att.id;
           const validate=element('button','Valider la séance');validate.type='button';validate.disabled=true;
           att.addEventListener('change',()=>{validate.disabled=!att.checked;});
           validate.addEventListener('click',async()=>{
            if(!live()||run!==requestId||!att.checked||validate.disabled)return;
            validate.disabled=att.disabled=true;
            try{
             const response=await client.privateTaisoDraft('validate',account.id,{id:stored.id,revision:stored.revision,confirmed:true});
             if(!live()||run!==requestId)return;
             if(response.state!=='ready'){message.textContent=draftError(response);return;}
             savedDraft={...response.saved,settings:planSettings};editing.textContent='Séance : '+savedDraft.title+' · révision '+savedDraft.revision;
             renderProposal(answer,planSettings,true);
            }catch{if(live()&&run===requestId)message.textContent='Validation non confirmée. Rechargez la séance.';}
            finally{if(live()&&run===requestId&&validate.isConnected){att.disabled=false;validate.disabled=!att.checked;}}
           });
           tools.append(att,label,validate);
          }
          function downloadFile(blob,filename){
           const url=URL.createObjectURL(blob),link=element('a');link.href=url;link.download=filename;
           document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);
          }
          for(const [mode,label] of [['detaille','Télécharger le PDF détaillé'],['synthetique','Télécharger le PDF synthétique']]){
           const button=element('button',label);button.type='button';
           button.addEventListener('click',async()=>{
            if(!live()||run!==requestId||button.disabled)return;
            button.disabled=true;
            try{
             const response=await client.privateTaisoDraft('pdf',account.id,{id:stored.id,revision:stored.revision,mode});
             if(!live()||run!==requestId)return;
             if(response.state!=='ready'){message.textContent=draftError(response);return;}
             const bytes=Uint8Array.from(atob(response.pdf),c=>c.charCodeAt(0));
             downloadFile(new Blob([bytes],{type:'application/pdf'}),'JSB-Taiso-r'+stored.revision+'-'+mode+'.pdf');
             message.textContent='Téléchargement lancé. Conservez le PDF sur cet appareil pour le consulter hors connexion.';
            }catch{if(live()&&run===requestId)message.textContent='Export non confirmé. Réessayez en ligne.';}
            finally{if(live()&&run===requestId)button.disabled=false;}
           });
           tools.append(button);
          }

          const offlinePassword=element('input');offlinePassword.type='password';offlinePassword.id='taiso-offline-password';offlinePassword.minLength=12;offlinePassword.maxLength=256;offlinePassword.autocomplete='new-password';
          const offlineLabel=element('label','Phrase secrète du coffre local (12 caractères minimum)');offlineLabel.htmlFor=offlinePassword.id;
          const offline=element('button','Préparer hors connexion');offline.type='button';
          offline.addEventListener('click',async()=>{
           if(!live()||run!==requestId||offline.disabled)return;
           offline.disabled=true;
           const phrase=offlinePassword.value;offlinePassword.value='';
           try{
            if(phrase.length<12)throw Error('Phrase secrète trop courte.');
            if(hasVault()){message.textContent='Un coffre existe déjà sur cet appareil. Ouvrez le lecteur pour le reprendre ou l’effacer.';return;}
            const response=await client.privateTaisoDraft('read',account.id,{id:stored.id});
            if(!live()||run!==requestId)return;
            if(response.state!=='ready'||response.draft.revision!==stored.revision){message.textContent='Révision modifiée. Rechargez la séance.';return;}
            const q=response.draft,d=q.snapshot;
            const copy={schema:'JSB-TAISO-OFFLINE-1',draftId:q.id,generation:q.generation,baseEditCount:(q.settings.edits||[]).length,title:q.title,version:q.version,revision:q.revision,minutes:d.minutes,format:d.format,mode:d.mode,status:q.stale?'Catalogue ancien à revérifier':q.validatedAt?'Validation déclarée à l’export':'Brouillon non validé',missing:d.missing,
             phases:d.phases.map(p=>({name:p.name,minutes:p.minutes,unallocatedMinutes:p.unallocatedMinutes,exercises:p.exercises.map(e=>({reference:e.reference,name:e.name,allocationMinutes:e.allocationMinutes,dosage:e.dosage,safety:e.safety,prescription:e.prescription,...Object.fromEntries(['description','successCriteria','easier','harder','equipment','accessibility'].filter(k=>typeof e[k]==='string').map(k=>[k,e[k]]))})),blocks:p.blocks.map(b=>({name:b.name,references:b.references,budgetSeconds:b.organization.budgetSeconds,plannedSeconds:b.organization.plannedSeconds,issues:b.organization.issues}))}))};
            const data=new Blob([JSON.stringify(copy)],{type:'application/json'});
            if(data.size>524288)throw Error('Copie trop volumineuse');
            await ensureOfflineReader();
            if(!live()||run!==requestId)return;
            const accountNow=await client.session();
            if(!live()||run!==requestId)return;
            if(accountNow.state!=='signed-in'||accountNow.account.id!==account.id||accountNow.account.role!==account.role){void refresh();return;}
            await createVault(phrase,String(account.id),copy,()=>live()&&run===requestId);
            if(live()&&run===requestId)message.textContent='Séance chiffrée enregistrée sur cet appareil. Ouvrez le lecteur hors connexion avec votre phrase secrète.';
           }catch{if(live()&&run===requestId)message.textContent='Préparation hors connexion non confirmée. Utilisez le PDF téléchargé ou réessayez en ligne.';}
           finally{if(live()&&run===requestId)offline.disabled=false;}
          });
          const local=element('a','Ouvrir le lecteur hors connexion');local.href='/public/offline.html';
          tools.append(element('p','Une séance par appareil dans le coffre chiffré, accessible hors connexion avec une phrase secrète distincte. Ne mettez pas de données de pratiquants dans le titre. La copie reste disponible après déconnexion et ne constitue pas une session authentifiée.'),offlineLabel,offlinePassword,offline,local);
          tools.append(element('p','Le PDF est une copie de la révision enregistrée. Il reste lisible hors ligne mais ne s’actualise pas automatiquement.'),message);
          result.append(tools);
         }
        }
        function restoreSettings(q){
         const c=q.criteria;
         group.value=c.groupe;mode.value=c.mode;refreshFormats();
         level.value=c.niveau;level.disabled=group.value==='Gym douce';if(level.disabled)level.value='Débutant';
         duration.value=String(q.minutes);format.value=q.format??'Séries classiques';
         noEquipment.checked=c.sansMateriel;equipment.disabled=c.sansMateriel;equipment.value=c.materiel.join('; ');
         partner.checked=c.binome;supervision.checked=c.supervision;
         for(const [name,input] of restrictions)input.checked=c.contraintes.includes(name);
         configure.checked=!!q.organization;rebuildOrganization();
         const fill=(prefix,values)=>{for(const [key,value] of Object.entries(values||{})){const input=org.querySelector('#'+prefix+key);if(input&&value!==null)input.value=String(value);}};
         if(format.value==='Mixte'){fill('taiso-circuit-',q.organization?.circuit);fill('taiso-pilates-',q.organization?.pilates);}
         else fill('taiso-org-',q.organization);
        }
        async function listDrafts(offset=0){
         if(!live())return;
         const run=++libraryRun;showSaved.disabled=true;libraryStatus.textContent='Chargement…';
         try{
          const response=await client.privateTaisoDraft('list',account.id,{offset});
          if(!live()||run!==libraryRun)return;
          if(response.state!=='ready'){libraryStatus.textContent=draftError(response);return;}
          libraryStatus.replaceChildren(element('p',response.total+' brouillon(s) privé(s)'));
          for(const d of response.items){
           const entry=element('section');entry.className='exercise-group';
           const open=element('button','Reprendre '+d.title);open.type='button';
           entry.append(element('h4',d.title),element('p','Révision '+d.revision+' · catalogue '+d.version),open);
           open.addEventListener('click',async()=>{
            if(!live()||run!==libraryRun)return;
            const editingRun=++requestId;open.disabled=true;
            try{
             const read=await client.privateTaisoDraft('read',account.id,{id:d.id});
             if(!live()||run!==libraryRun||editingRun!==requestId)return;
             if(read.state!=='ready'){libraryStatus.textContent=draftError(read);return;}
             const q=read.draft;savedDraft=q;restoreSettings(q.settings);editing.textContent='Brouillon : '+q.title+' · révision '+q.revision;
             if(q.stale||q.version!==data.version||q.generation!==data.generation){
              result.replaceChildren(element('p','Catalogue modifié depuis l’enregistrement. Les réglages sont repris ; générez une nouvelle proposition avant de sauvegarder.'));
             }else renderProposal(q.snapshot,q.settings,true);
             check.disabled=generate.disabled=false;
            }catch{if(live()&&editingRun===requestId)result.textContent='Reprise indisponible.';}
            finally{if(live()&&open.isConnected)open.disabled=false;}
           });
           libraryStatus.append(entry);
          }
          if(offset>0||offset+30<response.total){
           const prev=element('button','Précédent'),next=element('button','Suivant');prev.type=next.type='button';prev.disabled=offset===0;next.disabled=offset+30>=response.total;
           prev.addEventListener('click',()=>void listDrafts(Math.max(0,offset-30)));next.addEventListener('click',()=>void listDrafts(offset+30));libraryStatus.append(prev,next);
          }
         }catch{if(live()&&run===libraryRun)libraryStatus.textContent='Liste indisponible.';}
         finally{if(live()&&run===libraryRun)showSaved.disabled=false;}
        }
        showSaved.addEventListener('click',()=>void listDrafts());
        newDraft.addEventListener('click',()=>{if(!live())return;requestId++;libraryRun++;savedDraft=null;editing.textContent='Nouvelle séance';result.replaceChildren();libraryStatus.replaceChildren();check.disabled=generate.disabled=showSaved.disabled=false;});

        const importLabel=element('label','Reprendre des modifications hors connexion'),importFile=element('input');importFile.id='taiso-import-offline';importFile.type='file';importFile.accept='.json,application/json';importLabel.htmlFor=importFile.id;
        const importStatus=element('p');importStatus.id='taiso-import-status';importStatus.setAttribute('role','status');
        async function reviewOfflinePatch(load){
         if(!live()||importFile.disabled)return;
         const run=++requestId;
         importFile.disabled=true;check.disabled=generate.disabled=true;importStatus.textContent='Contrôle des modifications locales…';
         try{
          const patch=await load();
          if(!patch||patch.schema!=='JSB-TAISO-EDITS-1'||typeof patch.draftId!=='string'||!/^[a-f0-9]{32}$/.test(patch.draftId)||
           !Number.isSafeInteger(patch.revision)||patch.revision<1||typeof patch.version!=='string'||typeof patch.generation!=='string'||!Number.isSafeInteger(patch.baseEditCount)||patch.baseEditCount<0||
           !Array.isArray(patch.edits)||!patch.edits.length||patch.baseEditCount+patch.edits.length>60||
           patch.edits.some(e=>!e||typeof e!=='object'||Array.isArray(e)||Object.keys(e).length!==3||!['up','down','remove'].includes(e.action)||typeof e.phase!=='string'||e.phase.length>100||typeof e.reference!=='string'||e.reference.length>80))throw Error('Fichier de modifications non conforme.');
          const response=await client.privateTaisoDraft('read',account.id,{id:patch.draftId});
          if(!live()||run!==requestId)return;
          if(response.state!=='ready'){importStatus.textContent=draftError(response);return;}
          const q=response.draft;
          if(q.stale||q.revision!==patch.revision||q.version!==patch.version||q.generation!==patch.generation||q.version!==data.version||q.generation!==data.generation||(q.settings.edits||[]).length!==patch.baseEditCount){
           importStatus.textContent='Le brouillon ou le catalogue a changé. Aucun écrasement effectué. Conservez votre fichier pour une reprise manuelle.';return;
          }
          const nextSettings={...q.settings,edits:[...(q.settings.edits||[]),...patch.edits]};
          const next=await client.taisoDraft(nextSettings);
          const current=await client.session();
          if(!live()||run!==requestId)return;
          if(current.state!=='signed-in'||current.account.id!==account.id||current.account.role!==account.role){void refresh();return;}
          if(next.state!=='ready'){importStatus.textContent='Modifications non acceptées par le référentiel actif.';return;}
          savedDraft=q;restoreSettings(q.settings);editing.textContent='Brouillon : '+q.title+' · révision '+q.revision;
          renderProposal(next,nextSettings,false);
          importStatus.textContent='Modifications locales vérifiées. Enregistrez les modifications pour les conserver sur le serveur.';
         }catch(e){if(live()&&run===requestId)importStatus.textContent='Import refusé ou indisponible. Aucun changement enregistré.';}
         finally{if(live()){importFile.disabled=false;importFile.value='';if(run===requestId)check.disabled=generate.disabled=false;}}
        }
        importFile.addEventListener('change',()=>{const file=importFile.files?.[0];if(file)void reviewOfflinePatch(async()=>{if(file.size>65536)throw Error('Fichier trop volumineux.');return JSON.parse(await file.text());});});
        const vaultLabel=element('label','Phrase secrète du coffre local'),vaultPassword=element('input');vaultPassword.id='taiso-vault-password';vaultLabel.htmlFor=vaultPassword.id;vaultPassword.type='password';vaultPassword.maxLength=256;vaultPassword.autocomplete='off';
        const resumeVault=element('button','Reprendre le coffre hors connexion');resumeVault.type='button';
        resumeVault.addEventListener('click',()=>{
         const phrase=vaultPassword.value;vaultPassword.value='';
         void reviewOfflinePatch(async()=>{
          const vault=await openVault(phrase);
          try{if(vault.value.owner!==String(account.id))throw Error('Compte différent.');return vaultPatch(vault.value);}finally{vault.close();}
         });
        });
        library.append(element('h3','Suivi et reprise'),showSaved,newDraft,editing,libraryStatus,importLabel,importFile,vaultLabel,vaultPassword,resumeVault,importStatus);
        async function prepareDraft(isDraft){
         if(!live()||check.disabled||generate.disabled)return;
         const run=++requestId;
         const criteria={groupe:group.value,niveau:level.value,mode:mode.value,supervision:supervision.checked,binome:partner.checked,sansMateriel:noEquipment.checked,materiel:noEquipment.checked?[]:equipment.value.split(';').map(x=>x.trim()).filter(Boolean),contraintes:restrictions.filter(([,input])=>input.checked).map(([name])=>name)};
         if(!criteria.sansMateriel&&!criteria.materiel.length){result.textContent='Renseignez le matériel disponible ou choisissez Sans matériel.';return;}
         let organization;
         if(isDraft){try{organization=settingsReader();}catch(e){result.textContent=e.message;return;}}
         check.disabled=generate.disabled=true;result.textContent=isDraft?'Préparation en cours…':'Vérification en cours…';
         try{
          const options={version:data.version,generation:data.generation,criteria};
          const planSettings={...options,minutes:Number(duration.value),format:format.value,organization,seed:savedDraft?.settings?.seed??(1+crypto.getRandomValues(new Uint32Array(1))[0]%2147483646)};
          const answer=isDraft?await client.taisoDraft(planSettings):await client.taisoCandidates(options);
          const accountNow=await client.session();
          if(!live()||run!==requestId)return;
          if(accountNow.state!=='signed-in'||accountNow.account.id!==account.id||accountNow.account.role!==account.role){void refresh();return;}
          if(answer.state==='version-changed'){result.textContent='Le référentiel a changé. Revenez à l’accueil puis rouvrez le Taïso.';return;}
          if(answer.state==='rate-limited'){result.textContent='Trop de vérifications. Réessayez plus tard.';return;}
          if(isDraft){
           renderProposal(answer,planSettings,false);
           return;
          }
          result.replaceChildren(element('p',answer.total+' exercice(s) compatible(s) · '+answer.excluded+' non retenu(s).'));
          if(answer.items.length){
           const ul=element('ul');for(const item of answer.items)ul.append(element('li',item.name+' · '+item.dosage));result.append(ul);
           if(answer.total>answer.items.length)result.append(element('p','Aperçu limité aux 30 premières fiches compatibles.'));
          }
          result.append(element('p','La compatibilité technique ne remplace pas l’appréciation pédagogique du coach.'));
         }catch{if(live()&&run===requestId)result.textContent='Vérification indisponible. Contrôlez votre session et le référentiel.';}
         finally{if(live()&&run===requestId)check.disabled=generate.disabled=false;}
        }
        check.addEventListener('click',()=>void prepareDraft(false));
        generate.addEventListener('click',()=>void prepareDraft(true));
        form.append(check,generate,result);preparation.append(library,form);
       }
       detail.insertBefore(preparation,list);
      }
      if(data.state==='published'){
       const browser=element('section');browser.className='workspace-detail';browser.setAttribute('aria-label','Catalogue '+title);
       const heading=element('h3','Exercices');browser.append(heading);
       const queryLabel=element('label','Rechercher par nom ou référence'),query=element('input');query.id='catalogue-query';query.type='search';query.maxLength=120;queryLabel.htmlFor=query.id;
       const familyLabel=element('label','Famille'),family=element('select');family.id='catalogue-family';familyLabel.htmlFor=family.id;
       const all=element('option','Toutes les familles');all.value='';family.append(all);
       for(const f of data.families){const opt=element('option',f.family+' ('+f.count+')');opt.value=f.family;family.append(opt);}
       const search=element('button','Rechercher');search.type='button';
       const results=element('div');results.id='catalogue-results';
       const info=element('p');info.setAttribute('role','status');
       const previous=element('button','Précédent'),next=element('button','Suivant');previous.type=next.type='button';previous.hidden=next.hidden=true;
       browser.append(queryLabel,query,familyLabel,family,search,info,results,previous,next);detail.insertBefore(browser,list);
       let generation=0,offset=0,criteria={query:'',family:''};
       const live=()=>!busy&&workspaceIdentity===identity&&browser.isConnected;
       async function load(page){
        if(!live())return;
        const run=++generation;results.replaceChildren();info.textContent='Recherche…';previous.hidden=next.hidden=true;
        try{
         const result=await client.searchCatalogue(key,{version:data.version,...criteria,offset:page});
         const confirmed=await client.session();
         if(!live()||run!==generation)return;
         if(confirmed.state!=='signed-in'||confirmed.account.id!==account.id||confirmed.account.role!==account.role){void refresh();return;}
         if(result.state==='version-changed'){info.textContent='Le catalogue a changé. Revenez à l’accueil et ouvrez à nouveau la discipline.';search.disabled=true;query.disabled=true;family.disabled=true;return;}
         offset=page;info.textContent=result.total?((page+1)+'–'+(page+result.items.length)+' sur '+result.total+' exercice(s)'):'Aucun exercice correspondant.';
         for(const item of result.items){
          const card=element('details');card.className='catalogue-item';
          card.append(element('summary',item.name),element('p','Référence : '+item.reference),element('p','Famille : '+item.family));
          const sheet=element('div');sheet.className='exercise-sheet';card.append(sheet);
          let detailRun=0;
          card.addEventListener('toggle',async()=>{
           const requestId=++detailRun;sheet.replaceChildren();
           if(!card.open||!live()||run!==generation)return;
           const valid=()=>live()&&run===generation&&requestId===detailRun&&card.open&&card.isConnected;
           const message=element('p','Chargement de la fiche…');message.setAttribute('role','status');sheet.append(message);
           try{
            const exercise=await client.exerciseDetail(key,{version:data.version,reference:item.reference});
            const checked=await client.session();
            if(!valid())return;
            if(checked.state!=='signed-in'||checked.account.id!==account.id||checked.account.role!==account.role){void refresh();return;}
            if(exercise.state==='version-changed'){message.textContent='Version modifiée. Rouvrez le catalogue.';return;}
            if(exercise.state==='not-found'){message.textContent='Fiche indisponible.';return;}
            if(exercise.state==='summary'){message.textContent='Fiche synthétique uniquement. Contenu pédagogique complet non disponible.';return;}
            sheet.replaceChildren();
            const groups=[
             ['Sécurité et dosage',[['safety','Point de sécurité'],['dosage','Dosage de base'],['successCriteria','Critère de réussite'],...([['dosageMode','Mode de dosage'],['effortSeconds','Durée d’effort (s)'],['repetitions','Répétitions'],['repetitionsMax','Répétitions max par judoka'],['restrictions','Restrictions d’utilisation']].filter(([field])=>Object.hasOwn(exercise.details,field)))]],
             ...(Object.hasOwn(exercise.details,'executionDescription')?[['Exécution',[['executionDescription','Description du mouvement'],...([['objective','Objectif']].filter(([field])=>Object.hasOwn(exercise.details,field)))]]]:[]),
             ...(key==='judo'?[['Pédagogie Judo',[['competence','Compétence ciblée'],['pedagogicalRole','Rôle pédagogique'],['prerequisites','Prérequis'],['opposition','Niveau d’opposition'],['organization','Organisation Tori / Uke, rotations et récupération'],['blockDuration','Durée du bloc'],...([['ageCategory','Catégories d’âge'],['grade','Grade']].filter(([field])=>Object.hasOwn(exercise.details,field)))]]]:[]),
             ['Caractéristiques',[['level','Niveau'],['subgroup','Sous-groupe'],['equipment','Matériel'],...(key==='taiso'?[['targetMuscles','Muscles cibles']]:[]),['moment','Moment de la séance'],['format','Format'],...([['subfamily','Sous-famille'],['classification','Catégorie'],['sheetType','Type de fiche'],['tagsText','Tags (source)'],['tags','Tags']].filter(([field])=>Object.hasOwn(exercise.details,field)))]],
             ['Adaptations',[['easier','Variante −'],['harder','Variante +'],['accessibility','Accessibilité'],['inspiration','Inspiration']]]
            ];
            for(const [name,fields] of groups){
             const group=element('section');group.className='exercise-group';group.append(element('h4',name));
             const dl=element('dl');for(const [field,label] of fields){dl.append(element('dt',label),element('dd',Array.isArray(exercise.details[field])?(exercise.details[field].length?exercise.details[field].join(' · '):'Aucun tag'):exercise.details[field]));}
             group.append(dl);sheet.append(group);
            }
           }catch{if(valid())message.textContent='Fiche indisponible. Fermez puis rouvrez la fiche pour réessayer.';}
          });
          results.append(card);
         }
         previous.hidden=offset===0;next.hidden=offset+30>=result.total;
        }catch{if(live()&&run===generation)info.textContent='Recherche indisponible. Réessayez ou vérifiez votre session.';}
       }
       function filter(){criteria={query:query.value.trim(),family:family.value};void load(0);}
       search.addEventListener('click',filter);family.addEventListener('change',filter);query.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();filter();}});
       previous.addEventListener('click',()=>void load(Math.max(0,offset-30)));next.addEventListener('click',()=>void load(offset+30));void load(0);
      }
     }).catch(()=>{if(!busy&&workspaceIdentity===identity&&detail.isConnected)catalogue.textContent='Référentiel indisponible. Vérifiez votre session.';});
    }
   });grid.append(button);
  }
  workspace.append(grid);window.scrollTo(0,0);if(focus)heading.focus({preventScroll:true});
 }
 home();
}

function paint(message){
 renderWorkspace();
 const entry=document.querySelector('#legal-entry');
 const visible=session?.state!=='signed-in';entry.hidden=!visible;
 if(!visible){entry.open=false;entry.querySelector('.legal-entry-content').replaceChildren();}
 const signedIn=session?.state==='signed-in';
 if(!signedIn&&!busy){settingsOpen=false;changeOpen=false;}
 accountTools.hidden=Boolean(signedIn&&!settingsOpen&&!panel)||Boolean(busy&&!session&&!settingsOpen);
 form.hidden=Boolean(panel)||Boolean(signedIn&&(!settingsOpen||!changeOpen));
 changeButton.hidden=!signedIn||!settingsOpen||Boolean(panel);
 changeButton.disabled=busy;
 changeButton.textContent=changeOpen?'Annuler le changement de compte':'Changer de compte';

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

const legalEntry=document.querySelector('#legal-entry');
legalEntry.addEventListener('toggle',()=>{if(!legalEntry.open||legalEntry.hidden)return;const target=legalEntry.querySelector('.legal-entry-content');if(!target.firstChild)target.append(legalView({client,live:()=>legalEntry.open&&!legalEntry.hidden}));});
