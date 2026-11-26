// Local-only reader. No network, session, storage or remote write.
const file=document.querySelector('#offline-file'),status=document.querySelector('#offline-status'),content=document.querySelector('#offline-content');
let run=0;
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const str=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
const int=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
function check(v){
 if(!v||v.schema!=='JSB-TAISO-OFFLINE-1'||!str(v.title,120)||!str(v.version,80)||!int(v.revision,1,2147483647)||!int(v.minutes,45,90)||![45,60,75,90].includes(v.minutes)||!str(v.format,40)||!['Répétitions','Durée'].includes(v.mode)||!['Brouillon non validé','Validation déclarée à l’export','Catalogue ancien à revérifier'].includes(v.status)||!Array.isArray(v.missing)||v.missing.length>20||v.missing.some(x=>!str(x,160))||!Array.isArray(v.phases)||v.phases.length!==5)return false;
 const seen=new Set();
 return v.phases.every(p=>p&&str(p.name,100)&&int(p.minutes,1,90)&&int(p.unallocatedMinutes,0,p.minutes)&&Array.isArray(p.exercises)&&p.exercises.length<=90&&p.exercises.every(e=>{
  if(!e||!str(e.reference,80)||seen.has(e.reference)||!str(e.name,250)||!str(e.dosage,1800)||!str(e.safety,1800)||!int(e.allocationMinutes,1,p.minutes)||!e.prescription||e.prescription.mode!==v.mode||!(v.mode==='Durée'?int(e.prescription.effortSeconds,1,7200):int(e.prescription.repetitions,1,10000)))return false;
  seen.add(e.reference);return true;
 })&&p.exercises.reduce((n,e)=>n+e.allocationMinutes,0)+p.unallocatedMinutes===p.minutes&&Array.isArray(p.blocks)&&p.blocks.length<=8&&p.blocks.every(b=>b&&str(b.name,40)&&int(b.budgetSeconds,0,p.minutes*60)&&(b.plannedSeconds===null||int(b.plannedSeconds,0,10000000))&&Array.isArray(b.issues)&&b.issues.length<=10&&b.issues.every(x=>str(x,100))))&&v.phases.reduce((n,p)=>n+p.minutes,0)===v.minutes;
}
function clear(){run++;file.value='';content.replaceChildren();status.textContent='Aucune fiche ouverte.';}
document.querySelector('#offline-clear').addEventListener('click',clear);
file.addEventListener('change',async()=>{
 const token=++run,selected=file.files?.[0];content.replaceChildren();
 if(!selected){status.textContent='Aucune fiche ouverte.';return;}
 try{
  if(selected.size>524288)throw Error();
  const v=JSON.parse(await selected.text());if(token!==run)return;
  if(!check(v))throw Error();
  const summary=el('section');summary.append(el('h2',v.title),el('p',v.minutes+' min · '+v.format+' · '+v.mode),el('p',v.status+' · Révision '+v.revision+' · Catalogue '+v.version));
  if(v.missing.length)summary.append(el('p','Phases à revoir : '+v.missing.join(' ; ')));
  content.append(summary);
  for(const p of v.phases){
   const section=el('section');section.append(el('h3',p.name+' · '+p.minutes+' min'));
   for(const b of p.blocks)section.append(el('p',b.name+' : '+(b.plannedSeconds===null?'organisation à préciser':b.plannedSeconds+' s prévues / '+b.budgetSeconds+' s disponibles')+(b.issues.length?' — organisation à vérifier':'')));
   for(const e of p.exercises){
    const row=el('article');row.append(el('h3',e.name),el('p',e.prescription.mode==='Durée'?e.prescription.effortSeconds+' s d’effort':e.prescription.repetitions+' répétitions'),el('p','Dosage : '+e.dosage),el('p','Sécurité : '+e.safety),el('p','Budget indicatif : '+e.allocationMinutes+' min'));section.append(row);
   }
   if(p.unallocatedMinutes)section.append(el('p',p.unallocatedMinutes+' min à organiser.'));
   content.append(section);
  }
  status.textContent='Fiche ouverte localement. Copie non authentifiée, aucune synchronisation.';
 }catch{if(token===run){content.replaceChildren();status.textContent='Fichier de séance non conforme.';}}
});
window.addEventListener('pagehide',clear);
