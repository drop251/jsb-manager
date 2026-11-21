'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {analyser}=require('../scripts/taiso-preflight.cjs');
function fiche(id,nom='Squat') {
 return {id,nom,public:['Taïso'],pointSecurite:'Rachis neutre',dosage:'8 répétitions',critereReussite:'Mouvement contrôlé',famille:'Renforcement',niveau:'Débutant',format:'Solo'};
}
test('Un lot de 20 fiches Taïso correctes reste à valider et non pas automatiquement importable',()=>{
 const r=analyser(Array.from({length:20},(_,i)=>fiche(i+1,'Exercice '+(i+1))),{nomFichier:'JSB_Taiso_V46_20_Fiches_Normalisees_A_VALIDER.json'});
 assert.equal(r.statut,'A_VALIDER');assert.equal(r.nombre,20);assert.equal(r.erreurs.length,0);
});
test('Le fichier de contrôle NON IMPORT est interdit même si les fiches paraissent correctes',()=>{
 const r=analyser([fiche(1)],{nomFichier:'JSB_Taiso_V46_Controle_Normalisation_244_NON_IMPORT.json',nombreAttendu:1});
 assert.equal(r.statut,'NO_GO');assert.ok(r.erreurs.some(x=>x.code==='FICHIER_NON_IMPORT'));
});
test('Les identifiants répétés et les lignes Judo sont bloquants',()=>{
 const r=analyser([fiche('1'),{...fiche(1,'Autre'),public:['Judo']}],{nombreAttendu:2});
 assert.equal(r.statut,'NO_GO');
 assert.ok(r.erreurs.some(x=>x.code==='ID_DOUBLON'));
 assert.ok(r.erreurs.some(x=>x.code==='DISCIPLINE_NON_TAISO'));
});
test('Les données source ne sont jamais modifiées et les champs à vérifier sont signalés',()=>{
 const rows=[{id:7,nom:'Test',public:['Taïso']}];const before=JSON.stringify(rows);
 const r=analyser(rows,{nombreAttendu:1});
 assert.equal(JSON.stringify(rows),before);assert.equal(r.statut,'A_VALIDER');
 assert.ok(r.avertissements.some(x=>x.code==='CHAMP_A_VERIFIER'&&x.champ==='dosage'));
});
test('Un nom manquant ou un identifiant absent bloque le lot',()=>{
 const r=analyser([{public:['Taïso'],nom:''}],{nombreAttendu:1});
 assert.equal(r.statut,'NO_GO');
 assert.ok(r.erreurs.some(x=>x.code==='NOM_MANQUANT'));
 assert.ok(r.erreurs.some(x=>x.code==='ID_MANQUANT'));
});
