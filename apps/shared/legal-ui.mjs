import {LEGAL_TEMPLATES} from './legal-content.mjs';
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const button=(text,action)=>{const b=el('button',text);b.type='button';b.addEventListener('click',action);return b;};
const date=n=>new Date(n).toLocaleDateString('fr-FR');
function prose(text){
 const node=el('div');node.className='legal-prose';
 for(const part of text.split(/\n\s*\n/)){const [first,...rest]=part.split('\n');if(/^\d+\. /.test(first)){node.append(el('h4',first));if(rest.length)node.append(el('p',rest.join('\n')));}else node.append(el('p',part));}
 return node;
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
  if(admin){
   const section=el('section');section.append(el('h3','Publication verrouillée'),el('p','Informations à valider avant ouverture publique : identité de l’éditeur, coordonnées et contact RGPD, durées et procédures d’effacement, sous-traitants et transferts, contrat clubs, conditions commerciales si une offre payante est activée. Aucune acceptation des projets n’est enregistrée.'));documents.append(section);
  }
 }
 render();
 if(client)void load();
 else status.textContent='Textes de préproduction consultables.';
 return root;
}
