'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {jsPDF}=require('../vendor/jspdf.js');
require('../ui/session-pdf.js');
const exercise={id:1,nom:'Exercice de test',description:'Consigne complète.',dosage:'2 × 8',competenceCiblee:'Équilibre',organisation:'Alternance Tori Uke',niveauOpposition:'Coopération',vigilance:'Contrôler les appuis.',critere:'Appuis stables'};
const info={groupe:'Adultes',duree:'60 min',objectif:'Progression',participants:20,niveau:'Intermédiaire',thematique:'Ashi-waza',format:'Circuit'};
const phases=['Mobilité','Échauffement','Corps de séance','Retour au calme','Étirements'];
for(const key of ['judo','taiso'])test('PDF '+key+' : A4 rempli et vierge, sans réseau',async()=>{
 for(const blank of [false,true])for(const mode of ['synthetique','detaille']){
  const blob=globalThis.JSBSessionPDF[key](jsPDF,null,info,phases,blank?[[],[],[],[],[]]:[[],[],[exercise],[],[]],{1:20},{1:{dosage:'3 × 12',bloc:'Atelier 1'}},blank,mode);
  assert.equal(blob.type,'application/pdf');const buffer=Buffer.from(await blob.arrayBuffer());assert.equal(buffer.subarray(0,4).toString(),'%PDF');assert.ok(buffer.length>1000);
 }
});
test('Les textes longs sont paginés sans erreur',()=>{
 const long={...exercise,description:'Consigne détaillée et complète. '.repeat(1500)};
 assert.doesNotThrow(()=>globalThis.JSBSessionPDF.judo(jsPDF,null,info,phases,[[],[],[long],[],[]],{1:20},{},false));
});

test('PDF Taïso enregistré : trame historique, deux niveaux de détail et document portable',async()=>{
 const {renderTaisoSavedPdf}=require('../backend/taiso-saved-pdf.cjs');
 const record={title:'Fixture hors connexion',version:'fixture-v1',revision:3,validatedAt:null,stale:false,
  settings:{criteria:{groupe:'Training',niveau:'Intermédiaire',sansMateriel:true,materiel:[]}},
  snapshot:{discipline:'taiso',minutes:60,format:'Séries classiques',missing:['Échauffement'],phases:phases.map((name,i)=>({name,minutes:[5,8,35,4,8][i],unallocatedMinutes:[5,8,30,4,8][i],blocks:i===2?[{name:'Séries classiques',references:['JSB-TAISO-FIXTURE'],organization:{plannedSeconds:null,budgetSeconds:2100,issues:['organization-not-configured']}}]:[],exercises:i===2?[{reference:'JSB-TAISO-FIXTURE',name:'Fixture exercice',allocationMinutes:5,dosage:'8 répétitions',safety:'Fixture sécurité',description:'Fixture consigne',successCriteria:'Fixture critère',prescription:{mode:'Répétitions',repetitions:8}}]:[]}))}};
 for(const mode of ['detaille','synthetique']){
  const buffer=Buffer.from(await renderTaisoSavedPdf(record,mode),'base64');
  assert.equal(buffer.subarray(0,4).toString(),'%PDF');
  assert.ok(buffer.length>1000&&buffer.length<=4*1024*1024);
 }
 await assert.rejects(renderTaisoSavedPdf({...record,snapshot:{...record.snapshot,discipline:'judo'}}),TypeError);
});
