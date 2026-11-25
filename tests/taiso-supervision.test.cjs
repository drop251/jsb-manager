'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

function fn(name) {
  const start = html.indexOf('  function ' + name + '(');
  assert.ok(start >= 0, name + ' absent');
  const end = html.indexOf('\n  }', start);
  assert.ok(end > start, 'Fin introuvable : ' + name);
  return html.slice(start, end + 4);
}

function context() {
  const sansAccent = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const c = {
    sansA: sansAccent,
    sansAcc: sansAccent,
    evite: () => false,
    formatDe: () => 'Solo',
    NIVEAUX_TAISO: ['Débutant', 'Intermédiaire', 'Confirmé', 'Expert']
  };
  vm.createContext(c);
  Object.assign(c, require('../modules/taiso.js').creerSelection(c));
  vm.runInContext(fn('equipementDe'), c);
  return c;
}

test('Un marqueur explicite rend la supervision obligatoire', () => {
  const c = context();
  assert.equal(c.supervisionRequiseTaiso({ tags: 'renforcement, supervision obligatoire' }), true);
  assert.equal(c.supervisionRequiseTaiso({ tags: ['hanches', 'encadrement obligatoire'] }), true);
  assert.equal(c.supervisionRequiseTaiso({ supervisionRequise: true }), true);
  assert.equal(c.supervisionRequiseTaiso({ supervisionRequise: 'Oui' }), true);
  assert.equal(c.supervisionRequiseTaiso({ tags: 'renforcement, training' }), false);
  assert.equal(c.supervisionRequiseTaiso({ supervisionRequise: 'Non' }), false);
});

test('Le générateur Taïso exclut les exercices encadrés par défaut', () => {
  const c = context();
  const e = { nom: 'Traction assistée', tags: 'supervision obligatoire', format: 'Solo', equipement: 'Poids du corps' };
  assert.equal(c.okTaiso(e, { materiel: [] }), false);
  assert.equal(c.okTaiso(e, { materiel: [], supervision: false }), false);
  assert.equal(c.okTaiso(e, { materiel: [], supervision: true }), true);
  assert.equal(c.okTaiso({ nom: 'Squat', tags: 'renforcement', equipement: 'Poids du corps' }, { materiel: [] }), true);
});

test('Les anciens réglages Élastique restent compatibles avec les bandes', () => {
  const c = context();
  const e = { nom: 'Tirage', equipement: 'Bande élastique', format: 'Solo' };
  assert.equal(c.okTaiso(e, { materiel: ['Élastique'] }), true);
  assert.equal(c.okTaiso(e, { materiel: ['Barre fixe'] }), false);
});

test('Expert est sélectionnable uniquement au niveau adapté', () => {
  const c = context();
  assert.equal(c.niveauOk({ niveau: 'Expert' }, 'Expert'), true);
  assert.equal(c.niveauOk({ niveau: 'Expert' }, 'Confirmé'), false);
  assert.equal(c.niveauEffectifTaiso({ groupe: 'Training', niveau: 'Expert' }), 'Expert');
  assert.equal(c.niveauEffectifTaiso({ groupe: 'Training' }), 'Intermédiaire');
  assert.equal(c.niveauEffectifTaiso({ groupe: 'Gym douce', niveau: 'Expert' }), 'Débutant');
});

test('Le matériel Taïso ne répète pas Élastique, sans modifier le Judo', () => {
  const c = context();
  assert.equal(c.equipementDe({ equipement: 'Chaise + élastique + ancrage' }, 'Taïso'), 'Chaise + élastique + ancrage');
  assert.equal(c.equipementDe({ equipement: 'Élastique' }, 'Judo'), 'Tatami + Élastique');
});

test('L’interface propose un consentement explicite et protège les modèles sauvegardés', () => {
  assert.match(html, /section\('gq-supervision', 'Encadrement des exercices sensibles'/);
  assert.match(html, /section\('gq-niveau', 'Niveau du groupe'/);
  assert.match(html, /supervision: !!rep\.supervision/);
  assert.match(html, /if \(!judo && supervisionRequiseTaiso\(parId\[o\.id\]\) && !rep\.supervision\)/);
});


test('La supervision ne revient pas automatiquement depuis les préférences Taïso', () => {
  const debut = 'var s2 = React.useState(function () {';
  const fin = '}), rep = s2[0], setRep = s2[1];';
  const composant = html.indexOf('function Generateur(p) {');
  const i = html.indexOf(debut, composant), j = html.indexOf(fin, i);
  assert.ok(i >= 0 && j > i, 'Initialisation du générateur introuvable');
  const corps = html.slice(i + debut.length, j);
  const rep = vm.runInNewContext('(function () {' + corps + '})()', {
    p: { espace: 'Taïso', sous: 'Training', tout: [], donnees: [{ equipement: 'Poids du corps' }] },
    judo: false, routineInit: [], routineParDefaut: () => [],
    estEveilJudo: () => false, lireJSON: () => ({
      groupe: 'Training', niveau: 'Expert', duree: '45 min', supervision: true
    }),
    cleReponses: 'jsb-test', uniq: valeurs => [...new Set(valeurs)]
  });
  assert.equal(rep.supervision, false, 'La supervision doit être désactivée à chaque ouverture');
  assert.equal(rep.niveau, 'Expert', 'Les préférences non sensibles sont préservées');
  assert.equal(rep.duree, '45 min', 'La durée précédente est conservée');
  const ligneSauvegarde = html.split('\n').find(l => l.includes('if (!judo) ecrireJSON(cleReponses,'));
  assert.ok(ligneSauvegarde, 'Sauvegarde des préférences introuvable');
  assert.doesNotMatch(ligneSauvegarde, /supervision\s*:/, 'Ne pas persister cette autorisation sensible');
});
