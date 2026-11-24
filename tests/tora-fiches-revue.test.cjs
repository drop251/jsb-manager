'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const catalogue=require('../tora/fiches-pedagogiques-a-valider.json');
const Tora=require('../tora/tora-mode.js');

function exercicePourAudit(f) {
  return {id:f.id,nom:f.technical_name,public:['Judo'],
    sousGroupes:['Éveils (4-5 ans)'],typeFiche:'Exercice',
    niveauOpposition:f.opposition,dosage:f.dosage,vigilance:f.safety};
}

test('Les 24 fiches Tora de relecture ne sont ni publiées ni auto-importées',()=>{
 assert.equal(catalogue.format,'jsb-tora-review-drafts');
 assert.equal(catalogue.validation.import_automatique,false);
 assert.equal(catalogue.validation.validation_terrain,false);
 assert.equal(catalogue.nombre,24);
 assert.equal(catalogue.fiches_revue.length,24);
 assert.equal(catalogue.exercices,undefined,'pas de tableau officiel exercices pour import direct');
});

test('Chaque fiche de relecture est cohérente avec une histoire Tora sans écriture',()=>{
 const before=JSON.stringify(catalogue);
 const ids=new Set(),noms=new Set();
 for (let i=0;i<catalogue.fiches_revue.length;i++){
   const f=catalogue.fiches_revue[i];
   const id='JSB-TORA-'+String(i+1).padStart(3,'0');
   assert.equal(f.story_id,id);
   assert.ok(!ids.has(id),'id dupliqué');ids.add(id);
   assert.ok(!noms.has(f.technical_name),'nom dupliqué');noms.add(f.technical_name);
   assert.equal(f.discipline,'Judo');
   assert.equal(f.age_min,4);assert.equal(f.age_max,5);
   assert.ok(f.safety && f.dosage && f.organization && f.prerequisites);
   assert.equal(f.validation_fiche.validation_terrain,false);
   const ex=exercicePourAudit(f);
   assert.equal(Tora.trouver(ex)?.id,id);
   assert.equal(Tora.pourEnfant(ex,'courtes').consigne,f.child_instruction);
   assert.ok(Tora.pourEnfant(ex,'aventure').consigne.includes(f.story));
 }
 assert.equal(JSON.stringify(catalogue),before);
});

test('La couverture serait complète uniquement APRÈS création et validation des fiches Judo',()=>{
 const fiches=catalogue.fiches_revue.map(exercicePourAudit);
 const diag=Tora.auditerCatalogue(fiches);
 assert.equal(diag.pretes,24);
 assert.equal(diag.absentes,0);
 assert.equal(diag.incompatibles,0);
 assert.equal(diag.doublons,0);
});
