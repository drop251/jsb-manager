'use strict';
const {jsPDF}=require('../vendor/jspdf.js');
require('../ui/session-pdf.js');
const {taiso}=globalThis.JSBSessionPDF;
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
// Use the logo already used by the approved historical PDF, without serving index.html.
const logo=readFileSync(join(__dirname,'../index.html'),'utf8').match(/var LOGO = '(data:image\/png;base64,[A-Za-z0-9+/=]+)';/)?.[1]??null;
async function renderTaisoSavedPdf(record,mode='detaille'){
 if(!record||!record.snapshot||!record.settings||!['detaille','synthetique'].includes(mode))throw TypeError('Fiche invalide');
 const d=record.snapshot,c=record.settings.criteria;
 if(d.discipline!=='taiso'||!c||!Array.isArray(d.phases)||d.phases.length!==5)throw TypeError('Séance invalide');
 const validated=record.validatedAt!==null&&record.validatedAt!==undefined&&!record.stale;
 const status=record.stale?'Catalogue ancien - à revérifier':validated?'Validation déclarée par le propriétaire':'BROUILLON NON VALIDÉ';
 const durations={},plan={};
 const items=d.phases.map(p=>p.exercises.map(e=>{
  const id=e.reference,b=p.blocks.find(b=>b.references.includes(id));
  durations[id]=e.allocationMinutes;
  const prescription=e.prescription.mode==='Durée'?e.prescription.effortSeconds+' s d’effort':e.prescription.repetitions+' répétitions';
  plan[id]={bloc:b?.name||'',dosage:prescription+' | Source : '+e.dosage,travail:'Budget indicatif : '+e.allocationMinutes+' min'};
  return {id,nom:e.name,dosage:e.dosage,vigilance:e.safety,description:e.description||'',critere:e.successCriteria||'',varianteFacile:e.easier||'',varianteDifficile:e.harder||'',equipement:e.equipment||'',accessibilite:e.accessibility||''};
 }));
 const organization=d.phases.flatMap(p=>p.blocks.map(b=>b.name+' : '+(b.organization.plannedSeconds===null?'organisation à préciser':b.organization.plannedSeconds+' s prévus / '+b.organization.budgetSeconds+' s disponibles')+' ; '+JSON.stringify(b.organization.settings||{}))).join('\n');
 const info={groupe:c.groupe,duree:d.minutes+' min',objectif:record.title+' — '+status,format:d.format,niveau:c.niveau,materiel:c.sansMateriel?'Sans matériel':c.materiel.join(', '),
  vigilance:status+'. Catalogue '+record.version+' ; révision '+record.revision+'. Les copies hors connexion ne sont pas actualisées automatiquement.',
  adaptations:d.missing.length?'Phases à revoir : '+d.missing.join(', '):'',note:organization+'\nVérifier séries, récupération et adaptation. Document de consultation, aucune synchronisation.'};
 const names=d.phases.map(p=>p.name+' ('+p.minutes+' min prévues'+(p.unallocatedMinutes?' ; '+p.unallocatedMinutes+' min non attribuées':'')+')');
 const blob=taiso(jsPDF,logo,info,names,items,durations,plan,false,mode);
 const buffer=Buffer.from(await blob.arrayBuffer());
 if(buffer.length>4*1024*1024||buffer.subarray(0,4).toString()!=='%PDF')throw Error('PDF invalide');
 return buffer.toString('base64');
}
module.exports=Object.freeze({renderTaisoSavedPdf});
