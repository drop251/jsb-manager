'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function fn(name){
 const i=html.indexOf('  function '+name+'(');assert.ok(i>=0,'Fonction manquante : '+name);
 const j=html.indexOf('\n  }',i);assert.ok(j>i,'Fin fonction manquante : '+name);
 return html.slice(i,j+4);
}
const names=['valeurChampPedagogique','normaliserModeDosageJudo','maximumRepetitionsJudo','repetitionsDoseJudo','secondesDosageJudo','modeDosageJudoDe','dosageMixteAutoriseJudo','compatibleDosageJudo','dosageAfficheJudo','normaliserRoleJudo','normaliserOppositionJudo','verifierNouvelExerciceJudo'];
function init(){const ctx={};vm.createContext(ctx);names.forEach(n=>vm.runInContext(fn(n),ctx));return ctx;}
function fichier(g='Poussins'){
 return {
    nom:'Jeu de répétitions techniques', public:'Judo',
    description:'Déplacement et entrée technique avec contrôle du partenaire.',
    thematique:'Déplacements et apprentissage',dosage:'3 × 6 répétitions',
    vigilance:'Respecter les distances et accompagner chaque mouvement.',
    critere:'Coordonner les appuis et la direction de déplacement.',
    sousGroupes:g,grade:'Blanche-jaune à jaune-orange',famille:'Fondamentaux',
    moment:'Corps de séance',format:'Binôme',equipement:'Tatami + Judogi',
    varianteFacile:'Faire l’entrée à vitesse lente',varianteDifficile:'Ajouter un déplacement',
    competenceCiblee:'Répéter une entrée avec placement et équilibre',
    rolePedagogique:'Acquisition',prerequis:'Aucun',niveauOpposition:'Coopération',
    organisation:'Tori réalise les entrées, Uke accompagne ; alternance après six répétitions, repos 30 s.',
    modeDosageJudo:'Répétitions',repetitions:'6',repetitionsMax:'',dureeBlocMin:''
 };
}
test('Poussins : répétitions seules sans durée de bloc ne sont pas refusées',()=>{
 const c=init();let b=fichier();assert.equal(c.modeDosageJudoDe(b),'Répétitions');
 assert.deepEqual([...c.verifierNouvelExerciceJudo(b,{public:['Judo'],nom:b.nom,sousGroupes:['Poussins']})],[]);
});
test('Mode durée : duree_s suffit, la durée du bloc reste facultative',()=>{
 const c=init(),b=fichier();b.modeDosageJudo='Durée';b.dosage='3 × 20 secondes';b.duree_s='20';b.repetitions='';b.repetitionsMax='';
 assert.deepEqual([...c.verifierNouvelExerciceJudo(b,{public:['Judo'],nom:b.nom,sousGroupes:['Poussins']})],[]);
});
test('Benjamins : durée + répétitions max autorisées avec durée et plafond',()=>{
 const c=init(),b=fichier('Benjamins');
 b.modeDosageJudo='Durée + répétitions max';b.dosage='2 min : maximum 8 répétitions';b.duree_s='120';b.repetitionsMax='8';
 assert.equal(c.modeDosageJudoDe(b),'Durée + répétitions max');
 assert.deepEqual([...c.verifierNouvelExerciceJudo(b,{public:['Judo'],nom:b.nom,sousGroupes:['Benjamins']})],[]);
 assert.equal(c.compatibleDosageJudo({modeDosageJudo:b.modeDosageJudo},{groupe:'Benjamins'}),true);
 assert.equal(c.compatibleDosageJudo({modeDosageJudo:b.modeDosageJudo},{groupe:'Poussins'}),false);
});
test('Modes mixtes refusés chez les plus jeunes et dans les fiches multigroupes Poussins/Benjamins',()=>{
 const c=init(),b=fichier('Poussins');b.modeDosageJudo='Durée + répétitions max';b.dosage='2 min : 8 répétitions maximum';b.duree_s='120';b.repetitionsMax='8';
 assert.match(c.verifierNouvelExerciceJudo(b,{public:['Judo'],nom:b.nom,sousGroupes:['Poussins']}).join(' '),/réservé|autorisé à partir/);
 assert.match(c.verifierNouvelExerciceJudo(b,{public:['Judo'],nom:b.nom,sousGroupes:['Poussins','Benjamins']}).join(' '),/Benjamins/);
});
test('Durée sans valeur et répétitions manquantes : rejet explicite, mais pas du Taïso',()=>{
 const c=init(),b=fichier('Adultes');
 b.modeDosageJudo='Répétitions';b.dosage='Travail technique libre';b.repetitions='';
 assert.match(c.verifierNouvelExerciceJudo(b,{public:['Judo'],nom:b.nom,sousGroupes:['Adultes']}).join(' '),/Répétitions/);
 b.modeDosageJudo='Durée';b.duree_s='';b.dureeBlocMin='';
 assert.match(c.verifierNouvelExerciceJudo(b,{public:['Judo'],nom:b.nom,sousGroupes:['Adultes']}).join(' '),/Durée/);
 assert.deepEqual([...c.verifierNouvelExerciceJudo(b,{public:['Taïso'],nom:b.nom,sousGroupes:['Adultes']})],[]);
});
test('Dosages du catalogue ancien correctement identifiés sans sixième champ imposant du temps',()=>{
 const c=init();
 assert.equal(c.modeDosageJudoDe({dosage:'3 × 8 à 10'}),'Répétitions');
 assert.equal(c.modeDosageJudoDe({dosage:'6 par côté'}),'Répétitions');
 assert.equal(c.modeDosageJudoDe({dosage:'4 répétitions de 20 s'}),'Répétitions');
 assert.equal(c.modeDosageJudoDe({dosage:'30 secondes'}),'Durée');
 assert.equal(c.modeDosageJudoDe({dosage:'5 min, maximum 12 répétitions'}),'Durée + répétitions max');
});
test('Une fiche mixte affiche durée et plafond dans le mode séance directe',()=>{
 const c=init();vm.runInContext(fn('lireDosage'),c);vm.runInContext(fn('planExercice'),c);
 const e={public:['Judo'],modeDosageJudo:'Durée + répétitions max',repetitionsMax:8,duree_s:120,dosage:'2 min',dureeBlocMin:0};
 const pl=c.planExercice({duree:5},e);
 assert.equal(pl.length,1);assert.equal(pl[0].sec,120);
 assert.match(pl[0].reps,/maximum 8/);
 const e2={public:['Judo'],modeDosageJudo:'Répétitions',repetitionsMax:6,dosage:'6 répétitions',dureeBlocMin:0};
 const p2=c.planExercice({duree:4},e2);assert.equal(p2[0].sec,0);assert.match(p2[0].reps,/6/);
});
test('Les champs nécessaires sont exportables et visibles dans le générateur',()=>{
 for (const n of ['modeDosageJudo','repetitionsMax','dureeBlocMin'])
  assert.match(html,new RegExp("'"+n+"'"));
 assert.match(html,/choix\('modeTravailJudo'/);
 assert.match(html,/une fiche en répétitions|Une fiche en répétitions/);
});

test('La durée indicative du planning ne crée pas artificiellement un chronomètre',()=>{
 const c=init();
 assert.equal(c.secondesDosageJudo({dosage:'3 × 6 répétitions',dureeBlocMin:'8'}),0);
 assert.equal(c.modeDosageJudoDe({dosage:'3 × 6 répétitions',dureeBlocMin:'8'}),'Répétitions');
 const b=fichier('Benjamins');
 b.modeDosageJudo='Durée + répétitions max';b.dureeBlocMin='6';b.dosage='Maximum 8 répétitions';b.repetitionsMax='8';b.duree_s='';
 assert.match(c.verifierNouvelExerciceJudo(b,{nom:b.nom,public:['Judo'],sousGroupes:['Benjamins']}).join(' '),/durée/i);
});
test('Le nombre de séries est conservé lorsqu’un plafond de répétitions est renseigné',()=>{
 const c=init();vm.runInContext(fn('lireDosage'),c);vm.runInContext(fn('planExercice'),c);
 const e={public:['Judo'],modeDosageJudo:'Répétitions',repetitionsMax:6,dosage:'3 × 6 répétitions, récup 30 s'};
 const pl=c.planExercice({duree:7},e);
 assert.equal(pl.filter(x=>x.type==='effort').length,3);
 assert.equal(pl.filter(x=>x.type==='recup').length,2);
 assert.ok(pl.filter(x=>x.type==='effort').every(x=>x.sec===0 && /maximum 6/.test(x.reps)));
});
test('PDF : le mode combiné inclut bien le maximum de répétitions',()=>{
 assert.match(html,/\? dosageAfficheJudo\(e\) : e\.dosage/);
 const c=init();
 assert.match(c.dosageAfficheJudo({modeDosageJudo:'Durée + répétitions max',repetitionsMax:8,dosage:'2 min'}),/maximum 8 répétitions/);
});
