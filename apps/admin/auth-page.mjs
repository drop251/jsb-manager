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
const accountTools=document.querySelector('.account-tools');
let settingsOpen=false;
const workspacePages={"common":[["accounts","Comptes plateforme","Coach et Particulier",["Comptes Coach","Comptes Particulier","Suspension et réactivation — à raccorder"]],["stats","Statistiques","Indicateurs agrégés uniquement",["Comptes actifs","Inscriptions","Usage agrégé"]],["catalogue","Catalogue de référence","Référentiels indépendants",["Judo — base non validée","Taïso — référentiel à raccorder","Historique des versions"]],["legal","Documents légaux","CGU et confidentialité",["CGU","Politique de confidentialité","CGV — désactivées"]],["tests","Tests des générateurs","Recette isolée",["Judo","Taïso"]],["maintenance","Maintenance","Sécurité et messagerie",["État du serveur","Diagnostic e-mail — non raccordé","Journal administratif","Sauvegardes plateforme"]]]};
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
 reload.addEventListener('click',()=>{if(!busy&&settingsOpen&&section.isConnected)location.reload();});
 check.addEventListener('click',async()=>{
  if(check.disabled||busy||!settingsOpen)return;
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
 function navigation(current){
  const nav=element('nav');nav.className='jsb-nav';nav.setAttribute('aria-label','Navigation principale');
  const shortLabels={home:'Accueil',judo:'Judo',taiso:'Taïso',club:'Club',personal:'Suivi',accounts:'Comptes',stats:'Statistiques',catalogue:'Catalogue',legal:'Documents',tests:'Tests',maintenance:'Maintenance',settings:'Réglages'};
  for(const key of ['home',...items.map(item=>item[0]),'settings']){
   const button=element('button',shortLabels[key]||key);button.type='button';button.dataset.navPage=key;
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
 function settings(){
  if(busy||workspaceIdentity!==identity)return;
  settingsOpen=true;
  clearSecrets();
  const heading=element('h2','Réglages');heading.tabIndex=-1;
  workspace.replaceChildren(navigation('settings'),heading,displaySettings(),versionSettings());
  accountTools.hidden=false;paint(status.textContent);
  window.scrollTo(0,0);heading.focus({preventScroll:true});
 }
 function home(focus=false){
  if(busy||workspaceIdentity!==identity)return;
  settingsOpen=false;
  accountTools.hidden=true;
  workspace.replaceChildren(navigation('home'));
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
    workspace.replaceChildren(navigation(key),detail);h.focus({preventScroll:true});
    if(key==='catalogue'){
     const block=element('section');block.className='workspace-detail';
     block.append(element('h3','Contrôle d’un fichier'),element('p','Analyse JSON ou Excel selon le modèle Judo ou Taïso. Le classeur Taïso provisoire reste réservé à la recette. Toute publication nécessite une confirmation distincte.'));
     const dl=element('label','Discipline');dl.htmlFor='import-discipline';
     const select=element('select');select.id='import-discipline';
     for(const [value,name] of [['taiso','Taïso'],['judo','Judo']]){const option=element('option',name);option.value=value;select.append(option);}
     const vl=element('label','Version du nouveau catalogue (Excel définitif)');vl.htmlFor='import-version';
     const version=element('input');version.id='import-version';version.type='text';version.maxLength=80;version.placeholder='2026-v1';
     const fl=element('label','Fichier JSON ou Excel (.xlsx)');fl.htmlFor='import-file';
     const file=element('input');file.id='import-file';file.type='file';file.accept='.json,.xlsx,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
     const check=element('button','Analyser sans importer');check.type='button';check.disabled=true;
     const report=element('div');report.id='import-report';report.setAttribute('role','status');
     let generation=0;
     const live=()=>!busy&&workspaceIdentity===identity&&block.isConnected;
     function reset(){generation++;report.replaceChildren();check.disabled=!file.files?.length;}
     file.addEventListener('change',reset);select.addEventListener('change',reset);version.addEventListener('input',reset);
     check.addEventListener('click',async()=>{
      const selected=file.files?.[0],discipline=select.value;
      if(!live()||!selected)return;
      const run=++generation;check.disabled=true;report.replaceChildren(element('p','Analyse en cours…'));
      try{
       if(selected.size>4*1024*1024)throw Error('Fichier trop volumineux (4 Mio maximum).');
       let body;
       const excel=/\.xlsx$/i.test(selected.name);
       if(excel){
        const bytes=new Uint8Array(await selected.arrayBuffer()),chunks=[];
        for(let i=0;i<bytes.length;i+=16384)chunks.push(String.fromCharCode(...bytes.subarray(i,i+16384)));
        body={discipline,format:'xlsx-contract',version:version.value.trim(),base64:btoa(chunks.join(''))};
       }else if(/\.json$/i.test(selected.name))body={discipline,text:await selected.text()};
       else throw Error('Sélectionnez un fichier JSON ou XLSX.');

       if(!live()||run!==generation)return;
       const before=await client.session();
       if(!live()||run!==generation)return;
       if(before.state!=='signed-in'||before.account.id!==account.id||before.account.role!=='admin'){void refresh();return;}
       const response=await fetch(location.origin+'/api/admin/catalogue/analyze',{method:'POST',credentials:'same-origin',mode:'same-origin',referrer:location.origin+'/',referrerPolicy:'same-origin',cache:'no-store',redirect:'error',headers:{'Accept':'application/json','Content-Type':'application/json'},body:JSON.stringify(body)});
       if(response.status===401||response.status===403){if(live()&&run===generation)void refresh();return;}
       if(response.status===429)throw Error('Trop d’analyses. Réessayez plus tard.');
       if(excel&&response.status===503)throw Error('Analyse Excel indisponible : vérifiez la configuration serveur.');
       if(!response.ok)throw Error('Analyse indisponible.');
       const data=await response.json(),confirmed=await client.session();
       if(!live()||run!==generation)return;
       if(confirmed.state!=='signed-in'||confirmed.account.id!==account.id||confirmed.account.role!=='admin'){void refresh();return;}
       const a=data.analysis;
       if(data.ok!==true||typeof a?.valid!=='boolean')throw Error('Rapport invalide.');
       report.replaceChildren();
       if(!a.valid){
        report.append(element('h4','Fichier refusé'),element('p',String(a.errorCount)+' erreur(s). Aucune modification.'));
        const errors=element('ul');
        const labels={'invalid-xlsx':'Classeur hors contrat ou non conforme','invalid-headers':'En-têtes non conformes au modèle','invalid-version':'Version manquante ou invalide','empty-catalogue':'Aucune fiche renseignée','invalid-columns':'Nombre de colonnes invalide','required':'Champ obligatoire','positive-integer':'Entier positif hors limites ou invalide','invalid-sheet-type':'Type de fiche invalide','invalid-permanent-reference':'Référence pérenne invalide','invalid-level':'Niveau non reconnu','invalid-subgroup':'Sous-groupe non reconnu','invalid-mode':'Mode de dosage non autorisé','repetition-fields':'Renseigner uniquement les répétitions','duration-fields':'Renseigner uniquement la durée d’effort','alternative-fields':'Renseigner la durée et les répétitions','combined-fields':'Renseigner la durée et le plafond de répétitions','invalid-age':'Catégorie d’âge invalide','invalid-role':'Rôle pédagogique invalide','invalid-opposition':'Niveau d’opposition invalide','combined-age':'Mode combiné réservé aux Benjamins et plus','eveil-opposition':'Opposition inadaptée à l’Éveil','pre-poussin-opposition':'Opposition libre interdite en Pré-poussins','invalid-contract':'Version de contrat inconnue','invalid-discipline':'Discipline invalide','size-limit':'Taille dépassée','invalid-json':'JSON illisible','invalid-envelope':'Structure ou discipline incorrecte','row-limit':'Nombre de fiches hors limites','invalid-shape':'Structure de fiche incorrecte','invalid-text':'Texte absent ou invalide','duplicate-reference':'Référence en double','invalid-pedagogical-fields':'Champs pédagogiques manquants ou invalides'};
        for(const e of a.errors)errors.append(element('li',(e.row?'Fiche '+e.row:'Fichier')+' · '+e.field+' : '+(labels[e.code]||'Erreur de validation')));
        report.append(errors);
       }else{
        if(a.discipline!==discipline||(excel&&(a.publishable!==false||!((a.mode==='xlsx-recipe'&&discipline==='taiso'&&a.columns===22)||(a.mode==='xlsx-contract'&&a.contractVersion==='JSB-EXCEL-1'&&a.columns===(discipline==='taiso'?27:35))))))throw Error('Discipline ou rapport incohérent.');
        report.append(element('h4',excel?'Structure Excel conforme':'Structure conforme'),element('p','Version '+a.version+' · '+a.count+' fiche(s)'),element('p','Empreinte SHA-256 : '+a.hash));
        if(excel)report.append(element('p',a.columns+' colonnes · '+(a.columns*a.count)+' cellules'+(a.mode==='xlsx-recipe'?' restituées sans perte. Références temporaires — publication interdite.':' contrôlées. Contrat '+a.contractVersion+' — '+(a.confirmation?'confirmation distincte requise.':'analyse uniquement, publication interdite à ce stade.'))));
        const families=element('ul');for(const f of a.families)families.append(element('li',f.family+' : '+f.count));report.append(families);
        const sample=element('ul');for(const e of a.sample)sample.append(element('li',e.reference+' · '+e.name+' · '+e.family));
        report.append(element('h4','Aperçu des cinq premières fiches au maximum'),sample,element('p','Contrôle structurel uniquement. La validation pédagogique et la publication restent distinctes.'));
        const confirmation=a.confirmation;
        if(confirmation&&typeof confirmation.receipt==='string'&&Number.isSafeInteger(confirmation.expiresAt)&&(confirmation.previousVersion===null||typeof confirmation.previousVersion==='string')){
         const panel=element('section');panel.className='workspace-detail';
         panel.append(element('h4','Confirmer la publication'),element('p','Discipline : '+discipline+' · Version active : '+(confirmation.previousVersion??'Aucune')+' · Nouvelle version : '+a.version),element('p','Cette opération rend le nouveau catalogue accessible. Les anciennes versions sont conservées. La confirmation expire après 10 minutes.'));
         const attest=element('input');attest.type='checkbox';attest.id='publication-attestation';
         const attestLabel=element('label','Je confirme avoir vérifié pédagogiquement toutes les fiches et leurs conditions de sécurité.');attestLabel.htmlFor=attest.id;
         const line=element('div');line.append(attest,attestLabel);
         const typed=element('input');typed.id='publication-version';typed.type='text';typed.maxLength=80;
         const typedLabel=element('label','Saisir exactement la nouvelle version : '+a.version);typedLabel.htmlFor=typed.id;
         const publish=element('button','Publier le catalogue');publish.type='button';publish.disabled=true;
         function eligible(){publish.disabled=!attest.checked||typed.value!==a.version;}
         attest.addEventListener('change',eligible);typed.addEventListener('input',eligible);
         publish.addEventListener('click',async()=>{
          if(!live()||run!==generation||publish.disabled)return;
          publish.disabled=true;attest.disabled=true;typed.disabled=true;
          select.disabled=true;version.disabled=true;file.disabled=true;check.disabled=true;
          const state=element('p','Publication en cours…');panel.append(state);
          try{
           const before=await client.session();
           if(!live()||run!==generation)return;
           if(before.state!=='signed-in'||before.account.id!==account.id||before.account.role!=='admin'){void refresh();return;}
           const response=await fetch(location.origin+'/api/admin/catalogue/publish',{method:'POST',credentials:'same-origin',mode:'same-origin',referrer:location.origin+'/',referrerPolicy:'same-origin',cache:'no-store',redirect:'error',headers:{'Accept':'application/json','Content-Type':'application/json'},body:JSON.stringify({...body,receipt:confirmation.receipt,confirmed:attest.checked,confirmationVersion:typed.value})});
           if(!live()||run!==generation)return;
           if(response.status===401||response.status===403){void refresh();return;}
           if(response.status===409){state.textContent='Confirmation expirée ou catalogue modifié. Relancez l’analyse.';return;}
           if(response.status===400||response.status===429){state.textContent='Publication refusée. Relancez l’analyse avant toute nouvelle tentative.';return;}
           if(!response.ok)throw Error('Publication non confirmée');
           const result=await response.json(),p=result.publication;
           if(!live()||run!==generation)return;
           if(result.ok!==true||p?.discipline!==discipline||p.version!==a.version||p.hash!==a.hash||p.count!==a.count)throw Error('Confirmation incohérente');
           panel.replaceChildren(element('h4','Catalogue publié'),element('p',p.version+' · '+p.count+' fiches. Version précédente conservée.'));
          }catch{if(live()&&run===generation)state.textContent='Résultat non confirmé. Vérifiez le catalogue actif avant toute nouvelle tentative.';}
          finally{if(live()&&run===generation){select.disabled=false;version.disabled=false;file.disabled=false;check.disabled=!file.files?.length;}}
         });
         panel.append(line,typedLabel,typed,publish);report.append(panel);
        }

       }
      }catch(e){if(live()&&run===generation)report.replaceChildren(element('p',['Fichier trop volumineux (4 Mio maximum).','Trop d’analyses. Réessayez plus tard.','Le format Excel provisoire est réservé au Taïso.','Sélectionnez un fichier JSON ou XLSX.','Analyse Excel indisponible : vérifiez la configuration serveur.'].includes(e.message)?e.message:'Analyse indisponible. Vérifiez votre fichier et votre session.'));}
      finally{if(live()&&run===generation)check.disabled=!file.files?.length;}
     });
     const historyBlock=element('section');historyBlock.className='workspace-detail';
     const historyButton=element('button','Consulter l’historique');historyButton.type='button';
     const historyResult=element('div');historyResult.id='catalogue-history';historyResult.setAttribute('aria-live','polite');
     let historyRun=0,restoring=false;
     async function historyRequest(path,body){
      const response=await fetch(location.origin+'/api/admin/catalogue/'+path,{method:'POST',credentials:'same-origin',mode:'same-origin',referrer:location.origin+'/',referrerPolicy:'same-origin',cache:'no-store',redirect:'error',headers:{'Accept':'application/json','Content-Type':'application/json'},body:JSON.stringify(body)});
      if(response.status===401||response.status===403){void refresh();throw Error('Session indisponible');}
      if(!response.ok)throw Error(response.status===409?'Le catalogue a changé. Rechargez l’historique.':'Opération non confirmée. Rechargez l’historique.');
      return response.json();
     }
     async function loadHistory(offset=0){
      if(!live()||restoring)return;
      const run=++historyRun,discipline=select.value;
      const current=()=>live()&&run===historyRun&&select.value===discipline;
      historyButton.disabled=true;historyResult.replaceChildren(element('p','Chargement des versions…'));
      try{
       const data=await historyRequest('history',{discipline,offset});
       if(!current())return;
       const h=data.history;
       if(data.ok!==true||h?.discipline!==discipline||!Array.isArray(h.versions)||!Array.isArray(h.restorations)||typeof h.generation!=='string')throw Error('Historique invalide');
       historyResult.replaceChildren(element('h4','Version active : '+(h.activeVersion??'Aucune')),element('p',h.total+' version(s) publiées'));
       if(!h.versions.length)historyResult.append(element('p','Aucune version enregistrée dans le journal.'));
       for(const entry of h.versions){
        const section=element('section');section.className='workspace-detail';
        section.append(element('h4',entry.version+(entry.version===h.activeVersion?' · Active':' · Archivée')),element('p',entry.count+' fiche(s) · '+new Date(Number(entry.publishedAt)).toLocaleString('fr-FR')),element('p','Empreinte : '+entry.hash));
        if(h.restoreEnabled===true&&h.activeVersion&&entry.version!==h.activeVersion){
         const open=element('button','Préparer la restauration');open.type='button';
         open.addEventListener('click',()=>{
          if(!current()||restoring)return;
          open.remove();
          const warning=element('p','Réactiver '+entry.version+' à la place de '+h.activeVersion+'. Toutes les versions seront conservées.');
          const reason=element('textarea');reason.maxLength=500;reason.setAttribute('aria-label','Motif de restauration');reason.placeholder='Motif obligatoire';
          const typed=element('input');typed.type='text';typed.maxLength=80;typed.setAttribute('aria-label','Version à restaurer');typed.placeholder=entry.version;
          const confirm=element('button','Restaurer cette version');confirm.type='button';confirm.disabled=true;
          const eligible=()=>{confirm.disabled=restoring||!reason.value.trim()||typed.value!==entry.version;};
          reason.addEventListener('input',eligible);typed.addEventListener('input',eligible);
          confirm.addEventListener('click',async()=>{
           if(!current()||restoring||confirm.disabled)return;
           restoring=true;confirm.disabled=true;select.disabled=true;historyButton.disabled=true;
           try{
            const data=await historyRequest('restore',{discipline,targetVersion:entry.version,expectedVersion:h.activeVersion,expectedGeneration:h.generation,confirmationVersion:typed.value,confirmed:true,reason:reason.value});
            if(!current())return;
            if(data.ok!==true||data.restoration?.version!==entry.version||data.restoration.discipline!==discipline)throw Error('Résultat non confirmé. Rechargez l’historique.');
            reset();historyResult.replaceChildren(element('p','Version '+entry.version+' restaurée. Toutes les versions sont conservées.'));
           }catch(e){if(current())historyResult.replaceChildren(element('p',e.message));}
           finally{restoring=false;if(live()){select.disabled=false;historyButton.disabled=false;}}
          });
          section.append(warning,reason,typed,confirm);
         });
         section.append(open);
        }
        historyResult.append(section);
       }
       if(offset>0||offset+30<h.total){
        const prev=element('button','Précédent'),next=element('button','Suivant');prev.type=next.type='button';
        prev.disabled=offset===0;next.disabled=offset+30>=h.total;
        prev.addEventListener('click',()=>void loadHistory(Math.max(0,offset-30)));next.addEventListener('click',()=>void loadHistory(offset+30));historyResult.append(prev,next);
       }
       if(h.restorations.length){
        historyResult.append(element('h4','Dernières restaurations'));
        for(const e of h.restorations)historyResult.append(element('p',e.previousVersion+' → '+e.restoredVersion+' · '+new Date(Number(e.restoredAt)).toLocaleString('fr-FR')+' · '+e.reason));
       }
      }catch(e){if(current())historyResult.replaceChildren(element('p',e.message));}
      finally{if(current())historyButton.disabled=false;}
     }
     select.addEventListener('change',()=>{historyRun++;historyResult.replaceChildren();historyButton.disabled=false;});
     historyButton.addEventListener('click',()=>void loadHistory());
     historyBlock.append(element('h3','Historique des versions'),element('p','Sélectionnez la discipline ci-dessus. La restauration ne supprime aucune version.'),historyButton,historyResult);
     block.append(dl,select,vl,version,fl,file,check,report,historyBlock);detail.insertBefore(block,list);
    }
   });grid.append(button);
  }
  workspace.append(grid);window.scrollTo(0,0);if(focus)heading.focus({preventScroll:true});
 }
 home();
}

function paint(message){
 renderWorkspace();
 const signedIn=session?.state==='signed-in';
 if(!signedIn&&!busy){settingsOpen=false;}
 accountTools.hidden=Boolean(signedIn&&!settingsOpen)||Boolean(busy&&!session&&!settingsOpen);
 form.hidden=Boolean(signedIn);

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
