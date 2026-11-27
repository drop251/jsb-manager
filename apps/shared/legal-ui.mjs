import {LEGAL_TEMPLATES} from './legal-content.mjs';
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const button=(text,action)=>{const b=el('button',text);b.type='button';b.addEventListener('click',action);return b;};
const date=n=>new Date(n).toLocaleDateString('fr-FR');
function prose(text){
 const node=el('div');node.className='legal-prose';
 for(const part of text.split(/\n\s*\n/)){const [first,...rest]=part.split('\n');if(/^\d+\. /.test(first)){node.append(el('h4',first));if(rest.length)node.append(el('p',rest.join('\n')));}else node.append(el('p',part));}
 return node;
}
const RIGHTS=Object.freeze({access:'Accès à mes données',rectification:'Rectification',erasure:'Effacement',restriction:'Limitation du traitement',objection:'Opposition',portability:'Portabilité',withdrawal:'Retrait du consentement, si applicable'});
const RIGHT_STATUS=Object.freeze({submitted:'Reçue',in_progress:'En cours de traitement',responded:'Réponse transmise'});
// Indicative internal target: one calendar month, clamped to the last day
// of the destination month. No automatic decision or legal extension.
function targetDate(ms){
 const d=new Date(ms),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+1);
 const max=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();
 d.setUTCDate(Math.min(day,max));return d.toLocaleDateString('fr-FR',{timeZone:'UTC'});
}
function rightsView({client,account,admin,live}){
 const root=el('details');root.className='legal-document';root.append(el('summary',admin?'Demandes RGPD à traiter':'Mes données personnelles'));
 const panel=el('div'),status=el('p','Aucune demande chargée.'),rows=el('div');status.setAttribute('role','status');
 panel.append(el('p',admin?'Cette file ne contient que les demandes et les coordonnées nécessaires à leur traitement. Une réponse doit être effectivement transmise par un canal sécurisé avant de clôturer.':'Déposez une demande concernant votre compte. Ne transmettez ici aucun justificatif ni donnée de licencié. Le responsable vous répondra par le canal approprié. Un dépôt ne déclenche pas automatiquement un effacement.'),status);
 let busy=false;
 const active=()=>root.isConnected&&live();
 const call=async(action,body={})=>{const r=await client.legalAction(action,account.id,body);if(r.state!=='ready')throw Error('Demande non confirmée');return r;};
 async function load(){
  const r=await call(admin?'rights-queue':'rights-mine');
  if(!active())return;
  rows.replaceChildren();
  if(!r.requests.length)rows.append(el('p','Aucune demande.'));
  for(const item of r.requests){
   const row=el('section');row.className='legal-document';
   row.append(el('h4',RIGHTS[item.kind]||item.kind),el('p','Statut : '+RIGHT_STATUS[item.status]),el('p','Reçue le '+date(item.createdAt)+' · objectif initial de réponse : '+targetDate(item.createdAt)),el('p','Référence : '+item.id));
   if(admin){row.append(el('p','Contact du compte : '+item.email));const action=item.status==='submitted'?'in_progress':'responded';
    const label=el('label'),check=el('input');check.type='checkbox';label.append(check,el('span',action==='in_progress'?'Je prends cette demande en charge.':'Je confirme avoir réellement transmis une réponse, et traité ou motivé le refus de la demande.'));
    const update=button(action==='in_progress'?'Prendre en charge':'Enregistrer la réponse transmise',()=>run(async()=>{if(!check.checked)return;await call('rights-update',{id:item.id,revision:item.revision,status:action,confirmed:true});await load();if(active())status.textContent='État de la demande confirmé.';}));
    update.disabled=true;check.addEventListener('change',()=>{update.disabled=!check.checked;});row.append(label,update);
   }
   rows.append(row);
  }
  status.textContent=admin?'Demandes ouvertes : '+r.requests.length+(r.requests.length===100?' (100 premières)':''):'Demandes de votre compte : '+r.requests.length+(r.requests.length===100?' (100 premières)':'');
 }
 async function run(fn){if(busy||!active())return;busy=true;try{await fn();}catch{if(active())status.textContent='Action non confirmée. Actualisez la liste et vérifiez votre session.';}finally{busy=false;}}
 if(!admin){
  const label=el('label','Type de demande'),select=el('select');for(const [value,name] of Object.entries(RIGHTS)){const option=el('option',name);option.value=value;select.append(option);}label.append(select);
  panel.append(label,button('Déposer la demande',()=>run(async()=>{const r=await call('rights-submit',{kind:select.value});await load();if(active())status.textContent='Demande enregistrée · '+r.request.id+'.'})));
 }
 panel.append(button(admin?'Actualiser les demandes ouvertes':'Consulter mes demandes',()=>run(load)),rows);
 root.append(panel);
 return root;
}

