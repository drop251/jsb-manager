import './attendance-vault.mjs';
import {hasAttendanceVault,createAttendanceVault,openAttendanceVault,attendanceVaultKey} from './attendance-vault.mjs';
const {empty,normalize,merge}=window.JSBAttendance;
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const id=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const day=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
const labels={present:'Présent',absent:'Absent',excused:'Excusé'};
export function mountAttendance(root,{client=null,account=null,live=()=>root.isConnected,prepareOffline=null}={}){
 const online=!!client&&account?.role==='coach';
 let vault=null,base=empty(),working=empty(),revision=0,ready=false,busy=false,tab='appel',selectedSlot='',selectedDate=day(),conflict=null,closed=false;
 const status=el('p');status.setAttribute('role','status');
 const controls=el('section'),body=el('div');root.append(controls,status,body);
 const active=()=>!closed&&live()&&root.isConnected;
 const notify=msg=>{if(active())status.textContent=msg;};
 function close(){closed=true;vault?.close();vault=null;working=base=empty();window.removeEventListener('storage',storageChanged);window.removeEventListener('pagehide',close);}
 function storageChanged(event){if(event.key===attendanceVaultKey&&vault){vault.close();vault=null;ready=false;base=working=empty();conflict=null;render();notify('Le coffre a changé dans une autre fenêtre. Déverrouillez à nouveau.');}}
 window.addEventListener('storage',storageChanged);window.addEventListener('pagehide',close,{once:true});
 const observer=new MutationObserver(()=>{if(!root.isConnected){observer.disconnect();close();}});observer.observe(document.body,{childList:true,subtree:true});
 function button(text,action,disabled=false){const b=el('button',text);b.type='button';b.disabled=busy||disabled;b.addEventListener('click',()=>{if(active()&&!busy)void action();});return b;}
 function field(label,type='text'){const l=el('label',label),i=el('input');i.type=type;if(type==='text')i.maxLength=100;if(type==='password'){i.maxLength=256;i.autocomplete='off';}l.append(i);return [l,i];}
 function select(label,values,current){const l=el('label',label),s=el('select');for(const [v,t] of values){const o=el('option',t);o.value=v;s.append(o);}if(values.some(([v])=>v===current))s.value=current;l.append(s);return [l,s];}
 async function task(fn){if(!active()||busy)return;busy=true;render();try{await fn();}catch(e){notify(e?.message||'Action non confirmée.');}finally{busy=false;if(active())render();}}
 async function readServer(){const r=await client.privateAttendance('read',account.id);if(r.state!=='ready')throw Error('Registre serveur indisponible.');return {revision:r.register.revision,snapshot:normalize(r.register.snapshot)};}
 async function saveLocal(next){if(!vault)return;await vault.save({owner:vault.value.owner,revision,base,working:next},active);}
 async function change(mutator){
  if(!ready||conflict)return;
  await task(async()=>{const next=structuredClone(working);mutator(next);const checked=normalize(next);await saveLocal(checked);if(!active())return;working=checked;notify(vault?'Modification enregistrée dans le coffre local.':'Modification en mémoire. Enregistrez sur le serveur avant de quitter.');});
 }
 async function adopt(remote,next=remote.snapshot){
  const v={owner:account?.id||vault?.value.owner,revision:remote.revision,base:remote.snapshot,working:next};
  if(vault)await vault.save(v,active);
  if(!active())return;
  base=remote.snapshot;working=next;revision=remote.revision;conflict=null;ready=true;
 }
 async function synchronize(){
  if(!online||!ready||conflict)return;
  await task(async()=>{
   const r=await client.privateAttendance('save',account.id,{revision,snapshot:working});
   if(!active())return;
   if(!['ready','conflict'].includes(r.state))throw Error('Synchronisation indisponible. Le travail local est conservé.');
   const remote={revision:r.register.revision,snapshot:normalize(r.register.snapshot)};
   if(r.state==='ready'){await adopt(remote);notify('Synchronisation confirmée · révision '+revision+'.');return;}
   const merged=merge(base,working,remote.snapshot);
   if(merged.state==='ready'){await adopt(remote,merged.snapshot);notify('Modifications indépendantes fusionnées. Vérifiez le registre et confirmez la synchronisation.');}
   else{conflict={remote,choices:{},result:merged};notify('Conflit détecté. Aucune donnée serveur écrasée.');}
  });
 }
 function render(){
  if(!active())return;
  controls.replaceChildren();body.replaceChildren();
  const [pl,p]=field('Phrase secrète du coffre Présences','password');
  if(!ready){
   if(online)controls.append(button('Ouvrir le registre en ligne',()=>task(async()=>{if(hasAttendanceVault())throw Error('Un coffre local existe : déverrouillez-le pour ne pas ignorer les modifications en attente.');const remote=await readServer();await adopt(remote);notify('Registre en ligne ouvert.');})));
   if(hasAttendanceVault())controls.append(pl,button('Déverrouiller le registre local',()=>{const phrase=p.value;p.value='';return task(async()=>{const opened=await openAttendanceVault(phrase);if(!active()||(online&&opened.value.owner!==account.id)){opened.close();throw Error('Ce coffre appartient à un autre compte.');}vault=opened;({revision,base,working}=vault.value);ready=true;notify('Registre local déverrouillé. Aucun droit de session hors connexion n’est confirmé.');});}));
   else if(!online)controls.append(el('p','Aucun registre Présences préparé sur cet appareil. Préparez-le en ligne depuis votre compte Coach.'));
   return;
  }
  if(online){
   controls.append(button('Synchroniser avec le serveur',synchronize,!!conflict));
   if(!vault)controls.append(pl,button('Préparer les présences hors connexion',()=>{const phrase=p.value;p.value='';return task(async()=>{if(phrase.length<12)throw Error('Phrase secrète de 12 caractères minimum.');await prepareOffline();await createAttendanceVault(phrase,{owner:account.id,revision,base,working},active);const opened=await openAttendanceVault(phrase);if(!active()){opened.close();return;}vault=opened;notify('Registre chiffré disponible dans le lecteur hors connexion.');});}));
  }
  if(vault){
   controls.append(button('Verrouiller le registre',()=>{vault.close();vault=null;ready=false;base=working=empty();conflict=null;render();notify('Registre verrouillé.');}));
   controls.append(button('Effacer la copie locale',()=>{if(!confirm('Effacer le registre local et ses modifications non synchronisées ?'))return;return task(async()=>{await vault.remove();vault=null;ready=false;working=base=empty();conflict=null;notify('Copie locale effacée.');});}));
  }
  controls.append(el('p','Révision '+revision+(same(base,working)?' · aucune modification en attente':' · modifications à synchroniser')));
  if(conflict){
   const {remote,result,choices}=conflict;
   body.append(el('h3','Conflits de synchronisation'),el('p','Les données locales et serveur sont conservées. Choisissez chaque version avant de confirmer.'));
   if(result.state==='invalid-merge')body.append(el('p','Les références du registre sont incompatibles. Choisissez de conserver la version serveur ou reprenez manuellement vos données locales. Aucun écrasement automatique.'));
   const describe=v=>v===null?'Aucune valeur':v.status?labels[v.status]:v.name||v.label||(v.date+' · '+v.marks.length+' statut(s)');
   const displayName=key=>{const parts=key.split('/'),last=parts.at(-1),person=[...working.members,...remote.snapshot.members].find(m=>m.id===last);return person?person.name:parts[0]==='calls'?'Appel '+parts[1].slice(0,10):parts[0];};
   for(const c of result.conflicts){
    const row=el('section');row.append(el('h4',displayName(c.key)));
    const [l,s]=select('Version à conserver',[['','Choisir…'],['local','Locale : '+describe(c.local)],['remote','Serveur : '+describe(c.remote)]],choices[c.key]||'');s.addEventListener('change',()=>{choices[c.key]=s.value;});row.append(l);body.append(row);
   }
   if(result.conflicts.length)body.append(button('Appliquer les choix',()=>task(async()=>{if(result.conflicts.some(c=>!['local','remote'].includes(choices[c.key])))throw Error('Choisissez une version pour chaque conflit.');const m=merge(base,working,remote.snapshot,choices);if(m.state!=='ready')throw Error('Fusion incompatible : les deux versions sont conservées.');await adopt(remote,m.snapshot);notify('Conflits résolus localement. Confirmez la synchronisation.');})));
   body.append(button('Conserver la version serveur',()=>{if(!confirm('Abandonner les modifications locales en conflit ?'))return;return task(async()=>{await adopt(remote);notify('Version serveur conservée.');});}));
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
