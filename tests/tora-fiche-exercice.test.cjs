'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Tora=require('../tora/tora-mode.js');
function fiche(extras={}) {
 return {id:'JUDO-EVEIL-003',nom:'Chemin d’appuis au sol',
  public:['Judo'],sousGroupes:['Éveils (4-5 ans)'],
  typeFiche:'Exercice',niveauOpposition:'Sans opposition',
  vigilance:'Marques stables, pas de saut imposé',dosage:'3 passages',...extras};
}
test('Le récit Tora dépend de la fiche Éveil et ne modifie aucune donnée',()=>{
 const e=fiche(),avant=JSON.stringify(e);
 const story=Tora.fichePedagogique(e);
 assert.equal(story.id,'JSB-TORA-003');
 assert.match(story.titre,/pierres magiques/i);
 assert.match(story.histoire,/rivière enchantée/);
 assert.match(story.consigne,/Pose tes pieds/);
 assert.equal(JSON.stringify(e),avant);
 assert.equal(e.vigilance,'Marques stables, pas de saut imposé');
 assert.equal(e.dosage,'3 passages');
});
test('Tora exige une fiche explicitement Judo Éveil 4–5 ans et sans opposition inappropriée',()=>{
 const invalides=[{public:[]},{public:['Taïso']},{sousGroupes:[]},
  {sousGroupes:['Poussins']},{sousGroupes:['Éveils (4-6 ans)']},
  {typeFiche:'Technique'},{niveauOpposition:'Opposition libre'},
  {niveauOpposition:'Opposition dirigée'},{nom:'Exercice sans histoire'}];
 invalides.forEach(x=>assert.equal(Tora.fichePedagogique(fiche(x)),null,JSON.stringify(x)));
 assert.equal(Tora.fichePedagogique(null),null);
});

test('Les champs pédagogiques explicites sont obligatoires pour le récit et le diagnostic',()=>{
 const invalides=[{typeFiche:undefined},{typeFiche:'Autre'},{niveauOpposition:undefined},
  {niveauOpposition:''},{sousGroupes:['Éveils']},{sousGroupes:['Éveils 4 ans']}];
 invalides.forEach(x=>{
  const e=fiche(x);
  assert.equal(Tora.fichePedagogique(e),null,JSON.stringify(x));
  const audit=Tora.auditerCatalogue([e]);
  assert.equal(audit.pretes,0);
  assert.equal(audit.incompatibles,1);
 });
 assert.equal(Tora.auditerCatalogue([fiche()]).pretes,1);
});
