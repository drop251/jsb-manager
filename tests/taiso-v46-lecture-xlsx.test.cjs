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
