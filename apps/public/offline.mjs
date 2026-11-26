// Local-only reader. No network, session, storage or remote write.
const file=document.querySelector('#offline-file'),status=document.querySelector('#offline-status'),content=document.querySelector('#offline-content');
let run=0,working=null,operations=[];
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const str=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
const int=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
function check(v){
 if(!v||v.schema!=='JSB-TAISO-OFFLINE-1'||typeof v.draftId!=='string'||!/^[a-f0-9]{32}$/.test(v.draftId)||typeof v.generation!=='string'||!/^[1-9][0-9]{0,18}$/.test(v.generation)||!int(v.baseEditCount,0,60)||!str(v.title,120)||!str(v.version,80)||!int(v.revision,1,2147483647)||!int(v.minutes,45,90)||![45,60,75,90].includes(v.minutes)||!str(v.format,40)||!['Répétitions','Durée'].includes(v.mode)||!['Brouillon non validé','Validation déclarée à l’export','Catalogue ancien à revérifier'].includes(v.status)||!Array.isArray(v.missing)||v.missing.length>20||v.missing.some(x=>!str(x,160))||!Array.isArray(v.phases)||v.phases.length!==5)return false;
 const seen=new Set();
 return v.phases.every(p=>p&&str(p.name,100)&&int(p.minutes,1,90)&&int(p.unallocatedMinutes,0,p.minutes)&&Array.isArray(p.exercises)&&p.exercises.length<=90&&p.exercises.every(e=>{
  if(!e||!str(e.reference,80)||seen.has(e.reference)||!str(e.name,250)||!str(e.dosage,1800)||!str(e.safety,1800)||!int(e.allocationMinutes,1,p.minutes)||!e.prescription||e.prescription.mode!==v.mode||!(v.mode==='Durée'?int(e.prescription.effortSeconds,1,7200):int(e.prescription.repetitions,1,10000)))return false;
  if(['description','successCriteria','easier','harder','equipment','accessibility'].some(k=>e[k]!==undefined&&!str(e[k],1800)))return false;
  seen.add(e.reference);return true;
 })&&p.exercises.reduce((n,e)=>n+e.allocationMinutes,0)+p.unallocatedMinutes===p.minutes&&Array.isArray(p.blocks)&&p.blocks.length<=8&&p.blocks.every(b=>b&&str(b.name,40)&&Array.isArray(b.references)&&b.references.length<=90&&new Set(b.references).size===b.references.length&&b.references.every(r=>p.exercises.some(e=>e.reference===r))&&int(b.budgetSeconds,0,p.minutes*60)&&(b.plannedSeconds===null||int(b.plannedSeconds,0,10000000))&&Array.isArray(b.issues)&&b.issues.length<=10&&b.issues.every(x=>str(x,100))))&&v.phases.reduce((n,p)=>n+p.minutes,0)===v.minutes;
}
function clear(){run++;working=null;operations=[];file.value='';content.replaceChildren();status.textContent='Aucune fiche ouverte.';}
document.querySelector('#offline-clear').addEventListener('click',clear);
file.addEventListener('change',async()=>{
 const token=++run,selected=file.files?.[0];working=null;operations=[];content.replaceChildren();
 if(!selected){status.textContent='Aucune fiche ouverte.';return;}
 try{
  if(selected.size>524288)throw Error();
  const v=JSON.parse(await selected.text());if(token!==run)return;
  if(!check(v))throw Error();
  working=v;operations=[];render(v);
 }catch{if(token===run){content.replaceChildren();status.textContent='Fichier de séance non conforme.';}}
});

