'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Tora=require('../tora/tora-mode.js');
const cataloguePublic=require('../illustres/catalogue.json');

function fiche(nom,overrides={}) {
  return {id:'test-'+nom,nom,public:['Judo'],sousGroupes:['Éveils (4-5 ans)'],
    niveauOpposition:'Coopération sans résistance',typeFiche:'Exercice',
    dosage:'3 passages',vigilance:'Arrêt dès gêne',...overrides};
}

test('Audit Tora : distingue histoires prêtes, absentes, incompatibles et doublons',()=>{
 const donnees=[
   fiche('Salut et repères du dojo',{id:1,niveauOpposition:'Aucune'}),
   fiche('Chemin d’appuis au sol',{id:2}),
   fiche('Quadrupédie libre',{id:3,public:['Taïso']}),
   fiche('Parcours libre entre plots',{id:4}),
   fiche('Parcours libre entre plots',{id:5})
 ];
 const initial=JSON.stringify(donnees);
 const audit=Tora.auditerCatalogue({exercices:donnees});
 assert.equal(audit.totalHistoires,24);
 assert.equal(audit.pretes,2);
 assert.equal(audit.incompatibles,1);
 assert.equal(audit.doublons,1);
 assert.equal(audit.absentes,20);
 assert.equal(audit.details.find(d=>d.nomTechnique==='Salut et repères du dojo').exerciceId,1);
 assert.equal(audit.details.find(d=>d.nomTechnique==='Quadrupédie libre').statut,'incompatible');
 assert.equal(JSON.stringify(donnees),initial,'audit en lecture seule');
});

test('Audit Tora : la coopération sans résistance est autorisée, opposition dirigée exclue',()=>{
 const nom='Déplacement coordonné en binôme';
 assert.ok(Tora.trouver(fiche(nom)));
 assert.equal(Tora.trouver(fiche(nom,{niveauOpposition:'Opposition dirigée'})),null);
 assert.equal(Tora.trouver(fiche(nom,{public:['Taïso']})),null);
 assert.equal(Tora.trouver(fiche(nom,{typeFiche:'TECHNIQUE'})),null);
});

test('Audit Tora : le catalogue GitHub public ne constitue pas la base Judo importée',()=>{
 const audit=Tora.auditerCatalogue(cataloguePublic);
 assert.equal(cataloguePublic.exercices.length,10);
 assert.ok(cataloguePublic.exercices.every(e=>e.public.includes('Taïso')));
 assert.equal(audit.totalHistoires,24);
 assert.equal(audit.pretes,0);
 assert.equal(audit.absentes,24);
});

test('Audit Tora : refuse une entrée qui n’est pas un catalogue',()=>{
 assert.throws(()=>Tora.auditerCatalogue(null),/Catalogue attendu/);
 assert.throws(()=>Tora.auditerCatalogue({exercices:{}}),/Catalogue attendu/);
});
