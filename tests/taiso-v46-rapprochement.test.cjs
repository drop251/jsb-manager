'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {rapprocher}=require('../scripts/taiso-rapprochement.cjs');
const fiche=(id,nom)=>({id,nom,public:['Taïso']});
test('Rapprochement exact ID + nom insensible aux accents, sans mutation',()=>{
 const a=[fiche(1,'Équilibre sur un pied')],b=[fiche('1','Equilibre sur un pied')];
 const original=JSON.stringify([a,b]);const r=rapprocher(a,b);
 assert.equal(r.entrees[0].statut,'CORRESPONDANCE_EXACTE');
 assert.equal(r.decision,'NO_GO_IMPORT');
 assert.equal(JSON.stringify([a,b]),original);
});
test('Un ID connu avec nom divergent est signalé comme conflit',()=>{
 const r=rapprocher([fiche(1,'Squat')],[fiche(1,'Fente')]);
 assert.equal(r.entrees[0].statut,'CONFLIT_ID_NOM');
});
test('Un nom connu avec autre ID n’entraîne aucune fusion',()=>{
 const r=rapprocher([fiche(2,'Squat')],[fiche(1,'Squat')]);
 assert.equal(r.entrees[0].statut,'NOM_SEUL');assert.equal(r.entrees[0].references.length,1);
});
test('Ambiguïté si ID et nom désignent des références différentes',()=>{
 const r=rapprocher([fiche(5,'Squat')],[fiche(5,'Fente'),fiche(6,'Squat')]);
 assert.equal(r.entrees[0].statut,'AMBIGU_REFERENCE');
 assert.equal(r.entrees[0].references.length,2);
});
test('Doublons internes et lignes incomplètes sont isolés',()=>{
 const r=rapprocher([fiche(1,'Squat'),fiche('1','Autre'),fiche(3,'')],[]);
 assert.equal(r.entrees[0].statut,'AMBIGU_CANDIDATS');
 assert.equal(r.entrees[1].statut,'AMBIGU_CANDIDATS');
 assert.equal(r.entrees[2].statut,'INCOMPLET');
});
test('Aucune correspondance ne signifie pas validation de création',()=>{
 const r=rapprocher([fiche(100,'Exercice inconnu')],[fiche(2,'Squat')]);
 assert.equal(r.entrees[0].statut,'AUCUNE_CORRESPONDANCE');
 assert.equal(r.decision,'NO_GO_IMPORT');
});
test('Les deux comptes réels figurent au rapport, aucune hypothèse de 20/244',()=>{
 const r=rapprocher([fiche(1,'X')],[fiche(1,'X'),fiche(2,'Y')]);
 assert.equal(r.totalCandidats,1);assert.equal(r.totalControle,2);
});
