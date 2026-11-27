import {hasAttendanceVault,createAttendanceVault,openAttendanceVault,attendanceVaultKey} from './attendance-vault.mjs';
const {empty,normalize,merge}=window.JSBAttendance;
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const id=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const day=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
const labels={present:'Présent',absent:'Absent',excused:'Excusé'};
export function mountAttendance(root,{client=null,account=null,live=()=>root.isConnected,prepareOffline=null}={}){
 const online=!!client&&account?.role==='coach';
 const canSync=()=>!!client&&!!vault&&(!account||account.role==='coach'&&account.id===vault.value.owner);
 let vault=null,base=empty(),working=empty(),revision=0,ready=false,busy=false,tab='appel',selectedSlot='',selectedDate=day(),conflict=null,closed=false,autoPending=false,autoTimer=null,manualReview=false;
 const status=el('p');status.setAttribute('role','status');
 const controls=el('section'),body=el('div');root.append(controls,status,body);
 const active=()=>!closed&&live()&&root.isConnected;
 const notify=msg=>{if(active())status.textContent=msg;};
 function close(){if(closed)return;closed=true;stopAuto();window.removeEventListener('online',reconnected);root.removeEventListener('focusout',focusExited);vault?.close();vault=null;working=base=empty();conflict=null;root.replaceChildren();window.removeEventListener('storage',storageChanged);window.removeEventListener('pagehide',close);observer.disconnect();}
 function storageChanged(event){if(event.key===attendanceVaultKey&&vault){stopAuto();vault.close();vault=null;ready=false;base=working=empty();conflict=null;render();notify('Le coffre a changé dans une autre fenêtre. Déverrouillez à nouveau.');}}
 function stopAuto(){autoPending=false;if(autoTimer!==null){clearTimeout(autoTimer);autoTimer=null;}}
 function reconnected(){if(!active()||!canSync()||manualReview||conflict)return;autoPending=true;scheduleAuto();}
 function scheduleAuto(){
  if(!autoPending||!active()||!canSync()||!ready||conflict||manualReview||!navigator.onLine||busy||autoTimer!==null)return;
  // Do not discard text being entered when a network event arrives.
  if(root.contains(document.activeElement)&&document.activeElement?.matches('input,select,textarea'))return;
  if([...root.querySelectorAll('input[type="text"],input[type="password"]')].some(i=>i.value.trim()))return;
  autoTimer=setTimeout(()=>{autoTimer=null;if(!autoPending||!active()||!canSync()||!ready||busy||conflict||manualReview||!navigator.onLine)return;
   if(root.contains(document.activeElement)&&document.activeElement?.matches('input,select,textarea'))return;
   if([...root.querySelectorAll('input[type="text"],input[type="password"]')].some(i=>i.value.trim()))return;
   autoPending=false;if(!same(base,working))void synchronize(true);
  },350);
 }
 window.addEventListener('online',reconnected);
 function focusExited(){queueMicrotask(scheduleAuto);}
 root.addEventListener('focusout',focusExited);
 window.addEventListener('storage',storageChanged);window.addEventListener('pagehide',close,{once:true});
 const observer=new MutationObserver(()=>{if(!root.isConnected){observer.disconnect();close();}});observer.observe(document.body,{childList:true,subtree:true});
 function button(text,action,disabled=false){const b=el('button',text);b.type='button';b.disabled=busy||disabled;b.addEventListener('click',()=>{if(active()&&!busy)void action();});return b;}
 function field(label,type='text'){const l=el('label',label),i=el('input');i.type=type;if(type==='text')i.maxLength=100;if(type==='password'){i.maxLength=256;i.autocomplete='off';}l.append(i);return [l,i];}
 function select(label,values,current){const l=el('label',label),s=el('select');for(const [v,t] of values){const o=el('option',t);o.value=v;s.append(o);}if(values.some(([v])=>v===current))s.value=current;l.append(s);return [l,s];}
 async function task(fn){if(!active()||busy)return;busy=true;render();try{await fn();}catch(e){notify(e?.message||'Action non confirmée.');}finally{busy=false;if(active()){render();scheduleAuto();}}}
 async function readServer(){const r=await client.privateAttendance('read',account.id);if(r.state!=='ready')throw Error('Registre serveur indisponible.');return {revision:r.register.revision,snapshot:normalize(r.register.snapshot)};}
 async function saveLocal(next){const opened=vault;if(!opened)throw Error('Coffre verrouillé.');await opened.save({owner:opened.value.owner,revision,base,working:next,reviewRequired:manualReview},()=>active()&&vault===opened);if(vault!==opened)throw Error('Coffre modifié.');}
 async function change(mutator){
  if(!ready||conflict)return;
  if(!vault){notify('Activez le coffre local avant de modifier le registre.');return;}
  await task(async()=>{const next=structuredClone(working);mutator(next);const checked=normalize(next);await saveLocal(checked);if(!active())return;working=checked;notify(vault?'Modification enregistrée dans le coffre local.':'Modification en mémoire. Enregistrez sur le serveur avant de quitter.');});
 }
 async function adopt(remote,next=remote.snapshot,reviewRequired=false){
  const opened=vault;
  const v={owner:account?.id||opened?.value.owner,revision:remote.revision,base:remote.snapshot,working:next,reviewRequired};
  if(opened)await opened.save(v,()=>active()&&vault===opened);
  if(!active()||vault!==opened)return;
  base=remote.snapshot;working=next;revision=remote.revision;conflict=null;ready=true;manualReview=reviewRequired;
 }
 async function synchronize(automatic=false){
  if(!canSync()||!ready||conflict)return;
  if(automatic&&(manualReview||same(base,working)))return;
  if(!navigator.onLine){notify('Hors connexion. Le registre reste enregistré localement.');return;}
  stopAuto();
  const opened=vault,owner=opened.value.owner,still=()=>active()&&vault===opened;
  await task(async()=>{
   notify(automatic?'Synchronisation automatique…':'Synchronisation en cours…');
   let r;
   try{r=await client.privateAttendance('save',owner,{revision,snapshot:working});}
   catch{if(still())notify('Synchronisation non confirmée. Travail local conservé. Réessayez lorsque le serveur est disponible.');return;}
   if(!still())return;
   if(r.state==='account-changed'){notify('Connectez-vous au compte Coach propriétaire pour synchroniser. Le registre local est conservé.');return;}
   if(!['ready','conflict'].includes(r.state)){notify('Synchronisation indisponible. Le travail local est conservé.');return;}
   const remote={revision:r.register.revision,snapshot:normalize(r.register.snapshot)};
   if(r.state==='ready'){await adopt(remote);if(still()){manualReview=false;notify('Synchronisation confirmée · révision '+revision+'.');}return;}
   const merged=merge(base,working,remote.snapshot);
   if(merged.state==='ready'){
    await adopt(remote,merged.snapshot,!automatic);if(!still())return;
    if(automatic){
     // Exactly one bounded retry with the newly confirmed revision. A
     // second concurrent update is reviewed rather than looping forever.
     let next;try{next=await client.privateAttendance('save',owner,{revision,snapshot:working});}catch{notify('Fusion locale conservée. Synchronisation à réessayer.');return;}
     if(!still())return;
     if(next.state==='ready'){await adopt({revision:next.register.revision,snapshot:normalize(next.register.snapshot)});if(still()){manualReview=false;notify('Synchronisation confirmée · révision '+revision+'.');}return;}
     if(next.state==='conflict'){
      const newer={revision:next.register.revision,snapshot:normalize(next.register.snapshot)},review=merge(base,working,newer.snapshot);
      if(review.state!=='ready'){conflict={remote:newer,choices:{},result:review};manualReview=true;notify('Conflit détecté. Aucune donnée serveur écrasée.');return;}
      await adopt(newer,review.snapshot,true);
     }
    }
    if(!manualReview)await adopt({revision,snapshot:base},working,true);if(!still())return;
    manualReview=true;notify('Modifications indépendantes fusionnées. Vérifiez le registre et confirmez la synchronisation.');
   }else{conflict={remote,choices:{},result:merged};manualReview=true;notify('Conflit détecté. Aucune donnée serveur écrasée.');}
  });
 }
 function render(){
  if(!active())return;
  controls.replaceChildren();body.replaceChildren();
  const [pl,p]=field('Phrase secrète du coffre Présences','password');
  if(!ready){
   if(online)controls.append(button('Ouvrir le registre en ligne',()=>task(async()=>{if(hasAttendanceVault())throw Error('Un coffre local existe : déverrouillez-le pour ne pas ignorer les modifications en attente.');const remote=await readServer();await adopt(remote);notify('Registre en ligne ouvert.');})));
   if(hasAttendanceVault())controls.append(pl,button('Déverrouiller le registre local',()=>{const phrase=p.value;p.value='';return task(async()=>{const opened=await openAttendanceVault(phrase);if(!active()||(online&&opened.value.owner!==account.id)){opened.close();throw Error('Ce coffre appartient à un autre compte.');}vault=opened;({revision,base,working}=vault.value);ready=true;manualReview=vault.value.reviewRequired===true;notify('Registre local déverrouillé. Aucun droit de session hors connexion n’est confirmé.');reconnected();});}));
   else if(!online)controls.append(el('p','Aucun registre Présences préparé sur cet appareil. Préparez-le en ligne depuis votre compte Coach.'));
   return;
  }
  if(canSync())controls.append(button('Synchroniser avec le serveur',()=>synchronize(false),!!conflict));
  if(online){
   if(!vault)controls.append(pl,button('Préparer les présences hors connexion',()=>{const phrase=p.value;p.value='';return task(async()=>{if(phrase.length<12)throw Error('Phrase secrète de 12 caractères minimum.');await prepareOffline();const session=await client.session();if(!active()||session.state!=='signed-in'||session.account.id!==account.id||session.account.role!=='coach')throw Error('Compte modifié.');await createAttendanceVault(phrase,{owner:account.id,revision,base,working},active);const opened=await openAttendanceVault(phrase);if(!active()){opened.close();return;}vault=opened;notify('Registre chiffré disponible dans le lecteur hors connexion.');});}));
  }
  if(vault){
   controls.append(button('Verrouiller le registre',()=>{stopAuto();vault.close();vault=null;ready=false;base=working=empty();conflict=null;manualReview=false;render();notify('Registre verrouillé.');}));
   controls.append(button('Effacer la copie locale',()=>{if(!confirm('Effacer le registre local et ses modifications non synchronisées ?'))return;return task(async()=>{stopAuto();await vault.remove();vault=null;ready=false;working=base=empty();conflict=null;manualReview=false;notify('Copie locale effacée.');});}));
  }
  controls.append(el('p','Révision '+revision+(same(base,working)?' · aucune modification en attente':' · modifications à synchroniser')));
  if(vault&&manualReview)controls.append(el('p','Une revue de synchronisation reste à confirmer manuellement.'));
  if(vault&&client)controls.append(el('p','Synchronisation automatique au retour du réseau si le coffre est déverrouillé et le compte propriétaire connecté. Les conflits exigent votre confirmation.'));
  if(!vault)controls.append(el('p','Lecture seule. Préparez le coffre local avant de modifier les présences afin de conserver chaque modification. Utilisez une phrase secrète distincte de celle du compte.'));
  if(conflict){
   const {remote,result,choices}=conflict;
   body.append(el('h3','Conflits de synchronisation'),el('p','Les données locales et serveur sont conservées. Choisissez chaque version avant de confirmer.'));
   if(result.state==='invalid-merge')body.append(el('p','Les références du registre sont incompatibles. Choisissez de conserver la version serveur ou reprenez manuellement vos données locales. Aucun écrasement automatique.'));
   const allGroups=[...working.groups,...remote.snapshot.groups],allSlots=[...working.slots,...remote.snapshot.slots];
   const groupLabel=k=>allGroups.find(g=>g.id===k)?.name||k;
   const describe=v=>v===null?'Aucune valeur':v.status?labels[v.status]:Object.hasOwn(v,'active')?v.name+' · '+groupLabel(v.groupId)+' · '+(v.active?'Actif':'Archivé'):v.label?v.label+' · '+groupLabel(v.groupId):v.name||v.date+' · '+v.marks.length+' statut(s)';
   const displayName=key=>{const parts=key.split('/'),last=parts.at(-1),person=[...working.members,...remote.snapshot.members].find(m=>m.id===last);if(parts[0]==='calls'){const date=parts[1].slice(0,10),slot=allSlots.find(t=>t.id===parts[1].slice(11));return [person?.name,date,slot?.label].filter(Boolean).join(' · ');}return person?.name||allGroups.find(g=>g.id===last)?.name||allSlots.find(t=>t.id===last)?.label||parts[0];};
   for(const c of result.conflicts){
    const row=el('section');row.append(el('h4',displayName(c.key)),el('p','Avant : '+describe(c.base)));
    const [l,s]=select('Version à conserver',[['','Choisir…'],['local','Locale : '+describe(c.local)],['remote','Serveur : '+describe(c.remote)]],choices[c.key]||'');s.addEventListener('change',()=>{choices[c.key]=s.value;});row.append(l);body.append(row);
   }
   if(result.conflicts.length)body.append(button('Appliquer les choix',()=>task(async()=>{if(result.conflicts.some(c=>!['local','remote'].includes(choices[c.key])))throw Error('Choisissez une version pour chaque conflit.');const m=merge(base,working,remote.snapshot,choices);if(m.state!=='ready')throw Error('Fusion incompatible : les deux versions sont conservées.');await adopt(remote,m.snapshot,true);notify('Conflits résolus localement. Confirmez la synchronisation.');})));
   body.append(button('Revenir au travail local',()=>{conflict=null;render();notify('Travail local conservé. La synchronisation détectera à nouveau les conflits non résolus.');}));
   body.append(button('Conserver la version serveur',()=>{if(!confirm('Abandonner les modifications locales en conflit ?'))return;return task(async()=>{await adopt(remote);manualReview=false;notify('Version serveur conservée.');});}));
   return;
  }
  const nav=el('div');nav.className='attendance-tabs';for(const [key,title] of [['appel','Appel'],['members','Licenciés'],['reports','Bilans'],['planning','Planning']]){const b=button(title,()=>{tab=key;render();});b.setAttribute('aria-pressed',String(tab===key));nav.append(b);}body.append(nav);
  const groups=working.groups.map(g=>[g.id,g.name]),groupName=k=>working.groups.find(g=>g.id===k)?.name||'Groupe';
  if(tab==='members'){
   body.append(el('h3','Licenciés'));const [gl,g]=field('Nouveau groupe');body.append(gl,button('Ajouter le groupe',()=>change(s=>s.groups.push({id:id(),name:g.value.trim()})),!ready));
   if(groups.length){const [ml,m]=field('Nom du licencié'),[sl,s]=select('Groupe',groups);body.append(ml,sl,button('Ajouter le licencié',()=>change(v=>v.members.push({id:id(),name:m.value.trim(),groupId:s.value,active:true}))));}
   for(const m of working.members){const row=el('section');row.append(el('strong',m.name),el('p',groupName(m.groupId)+(m.active?' · Actif':' · Archivé')),button(m.active?'Archiver':'Réactiver',()=>change(v=>{v.members.find(x=>x.id===m.id).active=!m.active;})));body.append(row);}
  }else if(tab==='planning'){
   body.append(el('h3','Planning'));if(!groups.length)body.append(el('p','Créez un groupe dans Licenciés.'));
   else{const [l,t]=field('Intitulé du créneau (jour et horaire)'),[g,s]=select('Groupe',groups);body.append(l,g,button('Ajouter le créneau',()=>change(v=>v.slots.push({id:id(),groupId:s.value,label:t.value.trim()}))));}
   for(const t of working.slots)body.append(el('p',groupName(t.groupId)+' · '+t.label));
  }else if(tab==='reports'){
   body.append(el('h3','Bilans'));for(const m of working.members){const counts={present:0,absent:0,excused:0};for(const c of working.calls){const mark=c.marks.find(x=>x.memberId===m.id);if(mark)counts[mark.status]++;}body.append(el('p',m.name+' · '+counts.present+' présent(s) · '+counts.absent+' absent(s) · '+counts.excused+' excusé(s)'));}
  }else{
   body.append(el('h3','Appel'));if(!working.slots.length){body.append(el('p','Créez un groupe, des licenciés et un créneau.'));return;}
   const [dl,d]=field('Date','date');d.value=selectedDate;d.addEventListener('change',()=>{selectedDate=d.value;render();});
   const [sl,s]=select('Créneau',working.slots.map(t=>[t.id,groupName(t.groupId)+' · '+t.label]),selectedSlot);selectedSlot=s.value;s.addEventListener('change',()=>{selectedSlot=s.value;render();});body.append(dl,sl);
   const slot=working.slots.find(t=>t.id===selectedSlot),call=working.calls.find(c=>c.date===selectedDate&&c.slotId===selectedSlot);
   const members=working.members.filter(m=>(m.active&&m.groupId===slot.groupId)||call?.marks.some(x=>x.memberId===m.id));
   for(const m of members){const row=el('section');row.append(el('strong',m.name));const current=call?.marks.find(x=>x.memberId===m.id)?.status;for(const [key,title] of Object.entries(labels)){const b=button(title,()=>change(v=>{let c=v.calls.find(x=>x.date===selectedDate&&x.slotId===selectedSlot);if(!c){c={date:selectedDate,slotId:selectedSlot,marks:[]};v.calls.push(c);}c.marks=c.marks.filter(x=>x.memberId!==m.id);c.marks.push({memberId:m.id,status:key});}));b.setAttribute('aria-label',m.name+' : '+title);b.setAttribute('aria-pressed',String(current===key));row.append(b);}if(current)row.append(button('Annuler le statut',()=>change(v=>{const c=v.calls.find(x=>x.date===selectedDate&&x.slotId===selectedSlot);c.marks=c.marks.filter(x=>x.memberId!==m.id);})));body.append(row);}
   if(!members.length)body.append(el('p','Aucun licencié actif pour ce groupe.'));
  }
 }
 render();
 return close;
}
