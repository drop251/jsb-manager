'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {controle}=require('../scripts/taiso-verifier-identites.cjs');
const m={items:[{sourceIndex:0,nom:'Face pull élastique',referenceHistorique:'JSB-TAISO-RENF-0055',idApplicatif:null},{sourceIndex:1,nom:'Descente nordique assistée',referenceHistorique:'JSB-TAISO-RENF-0021',idApplicatif:null}]};
test('index Excel est signalé mais ne devient jamais ID applicatif',()=>{
 const r=controle([{index:0,'Nom (exercice)':'Face pull élastique'},{index:1,'Nom (exercice)':'Descente nordique assistée'}],m);
 assert.equal(r.statut,'NO_GO_IMPORT');assert.equal(r.erreurs.length,0);
 assert.equal(r.rencontres[0].idApplicatifObserve,null);
 assert.equal(r.rencontres[0].referenceHistorique,'JSB-TAISO-RENF-0055');
 assert.ok(r.observations.some(x=>x.code==='INDEX_NON_ID'));
});
test('une fiche hors manifeste est bloquée et la référence absente signalée',()=>{
 const r=controle([{nom:'Autre'},{nom:'Face pull élastique'}],m);
 assert.ok(r.erreurs.some(x=>x.code==='FICHE_HORS_MANIFESTE'));
 assert.ok(r.erreurs.some(x=>x.code==='REFERENCE_MANQUANTE_LOT'));
});
test('des noms de fiches répétées bloquent le lot',()=>{
 const r=controle([{nom:'Face pull élastique'},{nom:'FACE PULL ELASTIQUE'}],m);
 assert.ok(r.erreurs.some(x=>x.code==='NOM_REPETE_LOT'));
});
test('une base locale ambigüe est refusée sans affectation arbitraire',()=>{
 const rows=[{nom:'Face pull élastique'},{nom:'Descente nordique assistée'}];
 const base=[{id:57,nom:'Face pull élastique',public:['Taïso']},{id:58,nom:'Face pull élastique',public:['Taïso']},{id:59,nom:'Descente nordique assistée',public:['Taïso']}];
 const before=JSON.stringify([rows,base]);
 const r=controle(rows,m,base);
 assert.ok(r.erreurs.some(x=>x.code==='BASE_LOCALE_AMBIGUE'));
 assert.equal(JSON.stringify([rows,base]),before);
});
test('un ID local observé reste distinct de la référence historique',()=>{
 const r=controle([{nom:'Face pull élastique'},{nom:'Descente nordique assistée'}],m,[{id:901,nom:'Face pull élastique',public:['Taïso']},{id:902,nom:'Descente nordique assistée',public:['Taïso']}]);
 assert.equal(r.erreurs.length,0);
 assert.equal(r.rencontres[0].idApplicatifObserve,901);
 assert.equal(r.rencontres[0].statut,'VALIDATION_HUMAINE_REQUISE');
 assert.equal(r.statut,'NO_GO_IMPORT');
});
test('tout manifeste contenant un ID applicatif pré-attribué est invalide',()=>{
 const bad={items:[{...m.items[0],idApplicatif:55},m.items[1]]};
 const r=controle([{nom:'Face pull élastique'},{nom:'Descente nordique assistée'}],bad);
 assert.ok(r.erreurs.some(x=>x.code==='ID_APPLICATIF_PREATTRIBUE'));
});
