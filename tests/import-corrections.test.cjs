'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function fn(n,indent=2,start=0){const pad=' '.repeat(indent),a=html.indexOf(pad+'function '+n+'(',start);assert.ok(a>=0);return html.slice(a,html.indexOf('\n'+pad+'}',a)+indent+2);}
function report(){return {ajouts:[],majFiches:[{id:1,nom:'Correction',description:'Nouvelle consigne'}],illustrations:[],videos:[],refuses:[],doublons:[]};}
function fixture(fail=false){const data=new Map([['ajouts',[{id:1,nom:'Ancien'},{id:2,nom:'Conservé'}]],['images',{2:'image conservée'}],['dessins',{}]]),writes=[];const c={CLE_AJOUTS:'ajouts',CLE_IMG_PERSO:'images',CLE_ILLUS_IA:'dessins',IMG_PERSO:{2:'image conservée'},ILLUS_IA:{},ecrireIdMax(){},Stockage:{lire:async k=>data.get(k),ecrireLot:async entries=>{writes.push(entries);if(fail)throw Error('Quota dépassé');for(const[k,v]of entries)data.set(k,v);return true;}}};vm.createContext(c);vm.runInContext(fn('enregistrerFichesImport'),c);return {c,data,writes};}
test('Fiches corrigées et illustrations sont enregistrées dans un seul lot sans effacer les autres fiches',async()=>{
 const f=fixture(),r=report();r.illustrations=[{id:1,image:'nouvelle image'}];await f.c.enregistrerFichesImport(r);
 assert.equal(f.writes.length,1);assert.deepEqual(Array.from(f.writes[0],x=>x[0]),['ajouts','images','dessins']);assert.equal(f.data.get('ajouts').length,2);assert.equal(f.data.get('ajouts')[0].description,'Nouvelle consigne');assert.equal(f.c.IMG_PERSO[2],'image conservée');assert.equal(f.c.IMG_PERSO[1],'nouvelle image');
});
test('L’échec du lot ne modifie pas les images en mémoire ni les données enregistrées',async()=>{
 const f=fixture(true),r=report();r.illustrations=[{id:1,image:'non enregistrée'}];const before=JSON.stringify([...f.data]);await assert.rejects(f.c.enregistrerFichesImport(r),/Quota/);assert.equal(JSON.stringify([...f.data]),before);assert.equal(f.c.IMG_PERSO[1],undefined);
});
test('Un refus pédagogique bloque aussi l’enregistrement direct du lot',async()=>{
 const f=fixture(),r=report();r.refuses=[{nom:'Incomplète'}];await assert.rejects(f.c.enregistrerFichesImport(r),/refusées/);assert.equal(f.writes.length,0);
});
test('Un fichier composé uniquement de corrections atteint bien l’aperçu sans aucune écriture',async()=>{
 let preview=null,msg='';const r=report();const c={BASE:[{id:1,nom:'Ancien'}],verrouImport:{current:false},lectureImport:{current:0},setMsg:v=>msg=v,setRapport:v=>preview=v,estVideo:()=>false,lireFichierExercices:async()=>[{}],preparerAjouts:()=>r,imagesParNom:async()=>({trouvees:[],sansExercice:[]}),videosParNom:()=>({trouvees:[],sansExercice:[],lourdes:[]}),videosDesLignes:()=>[]};vm.createContext(c);vm.runInContext(fn('choisir',4,html.indexOf('  function GestionExercices(')),c);
 c.choisir({target:{files:[{name:'corrections.json',type:'application/json'}],value:'x'}});await new Promise(setImmediate);assert.equal(preview,r);assert.equal(msg,'');
});
