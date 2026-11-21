'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {rapprocher,rapportMarkdown}=require('../scripts/taiso-rapprochement.cjs');
const fiche=(id,nom)=>({id,nom,public:['Taïso']});
test('Rapprochement exact ID + nom insensible aux accents, sans mutation',()=>{
 const a=[fiche(1,'Équilibre sur un pied')],b=[fiche('1','Equilibre sur un pied')];
 const original=JSON.stringify([a,b]);const r=rapprocher(a,b);
 assert.equal(r.entrees[0].statut,'CORRESPONDANCE_ID_NOM');
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

test('Deux fiches de même ID et nom divergent sur le dosage : conflit de contenu',()=>{
 const a=[{...fiche(7,'Gainage'),dosage:'30 secondes',famille:'Renforcement'}];
 const b=[{...fiche(7,'Gainage'),dosage:'12 répétitions',famille:'Renforcement'}];
 const r=rapprocher(a,b);
 assert.equal(r.entrees[0].statut,'CONFLIT_CONTENU');
 assert.deepEqual(r.entrees[0].comparaison.divergences,['dosage']);
});
test('Un champ absent dans la référence ne vaut pas confirmation du contenu',()=>{
 const r=rapprocher([{...fiche(8,'Fente'),dosage:'8 répétitions'}],[fiche(8,'Fente')]);
 assert.equal(r.entrees[0].statut,'CORRESPONDANCE_ID_NOM');
 assert.ok(r.entrees[0].comparaison.nonComparables.includes('dosage'));
 assert.equal(r.decision,'NO_GO_IMPORT');
});
test('Les synonymes de sécurité connus sont comparés',()=>{
 const r=rapprocher([{...fiche(9,'Squat'),pointSecurite:'Genou aligné'}],[{...fiche(9,'Squat'),vigilance:'Genou valgus interdit'}]);
 assert.equal(r.entrees[0].statut,'CONFLIT_CONTENU');
 assert.ok(r.entrees[0].comparaison.divergences.includes('securite'));
});

test('Rapport Markdown : toutes les fiches, informations comparables et visa staff figurent',()=>{
 const r=rapprocher([{...fiche(12,'Gainage | ventral'),dosage:'30 secondes'},{...fiche(13,'Squat'),dosage:'8 répétitions'}],[{...fiche(12,'Gainage | ventral'),dosage:'10 répétitions'},fiche(13,'Squat')]);
 const md=rapportMarkdown(r);
 assert.ok(md.includes('NO GO IMPORT'));
 assert.ok(md.includes('Gainage \\| ventral'));
 assert.ok(md.includes('CONFLIT_CONTENU'));
 assert.ok(md.includes('dosage'));
 assert.ok(md.includes('non comparables') || md.includes('non comparables'.replace('non','non')));
 assert.ok(md.includes('À renseigner'));
 assert.ok(md.includes('Visa du staff'));
 assert.equal(md.split('\\n').filter(x=>x.includes('À renseigner')).length,2);
});
test('Rapport Markdown : refus d’un objet sans entrées',()=>{
 assert.throws(()=>rapportMarkdown({}),/invalide/);
});