function edit(phase,exercise,action){
 if(!working||working.baseEditCount+operations.length>=60)return;
 const i=phase.exercises.findIndex(e=>e.reference===exercise.reference);if(i<0)return;
 const block=phase.blocks.find(b=>b.references.includes(exercise.reference));
 if(phase.name==='Corps de séance'&&!block)return;
 if(action==='remove'){
  phase.exercises.splice(i,1);phase.unallocatedMinutes+=exercise.allocationMinutes;
  if(block)block.references.splice(block.references.indexOf(exercise.reference),1);
  if(!working.missing.includes(phase.name))working.missing.push(phase.name);
 }else{
  const j=i+(action==='up'?-1:1);if(j<0||j>=phase.exercises.length||(block&&!block.references.includes(phase.exercises[j].reference)))return;
  const other=phase.exercises[j].reference;
  [phase.exercises[i],phase.exercises[j]]=[phase.exercises[j],phase.exercises[i]];
  if(block){const a=block.references.indexOf(exercise.reference),b=block.references.indexOf(other);[block.references[a],block.references[b]]=[block.references[b],block.references[a]];}
 }
 operations.push({action,phase:phase.name,reference:exercise.reference});render(working);
}
function render(v){
  content.replaceChildren();
  const summary=el('section');summary.append(el('h2',v.title),el('p',v.minutes+' min · '+v.format+' · '+v.mode),el('p',(operations.length?'Brouillon modifié localement — non validé':v.status)+' · Révision '+v.revision+' · Catalogue '+v.version));
  if(v.missing.length)summary.append(el('p','Phases à revoir : '+v.missing.join(' ; ')));
  if(operations.length)summary.append(el('p','Organisation à recalculer en ligne. '+operations.length+' modification(s) locale(s).'));
  const save=el('button','Exporter les modifications locales');save.type='button';save.disabled=operations.length===0;
  save.addEventListener('click',()=>{
   if(!working||!operations.length)return;
   const patch={schema:'JSB-TAISO-EDITS-1',draftId:v.draftId,revision:v.revision,version:v.version,generation:v.generation,baseEditCount:v.baseEditCount,edits:operations};
   const url=URL.createObjectURL(new Blob([JSON.stringify(patch)],{type:'application/json'})),a=el('a');a.href=url;a.download='JSB-Taiso-r'+v.revision+'.jsb-edits.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);
   status.textContent='Téléchargement des modifications lancé. Vérifiez le fichier ; importez-le dans Suivi et reprise lors du retour en ligne.';
  });
  summary.append(save);content.append(summary);
  for(const p of v.phases){
   const section=el('section');section.append(el('h3',p.name+' · '+p.minutes+' min'));
   for(const b of p.blocks)section.append(el('p',b.name+' : '+(operations.length?'organisation à recalculer':b.plannedSeconds===null?'organisation à préciser':b.plannedSeconds+' s prévues / '+b.budgetSeconds+' s disponibles')+(b.issues.length?' — organisation à vérifier':'')));
   for(const e of p.exercises){
    const row=el('article');row.append(el('h3',e.name),el('p',e.prescription.mode==='Durée'?e.prescription.effortSeconds+' s d’effort':e.prescription.repetitions+' répétitions'),el('p','Dosage : '+e.dosage),el('p','Sécurité : '+e.safety),el('p','Budget indicatif : '+e.allocationMinutes+' min'));for(const [key,label] of [['description','Exécution'],['successCriteria','Critère de réussite'],['equipment','Matériel'],['easier','Variante plus facile'],['harder','Variante plus difficile'],['accessibility','Accessibilité']])if(e[key])row.append(el('p',label+' : '+e[key]));const block=p.blocks.find(b=>b.references.includes(e.reference)),order=block?block.references:p.exercises.map(x=>x.reference),i=order.indexOf(e.reference);
    const limit=v.baseEditCount+operations.length>=60;
    for(const [action,label,disabled] of [['up','Monter',i<=0],['down','Descendre',i<0||i>=order.length-1],['remove','Retirer',false]]){
     const button=el('button',label);button.type='button';button.disabled=limit||disabled;button.setAttribute('aria-label',label+' '+e.name);
     button.addEventListener('click',()=>edit(p,e,action));row.append(button);
    }
    section.append(row);
   }
   if(p.unallocatedMinutes)section.append(el('p',p.unallocatedMinutes+' min à organiser.'));
   content.append(section);
  }
  status.textContent=operations.length?'Modifications en mémoire uniquement. Exportez-les avant de quitter.':'Fiche ouverte localement. Copie non authentifiée, aucune synchronisation.';

}
window.addEventListener('pagehide',clear);
