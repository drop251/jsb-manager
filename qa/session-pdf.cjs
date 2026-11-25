'use strict';
const fs=require('node:fs'),path=require('node:path');
const {jsPDF}=require('../vendor/jspdf.js');
require('../ui/session-pdf.js');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const logo=html.match(/var LOGO = '([^']+)'/)[1];
const base={description:'Respecter une amplitude maîtrisée et adapter la difficulté au niveau du groupe.',critere:'Réaliser le mouvement avec contrôle.',vigilance:'Conserver des appuis stables.',varianteFacile:'Réduire l’amplitude.',varianteDifficile:'Augmenter progressivement la difficulté.'};
const ex=(id,nom,extra)=>({...base,id,nom,...extra});
const fixtures={
 judo:{phases:['Préparation motrice','Acquisition technique','Réinvestissement','Randori','Retour au calme et bilan'],info:{groupe:'Benjamins',duree:'60 min',objectif:'Construire un déséquilibre en déplacement.',thematique:'Ashi-waza'},names:['Déplacements et ukemi','Entrées en déplacement','Situation évolutive','Randori à thème','Bilan des acquisitions'],times:[10,20,15,10,5]},
 taiso:{phases:['Mobilité','Échauffement','Corps de séance','Retour au calme','Étirements'],info:{groupe:'Training',duree:'60 min',objectif:'Renforcement musculaire',participants:20,niveau:'Intermédiaire',materiel:'Sans matériel',format:'Circuit'},names:['Mobilité articulaire','Activation progressive','Squat','Respiration','Étirements doux'],times:[5,5,40,5,5]}
};
(async()=>{
 fs.mkdirSync('qa-pdf',{recursive:true});
 for(const [key,f] of Object.entries(fixtures)){
  const items=f.names.map((name,i)=>[ex(i+1,name,key==='judo'?{competenceCiblee:'Déséquilibrer et projeter',rolePedagogique:f.phases[i],organisation:'Alternance Tori / Uke',niveauOpposition:'Adaptée au niveau',prerequis:'Chutes maîtrisées',dosage:'3 répétitions'}:{dosage:'12 répétitions',recuperation:'20 s',equipement:'Poids du corps'})]);
  if(key==='taiso')items[2].push(ex(6,'Pompes',{dosage:'10 répétitions',recuperation:'20 s'}),ex(7,'Fentes alternées',{dosage:'12 répétitions',recuperation:'20 s'}),ex(8,'Gainage',{dosage:'30 s',recuperation:'20 s'}));
  const durations=Object.fromEntries(f.times.map((v,i)=>[i+1,v]));if(key==='taiso'){durations[3]=10;durations[6]=10;durations[7]=10;durations[8]=10;}
  const plan={3:{dosage:key==='judo'?'4 répétitions':'15 répétitions',bloc:key==='taiso'?'Atelier 1':''},6:{bloc:'Atelier 1'},7:{bloc:'Atelier 1'},8:{bloc:'Atelier 1'}};
  const blank=globalThis.JSBSessionPDF[key](jsPDF,logo,{},f.phases,f.phases.map(()=>[]),{},{},true);
  fs.writeFileSync('qa-pdf/'+key+'-vierge.pdf',Buffer.from(await blank.arrayBuffer()));
  for(const mode of ['synthetique','detaille']){
   const blob=globalThis.JSBSessionPDF[key](jsPDF,logo,f.info,f.phases,items,durations,plan,false,mode);
   fs.writeFileSync('qa-pdf/'+key+'-'+mode+'.pdf',Buffer.from(await blob.arrayBuffer()));
  }
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
