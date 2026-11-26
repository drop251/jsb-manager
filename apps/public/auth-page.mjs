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

const workspace=document.querySelector('#workspace');
const workspacePages={"common":[["judo","Judo","Préparation pédagogique",["Catalogue Judo — base en construction","Préparer une séance Judo","Mes séances Judo"]],["taiso","Taïso","Renforcement et préparation physique",["Catalogue Taïso — référentiel à raccorder","Préparer une séance Taïso","Mes séances Taïso"]]],"coach":["club","Gestion du club","Licenciés, présences et planning",["Licenciés","Présences","Bilans","Planning"]],"individual":["personal","Suivi personnel","Mon activité et mes entraînements",["Historique personnel","Progression personnelle"]]};
let workspaceIdentity=null;
const element=(tag,txt)=>{const node=document.createElement(tag);if(txt)node.textContent=txt;return node;};
function renderWorkspace(){
 const account=session?.state==='signed-in'&&!busy&&!panel?session.account:null;
 const permitted=account&&['coach','individual'].includes(account.role);
 if(!permitted){
  workspace.hidden=true;workspace.replaceChildren();workspaceIdentity=null;
  document.querySelector('main').classList.remove('has-session');return;
 }
 const identity=account.id+':'+account.role;
 workspace.hidden=false;document.querySelector('main').classList.add('has-session');
 if(workspaceIdentity===identity)return;
 workspaceIdentity=identity;
 const items=[...workspacePages.common,workspacePages[account.role]];
 function home(focus=false){
  if(busy||workspaceIdentity!==identity)return;
  workspace.replaceChildren();
  const heading=element('h2','Mon espace '+label(account.role));heading.tabIndex=-1;
  workspace.append(heading,element('p','Navigation de préproduction. Catalogue en lecture seule ; autres fonctions à raccorder.'));
  const grid=element('div');grid.className='workspace-grid';
  for(const [key,title,description,sections] of items){
   const button=element('button');button.type='button';button.dataset.workspacePage=key;
   if(key==='judo'||key==='taiso')button.dataset.discipline=key;
   button.append(element('strong',title),element('small',description));
   button.addEventListener('click',()=>{
    if(busy||workspaceIdentity!==identity)return;
    const detail=element('div');detail.className='workspace-detail';
    const h=element('h3',title);h.tabIndex=-1;detail.append(h,element('p','Catalogue en lecture seule lorsque publié. Autres fonctionnalités à raccorder.'));
    const list=element('ul');for(const name of sections)list.append(element('li',name));detail.append(list);
    const back=element('button','Retour à l’accueil');back.type='button';back.id='workspace-back';back.addEventListener('click',()=>home(true));detail.append(back);
    workspace.replaceChildren(detail);h.focus({preventScroll:true});
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
       const preparation=element('section');preparation.className='workspace-detail';preparation.setAttribute('aria-label','Contrôle de compatibilité Taïso');
       preparation.append(element('h3','Préparer une séance Taïso'),element('p','Contrôle préalable des exercices compatibles. Ce contrôle ne constitue pas encore une séance complète.'));
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
        function makeCheck(id,label,checked=false){
         const row=element('div'),input=element('input'),l=element('label',label);input.type='checkbox';input.id=id;input.checked=checked;l.htmlFor=id;row.append(input,l);form.append(row);return input;
        }
        const noEquipment=makeCheck('taiso-no-equipment','Sans matériel (poids du corps et tatami)',true);
        const equipmentLabel=element('label','Matériel disponible (séparer par des points-virgules)'),equipment=element('input');equipment.id='taiso-equipment';equipmentLabel.htmlFor=equipment.id;equipment.maxLength=1000;equipment.disabled=true;
        form.append(equipmentLabel,equipment);
        const partner=makeCheck('taiso-partner','Travail en binôme autorisé');
        const supervision=makeCheck('taiso-supervision','Encadrement présent');
        form.append(element('h4','Contraintes à prendre en compte'));
        const restrictions=['Genoux','Dos','Épaules','Poignets','Sauts','Passage au sol'].map((name,i)=>[name,makeCheck('taiso-constraint-'+i,name)]);
        const check=element('button','Vérifier les exercices compatibles');check.type='button';
        const result=element('div');result.id='taiso-candidate-result';result.setAttribute('role','status');
        let requestId=0;
        const live=()=>!busy&&workspaceIdentity===identity&&preparation.isConnected;
        form.addEventListener('change',()=>{requestId++;equipment.disabled=noEquipment.checked;if(noEquipment.checked)equipment.value='';level.disabled=group.value==='Gym douce';if(level.disabled)level.value='Débutant';result.replaceChildren();check.disabled=false;});
        equipment.addEventListener('input',()=>{requestId++;result.replaceChildren();check.disabled=false;});
        check.addEventListener('click',async()=>{
         if(!live()||check.disabled)return;
         const run=++requestId;
         const criteria={groupe:group.value,niveau:level.value,mode:mode.value,supervision:supervision.checked,binome:partner.checked,sansMateriel:noEquipment.checked,materiel:noEquipment.checked?[]:equipment.value.split(';').map(x=>x.trim()).filter(Boolean),contraintes:restrictions.filter(([,input])=>input.checked).map(([name])=>name)};
         if(!criteria.sansMateriel&&!criteria.materiel.length){result.textContent='Renseignez le matériel disponible ou choisissez Sans matériel.';return;}
         check.disabled=true;result.textContent='Vérification en cours…';
         try{
          const answer=await client.taisoCandidates({version:data.version,generation:data.generation,criteria});
          const accountNow=await client.session();
          if(!live()||run!==requestId)return;
          if(accountNow.state!=='signed-in'||accountNow.account.id!==account.id||accountNow.account.role!==account.role){void refresh();return;}
          if(answer.state==='version-changed'){result.textContent='Le référentiel a changé. Revenez à l’accueil puis rouvrez le Taïso.';return;}
          if(answer.state==='rate-limited'){result.textContent='Trop de vérifications. Réessayez plus tard.';return;}
          result.replaceChildren(element('p',answer.total+' exercice(s) compatible(s) · '+answer.excluded+' non retenu(s).'));
          if(answer.items.length){
           const ul=element('ul');for(const item of answer.items)ul.append(element('li',item.name+' · '+item.dosage));result.append(ul);
           if(answer.total>answer.items.length)result.append(element('p','Aperçu limité aux 30 premières fiches compatibles.'));
          }
          result.append(element('p','La compatibilité technique ne remplace pas l’appréciation pédagogique du coach.'));
         }catch{if(live()&&run===requestId)result.textContent='Vérification indisponible. Contrôlez votre session et le référentiel.';}
         finally{if(live()&&run===requestId)check.disabled=false;}
        });
        form.append(check,result);preparation.append(form);
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
  workspace.append(grid);if(focus)heading.focus({preventScroll:true});
 }
 home();
}

function paint(message){
 renderWorkspace();
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
