'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Tora = require('../tora/tora-mode.js');

function ex(nom, extras = {}) {
  return {
    nom, sousGroupes: ['Éveils (4-5 ans)'],
    typeFiche: 'Exercice', niveauOpposition: 'Coopération',
    dosage: '3 passages', vigilance: 'Conserver de l’espace entre les enfants.',
    ...extras,
  };
}

test('Tora : 24 histoires et trois modes documentés', () => {
  assert.equal(Tora.nombre, 24);
  assert.deepEqual(Tora.modes, ['sans', 'courtes', 'aventure']);
  assert.equal(Tora.mode('inconnu'), 'sans');
});

test('Tora : uniquement le parcours Judo Éveils 4–5 ans', () => {
  assert.equal(Tora.estEveil('Éveils (4-5 ans)'), true);
  assert.equal(Tora.estEveil('Éveil Judo 4–5 ans'), true);
  assert.equal(Tora.estEveil('Pré-poussins'), false);
  assert.equal(Tora.estEveil('Éveils 6 ans'), false);
  assert.equal(Tora.actif('Judo', 'Éveils (4-5 ans)', 'courtes'), true);
  assert.equal(Tora.actif('Taïso', 'Éveils (4-5 ans)', 'courtes'), false);
  assert.equal(Tora.actif('Judo', 'Pré-poussins', 'aventure'), false);
  assert.equal(Tora.actif('Judo', 'Éveils (4-5 ans)', 'sans'), false);
  assert.equal(Tora.actif('Judo', 'Éveils (4-5 ans)', 'invalid'), false);
});

test('Tora : associations exactes sans approprier la fiche technique', () => {
  const first = ex('Salut et repères du dojo');
  const last = ex('Circuit coopératif de trois ateliers connus');
  const avant = JSON.stringify(first);
  const f = Tora.pourEnfant(first, 'courtes');
  const l = Tora.pourEnfant(last, 'aventure');
  assert.equal(f.id, 'JSB-TORA-001');
  assert.equal(f.titre, 'Tora découvre le dojo');
  assert.equal(l.id, 'JSB-TORA-024');
  assert.equal(typeof l.consigne, 'string');
  assert.equal(JSON.stringify(first), avant, 'la fiche d’exercice demeure intacte');
  assert.equal(first.dosage, '3 passages');
  assert.match(first.vigilance, /espace entre les enfants/);
  assert.equal(Tora.pourEnfant(first, 'sans'), null);
});

test('Tora : normalisation des accents, contrôle des publics et absence de remplacement approximatif', () => {
  assert.equal(Tora.trouver(ex('Saisie douce et relâchement du judogi'))?.id, 'JSB-TORA-015');
  assert.equal(Tora.trouver(ex('  SAISIE DOUCE ET RELACHEMENT DU JUDOGI '))?.id, 'JSB-TORA-015');
  assert.equal(Tora.trouver(ex('Un exercice sans correspondance')), null);
  assert.equal(Tora.trouver(ex('Salut et repères du dojo', { sousGroupes: ['Poussins'] })), null);
});

test('Tora : exclusion des techniques et des situations d’opposition', () => {
  const nom = 'Contourner un partenaire immobile au sol';
  assert.equal(Tora.trouver(ex(nom, { typeFiche: 'Technique' })), null);
  assert.equal(Tora.trouver(ex(nom, { niveauOpposition: 'Opposition dirigée' })), null);
  assert.equal(Tora.trouver(ex(nom, { niveauOpposition: 'Opposition libre' })), null);
  assert.equal(Tora.trouver(ex(nom, { niveauOpposition: 'Sans opposition' }))?.id, 'JSB-TORA-020');
});


test('Tora : les récits originaux complets sont réservés au mode aventure', () => {
  const fiche = ex('Chemin d’appuis au sol');
  const avant = JSON.stringify(fiche);
  const courte = Tora.pourEnfant(fiche, 'courtes');
  const aventure = Tora.pourEnfant(fiche, 'aventure');
  assert.equal(courte.id, aventure.id);
  assert.equal(courte.titre, aventure.titre);
  assert.equal(courte.consigne, 'Pose tes pieds sur les pierres pour aider Tora à traverser.');
  assert.match(aventure.consigne, /rivière enchantée/);
  assert.ok(aventure.consigne.endsWith(courte.consigne));
  assert.ok(aventure.consigne.length > courte.consigne.length);
  assert.equal(JSON.stringify(fiche), avant, 'dosage, vigilance et technique inchangés');
  assert.equal(Tora.pourEnfant(fiche, 'sans'), null);
});

test('Tora : chaîne complète générateur → préparation → PDF et cache déclarés', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
  assert.match(html, /src=["']\.\/tora\/tora-mode\.js["']/);
  assert.match(html, /modeHistoireTora/);
  assert.match(html, /window\.JSBTora\.pourEnfant\(x\.e,/);
  assert.match(html, /window\.JSBTora\.pourEnfant\(e,/);
  assert.match(html, /toraPDF.*?Histoire de Tora/s);
  assert.match(sw, /tora\/tora-mode\.js/);
});