export function legalView({client=null,account=null,admin=false,live=()=>true}={}){
 const root=el('section');root.className='legal-documents';root.setAttribute('aria-label','Documents juridiques');
 const status=el('p');status.setAttribute('role','status');
 const documents=el('div');root.append(el('p','Préproduction privée. Les textes en projet ne sont pas des documents publiés et ne déclenchent aucune acceptation.'),status,documents);
 const active=()=>root.isConnected&&live();
 let effective=[],loading=!!client;
 async function load(){
  if(!client)return;
  loading=true;status.textContent='Vérification des versions publiées…';
  try{const values=await client.legalDocuments(account?.id);if(!active())return;effective=values;status.textContent=values.length?'Versions effectives vérifiées.':'Aucune version juridique effective publiée.';}
  catch{if(active()){effective=[];status.textContent='Versions serveur non vérifiables. Les projets sont consultables, aucune acceptation possible.';}}
  finally{loading=false;if(active())render();}
 }
 function render(){
  documents.replaceChildren();
  for(const type of ['cgu','privacy','cgv']){
   const template=LEGAL_TEMPLATES[type],published=effective.find(d=>d.type===type);
   const item=el('details');item.className='legal-document';item.append(el('summary',template.title+(published?' · V'+published.version:type==='cgv'?' · Non activées':' · Projet V1')));
   if(published){
    item.append(el('p','Version effective depuis le '+date(published.effectiveAt)+'.'),prose(published.body));
    if(published.recordedAt!==null&&published.kind)item.append(el('p',(published.kind==='acceptance'?'CGU acceptées':'Politique prise en connaissance')+' le '+date(published.recordedAt)+'.'));
    else if(account&&!admin&&client){
     const label=el('label'),check=el('input');check.type='checkbox';
     label.append(check,el('span',type==='cgu'?'J’ai lu et j’accepte ces conditions générales d’utilisation.':'J’ai pris connaissance de cette politique de confidentialité. Cette démarche ne vaut pas consentement général.'));
     const submit=button(type==='cgu'?'Confirmer mon acceptation':'Confirmer ma prise de connaissance',async()=>{
      if(!check.checked||loading||!active())return;
      submit.disabled=true;
      try{
       const r=await client.legalAction('record',account.id,{type,version:published.version,hash:published.hash,kind:type==='cgu'?'acceptance':'acknowledgement',confirmed:true});
       if(!active())return;
       if(r.state==='ready'){await load();return;}
       status.textContent=r.state==='version-changed'?'Le document a changé. Relisez la version effective avant de confirmer.':'Action non confirmée. Vérifiez votre session.';
       if(r.state==='version-changed')await load();
      }catch{if(active())status.textContent='Enregistrement non confirmé. Aucune acceptation affichée.';}
      finally{if(active())submit.disabled=!check.checked;}
     });submit.disabled=true;check.addEventListener('change',()=>{submit.disabled=!check.checked;});item.append(label,submit);
    }
   }else{item.append(el('p',type==='cgv'?'Aucune offre commerciale activée.':'Projet de travail — non publié.'),prose(template.body));}
   if(admin&&account&&client&&!loading&&type!=='cgv'){
    const editor=el('details');editor.append(el('summary','Préparer un brouillon juridique'));
    const label=el('label','Texte du brouillon'),input=el('textarea');input.rows=12;input.maxLength=100000;input.value=template.body;label.append(input);
    const history=el('div');history.className='legal-draft-history';let editing=false;
    const save=button('Enregistrer un nouveau brouillon',async()=>{
     if(editing||!active()||!input.value.trim())return;
     editing=true;save.disabled=true;
     try{const r=await client.legalAction('draft',account.id,{type,body:input.value});if(active())status.textContent=r.state==='ready'?'Brouillon immuable enregistré · '+r.draft.hash.slice(0,12)+'. Aucune publication.':'Brouillon non confirmé.';}
     catch{if(active())status.textContent='Enregistrement du brouillon indisponible.';}
     finally{editing=false;if(active())save.disabled=false;}
    });
    const list=button('Consulter les derniers brouillons',async()=>{
     if(editing||!active())return;editing=true;list.disabled=true;
     try{const r=await client.legalAction('history',account.id,{type});if(!active())return;if(r.state!=='ready'||!Array.isArray(r.drafts))throw Error();history.replaceChildren();
      if(!r.drafts.length)history.append(el('p','Aucun brouillon enregistré.'));
      for(const d of r.drafts){const row=el('details');row.append(el('summary','Brouillon du '+date(d.createdAt)+' · '+d.hash.slice(0,12)),prose(d.body),button('Reprendre ce texte dans un nouveau brouillon',()=>{input.value=d.body;input.focus();}));
       if(r.publicationEnabled===true&&r.approvedHash===d.hash){const label=el('label'),check=el('input');check.type='checkbox';label.append(check,el('span','Je confirme la publication de ce texte exact, validé par le responsable.'));const publish=button('Publier la version approuvée',async()=>{if(editing||!check.checked||!active())return;editing=true;publish.disabled=true;try{const result=await client.legalAction('publish',account.id,{type,draftId:d.id,hash:d.hash,expectedVersion:r.latestVersion,confirmed:true});if(!active())return;if(result.state==='ready'){await load();status.textContent='Publication confirmée · V'+result.publication.version+'.';}else status.textContent='Publication refusée ou version modifiée. Consultez à nouveau l’historique.';}catch{if(active())status.textContent='Publication non confirmée.';}finally{editing=false;if(active())publish.disabled=!check.checked;}});publish.disabled=true;check.addEventListener('change',()=>{publish.disabled=!check.checked;});row.append(label,publish);}
       history.append(row);}
     }catch{if(active())status.textContent='Historique indisponible.';}finally{editing=false;if(active())list.disabled=false;}
    });
    editor.append(el('p','La publication reste verrouillée tant que le serveur ne dispose pas de l’empreinte exacte d’un texte validé et des informations juridiques et procédures de conservation approuvées.'),label,save,list,history);
    item.append(editor);
   }
   documents.append(item);
  }
  if(account&&client&&!loading)documents.append(rightsView({client,account,admin,live:active}));
  if(admin){
   const section=el('section');section.append(el('h3','Publication verrouillée'),el('p','Informations à valider avant ouverture publique : identité de l’éditeur, coordonnées et contact RGPD, durées et procédures d’effacement, sous-traitants et transferts, contrat clubs, conditions commerciales si une offre payante est activée. Aucune acceptation des projets n’est enregistrée.'));documents.append(section);
  }
 }
 render();
 if(client)void load();
 else status.textContent='Textes de préproduction consultables.';
 return root;
}
