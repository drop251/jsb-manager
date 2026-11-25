'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {jsPDF}=require('../vendor/jspdf.js');
require('../ui/session-pdf.js');
const exercise={id:1,nom:'Exercice de test',description:'Consigne complète.',dosage:'2 × 8',competenceCiblee:'Équilibre',organisation:'Alternance Tori Uke',niveauOpposition:'Coopération',vigilance:'Contrôler les appuis.',critere:'Appuis stables'};
const info={groupe:'Adultes',duree:'60 min',objectif:'Progression',participants:20,niveau:'Intermédiaire',thematique:'Ashi-waza',format:'Circuit'};
const phases=['Mobilité','Échauffement','Corps de séance','Retour au calme','Étirements'];
for(const key of ['judo','taiso'])test('PDF '+key+' : A4 rempli et vierge, sans réseau',async()=>{
 for(const blank of [false,true]){
  const blob=globalThis.JSBSessionPDF[key](jsPDF,null,info,phases,blank?[[],[],[],[],[]]:[[],[],[exercise],[],[]],{1:20},{1:{dosage:'3 × 12',bloc:'Atelier 1'}},blank);
  assert.equal(blob.type,'application/pdf');const buffer=Buffer.from(await blob.arrayBuffer());assert.equal(buffer.subarray(0,4).toString(),'%PDF');assert.ok(buffer.length>1000);
 }
});
test('Les textes longs sont paginés sans erreur',()=>{
 const long={...exercise,description:'Consigne détaillée et complète. '.repeat(1500)};
 assert.doesNotThrow(()=>globalThis.JSBSessionPDF.judo(jsPDF,null,info,phases,[[],[],[long],[],[]],{1:20},{},false));
});
