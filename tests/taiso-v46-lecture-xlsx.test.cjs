'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function fonction(n){
 const d='  function '+n+'(';
 const i=html.indexOf(d);assert.ok(i>=0,'Fonction absente : '+n);
 const j=html.indexOf('\n  }',i);assert.ok(j>=0,'Fin de fonction absente');
 return html.slice(i,j+4);
}
function fixture(rows){
 const ctx={
   window:{},Promise,
   XLSX:{read(input,options){ctx.reads.push({input,options});return {SheetNames:['Exercices'],Sheets:{Exercices:{}}};},
      utils:{sheet_to_json(){return rows;}}},
   reads:[],
   imagesDuClasseur(){return {};},
   reduireImage(){throw Error('Aucune image attendue');}
 };
 ctx.window.XLSX=ctx.XLSX;
 vm.createContext(ctx);vm.runInContext(fonction('lireFichierExercices'),ctx);
 return ctx;
}
test('Le parcours ajout/correction lit un fichier XLSX sans traiter index comme ID',async()=>{
 const rows=[{'index':0,'Nom (exercice)':'Face pull élastique',Discipline:'Taïso', 'Point de sécurité':'Ancrage fixe'}];
 const c=fixture(rows),f={name:'lot-v46.xlsx',arrayBuffer:async()=>new ArrayBuffer(8)};
 const res=await c.lireFichierExercices(f);
 assert.equal(res.length,1);
 assert.equal(res[0].index,0);
 assert.equal(res[0].id,undefined);
 assert.equal(c.reads[0].options.type,'array');
});
test('Le lecteur XLSX restitue toutes les lignes de la feuille sans inventer des IDs',async()=>{
 const rows=Array.from({length:20},(_,i)=>({'index':i,'Nom (exercice)':'Exercice '+(i+1),Discipline:'Taïso'}));
 const c=fixture(rows),res=await c.lireFichierExercices({name:'v46.xlsx',arrayBuffer:async()=>new ArrayBuffer(2)});
 assert.equal(res.length,20);
 assert.ok(res.every(e=>!Object.hasOwn(e,'id')));
});
test('L import Excel échoue clairement si la bibliothèque XLSX est absente',async()=>{
 const c=fixture([]);c.window.XLSX=null;
 await assert.rejects(c.lireFichierExercices({name:'v46.xlsx',arrayBuffer:async()=>new ArrayBuffer(2)}),/outil/);
});

test('Un classeur de contrôle NON_IMPORT est refusé avant toute lecture de données',async()=>{
 const c=fixture([]);
 let lu=false;
 await assert.rejects(
   c.lireFichierExercices({name:'JSB_Taiso_V46_Controle_Normalisation_244_NON_IMPORT.xlsx',
     arrayBuffer:async()=>{lu=true;return new ArrayBuffer(2);}}),
   /NON IMPORT/
 );
 assert.equal(lu,false);
 assert.equal(c.reads.length,0);
});
test('Le refus couvre aussi un nom de contrôle contenant des espaces ou tirets',async()=>{
 const c=fixture([]);
 for(const name of ['controle NON IMPORT.csv','controle-non-import.json','controle.non_import.xlsx']){
   await assert.rejects(c.lireFichierExercices({name,text:async()=>{throw Error('L\u2019import ne doit pas commencer');},arrayBuffer:async()=>{throw Error('L\u2019import ne doit pas commencer');}}),/NON IMPORT/);
 }
});
test('Un lot candidat explicitement À VALIDER suit la lecture habituelle, sans import implicite',async()=>{
 const c=fixture([{'Nom (exercice)':'Face pull élastique'}]);
 const rows=await c.lireFichierExercices({name:'JSB_Taiso_V46_20_Fiches_Normalisees_A_VALIDER.xlsx',arrayBuffer:async()=>new ArrayBuffer(2)});
 assert.equal(rows.length,1);
 assert.equal(c.reads.length,1);
});
