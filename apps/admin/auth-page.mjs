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
    if(key==='catalogue'){
     const block=element('section');block.className='workspace-detail';
     block.append(element('h3','Contrôle d’un fichier'),element('p','Analyse JSON ou Excel selon le modèle Judo ou Taïso. Le classeur Taïso provisoire reste réservé à la recette. Aucune publication ne sera effectuée.'));
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
        if(excel)report.append(element('p',a.columns+' colonnes · '+(a.columns*a.count)+' cellules'+(a.mode==='xlsx-recipe'?' restituées sans perte. Références temporaires — publication interdite.':' contrôlées. Contrat '+a.contractVersion+' — analyse uniquement, publication interdite à ce stade.')));
        const families=element('ul');for(const f of a.families)families.append(element('li',f.family+' : '+f.count));report.append(families);
        const sample=element('ul');for(const e of a.sample)sample.append(element('li',e.reference+' · '+e.name+' · '+e.family));
        report.append(element('h4','Aperçu des cinq premières fiches au maximum'),sample,element('p','Contrôle structurel uniquement. La validation pédagogique et la publication restent distinctes.'));
       }
      }catch(e){if(live()&&run===generation)report.replaceChildren(element('p',['Fichier trop volumineux (4 Mio maximum).','Trop d’analyses. Réessayez plus tard.','Le format Excel provisoire est réservé au Taïso.','Sélectionnez un fichier JSON ou XLSX.','Analyse Excel indisponible : vérifiez la configuration serveur.'].includes(e.message)?e.message:'Analyse indisponible. Vérifiez votre fichier et votre session.'));}
      finally{if(live()&&run===generation)check.disabled=!file.files?.length;}
     });
     block.append(dl,select,vl,version,fl,file,check,report);detail.insertBefore(block,list);
    }
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
