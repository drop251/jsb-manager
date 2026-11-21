'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../docs/manifeste-corrections-taiso-v46.NON_IMPORT.json'),'utf8'));
function source(name){
 const key='  function '+name+'(';const i=html.indexOf(key);assert.ok(i>=0,name);
 const end=html.indexOf('\n  }',i);assert.ok(end>i);
 return html.slice(i,end+4);
}
function env(){
 const c={
  IMG_PERSO:{},ILLUS_IA:{},VIDEOS:{},lireIdMax:()=>5000,
  cle:v=>String(v??'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,''),
  illustrationDe:()=>({image:'',svg:'',lien:false}),
  classer:l=>({nom:l['Nom (exercice)'],public:['Taïso'],typeFiche:l['Type de fiche']||'Exercice',
    description:l['Exécution'],dosage:l['Dosage de base'],
    vigilance:l['Point de sécurité'],critere:l['Critère de réussite'],
    famillePrincipale:l['Famille principale'],sousFamille:l['Sous-famille'],tags:l.Tags,
    accessibilite:l.Accessibilité,inspiration:l.Inspiration}),
  verifierNouvelExerciceJudo:()=>[],
  formeEnfants:()=>({})
 };
 vm.createContext(c);
 vm.runInContext(source('valeurChampPedagogique'),c);
 vm.runInContext(source('preparerAjouts'),c);
 return c;
}
function row(item,i){
 return {'index':i,'Nom (exercice)':item.nom,'Discipline':'Taïso','Type de fiche':'Exercice',
   'Exécution':'Consigne pédagogique V46 à contrôler sur appareil, ligne '+(i+1),
   'Point de sécurité':'Vérifier la sécurité du mouvement',
   'Dosage de base':'2 séries, dosage de test','Critère de réussite':'Mouvement contrôlé',
   'Famille principale':'Renforcement','Sous-famille':'À vérifier',
   Accessibilité:'Encadrement adapté',Inspiration:'Jeu de données simulé — PAS un export des classeurs',Tags:'QA'};
}
function anciens(){
 return manifest.items.map((item,i)=>({id:20001+i,nom:item.nom,public:['Taïso'],typeFiche:'Exercice',
  description:'Consigne ancienne',image:i===0?'data:image/png;base64,AAAA':undefined,
  famillePrincipale:'Renforcement',sousFamille:'Historique',ajoute:false}));
}
test('V46 : aperçu de 20 corrections sur fiches locales correspondantes = 20 mises à jour et 0 ajout',()=>{
 const ctx=env(),base=anciens(),before=JSON.stringify(base);
 const report=ctx.preparerAjouts(manifest.items.map(row),base);
 assert.equal(report.majFiches.length,20);
 assert.equal(report.ajouts.length,0);
 assert.equal(report.refuses.length,0);
 assert.equal(report.doublons.length,0);
 assert.deepEqual(report.majFiches.map(e=>e.id),base.map(e=>e.id));
 assert.equal(report.majFiches[0].image,'data:image/png;base64,AAAA');
 assert.equal(JSON.stringify(base),before);
});
test('V46 : une fiche locale absente devient proposition d’ajout et doit déclencher NO GO',()=>{
 const ctx=env(),base=anciens().slice(0,19);
 const report=ctx.preparerAjouts(manifest.items.map(row),base);
 assert.equal(report.majFiches.length,19);
 assert.equal(report.ajouts.length,1);
 assert.equal(report.ajouts[0].nom,manifest.items[19].nom);
 assert.notEqual(report.ajouts[0].id,manifest.items[19].referenceHistorique);
 assert.equal(report.ajouts.length===0&&report.majFiches.length===20,false);
});
test('V46 : un homonyme Judo ne doit pas être modifié comme fiche Taïso',()=>{
 const ctx=env(),base=anciens();
 base[0]={...base[0],public:['Judo']};
 const report=ctx.preparerAjouts(manifest.items.map(row),base);
 assert.equal(report.ajouts.length,1);
 assert.equal(report.majFiches.length,19);
 assert.ok(report.majFiches.every(x=>x.public[0]==='Taïso'));
});
test('V46 : modification de correction ne doit pas changer le nombre de fiches avant confirmation',()=>{
 const ctx=env(),base=anciens(),original=JSON.stringify(base);
 ctx.preparerAjouts(manifest.items.map(row),base);
 assert.equal(JSON.stringify(base),original);
});
