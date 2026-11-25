'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
function fn(n) {
 const i=html.indexOf('  function '+n+'('), j=html.indexOf('\n  }',i);
 assert.ok(i>=0 && j>i,n);
 return html.slice(i,j+4);
}
const ctx={estUnilateral:e=>!!e.unilateral,formatsDe:()=>['Circuit','Tabata'],convient:()=>true,niveauOk:()=>true,estImpact:()=>false,zoneDe:()=> 'global',materielBlocs:()=>[]};
vm.createContext(ctx);
for(const n of ['controleTempsGeneration','intervalle','construireBlocs'])vm.runInContext(fn(n),ctx);
const ctrl=(phases,duree='30 min')=>Array.from(ctx.controleTempsGeneration(phases,duree));
test('durée de phase, pauses à organiser, dépassements et durée totale',()=>{
 assert.deepEqual(ctrl([{nom:'Corps de séance',minutes:30,exercices:[{duree:30}]}]),[]);
 assert.match(ctrl([{nom:'Corps de séance',minutes:30,exercices:[{duree:24}]}]).join(' '),/6 min hors exercices/);
 assert.match(ctrl([{nom:'Corps de séance',minutes:30,exercices:[{duree:32}]}]).join(' '),/dépassement de 2 min/);
 assert.match(ctrl([{nom:'Corps de séance',minutes:31,exercices:[{duree:31}]}]).join(' '),/31 min planifiées pour 30 min/);
});
test('temps des intervalles bilatéraux respecté pour toutes les intensités',()=>{
 for(const effort of [15,20,25,30,35,40,45,50]){
   const x=ctx.intervalle({unilateral:true},effort,20,3);
   assert.ok(x.travail.sec*2+5<=effort);
   assert.ok(x.travail.sec>0);
 }
});
test('temps structuré, repetitions indicatives, AMRAP non compté plusieurs fois',()=>{
 const phase=(items,minutes=10,tours=1)=>({nom:'Corps',minutes:30,blocs:[{nom:'Bloc A',minutes,tours,items}]});
 const x=(travail)=>({travail});
 assert.match(ctrl([phase([x({sec:40,cote:true,recupApres:20})],1)]).join(' '),/au moins 1,8 min/);
 assert.match(ctrl([phase([x({reps:'12 répétitions',series:3,recup:45})])]).join(' '),/durée indicative/);
 assert.doesNotMatch(ctrl([phase([x({amrap:8,reps:'10'}),x({amrap:8,reps:'12'})])]).join(' '),/au moins/);
 assert.match(ctrl([phase([])]).join(' '),/bloc vide/);
 assert.match(ctrl([phase([x({sec:30})],32)]).join(' '),/dépassement de 2 min/);
});
test('créneau trop court et Tabata incomplet : pas de bloc artificiel',()=>{
 const e={id:1,nom:'Test'};
 const choisir=pool=>pool.slice(0,1).filter(()=>{if(ctx.pris)return false;ctx.pris=true;return true;});
 assert.equal(ctx.construireBlocs('Circuit',[e],5,false,choisir,'Débutant',{}).length,0);
 ctx.pris=false;
 assert.equal(ctx.construireBlocs('Tabata',[e],20,false,choisir,'Débutant',{}).length,0);
});
