'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

function fonction(nom) {
  const start = html.indexOf('  function ' + nom + '(');
  assert.ok(start !== -1, nom + ' introuvable');
  const end = html.indexOf('\n  }', start);
  assert.ok(end > start, 'Fin introuvable : ' + nom);
  return html.slice(start, end + 4);
}

function verifier(lignes, base = []) {
  const cle = texte => String(texte || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const c = {
    cle,
    lireIdMax: () => 5000,
    IMG_PERSO: {}, ILLUS_IA: {}, VIDEOS: {},
    illustrationDe: () => ({ image: '', svg: '', lien: '' }),
    classer: brut => brut.nom ? {
      nom: brut.nom, ref: brut.ref || '', public: [brut.public || 'Taïso'],
      typeFiche: brut.typeFiche || 'Exercice',
      description: brut.description || brut.nom,
      ajoute: true
    } : null,
    valeurChampPedagogique: (brut, noms) => String(noms.map(n => brut[n]).find(v => v != null && v !== '') || ''),
    verifierNouvelExerciceJudo: () => [],
    formeEnfants: () => ({})
  };
  vm.createContext(c);
  vm.runInContext(fonction('preparerAjouts'), c);
  return c.preparerAjouts(lignes, base);
}

const candidat = (nom, ref, description = 'Description pédagogique de la progression') =>
  ({ nom, ref, description, public: 'Taïso' });

test('L’aperçu connaît le nombre exact de lignes, sans modifier la base source', () => {
  const base = [{ id: 10, nom: 'Pompe', ref: 'A10', public: ['Taïso'], typeFiche: 'Exercice' }];
  const avant = JSON.stringify(base);
  const r = verifier([candidat('Squat', 'A11')], base);
  assert.equal(r.totalLignes, 1);
  assert.equal(r.ajouts.length, 1);
  assert.equal(r.refuses.length, 0);
  assert.equal(JSON.stringify(base), avant);
});

test('Deux lignes du même exercice déclenchent un refus du lot', () => {
  const r = verifier([candidat('Pont fessier', 'A11'), candidat('PONT FESSIER', 'A11')]);
  assert.equal(r.totalLignes, 2);
  assert.equal(r.refuses.length, 1);
  assert.match(r.refuses[0].raisons.join(' '), /répété dans ce fichier/);
});

test('Une même référence pour deux fiches distinctes est refusée', () => {
  const r = verifier([candidat('Squat', 'JSB-003'), candidat('Fente', 'JSB-003')]);
  assert.equal(r.refuses.length, 1);
  assert.match(r.refuses[0].raisons.join(' '), /Référence utilisée par plusieurs exercices/);
});

test('La référence d’une fiche existante ne peut pas être détournée', () => {
  const base = [{ id: 25, nom: 'Pont fessier', ref: 'JSB-0013', public: ['Taïso'], typeFiche: 'Exercice' }];
  const r = verifier([candidat('Pompes debout', 'JSB-0013')], base);
  assert.equal(r.ajouts.length, 0);
  assert.equal(r.majFiches.length, 0);
  assert.equal(r.refuses.length, 1);
  assert.match(r.refuses[0].raisons.join(' '), /déjà associée à une autre fiche/);
});

test('Une mise à jour de la même référence et du même exercice est possible', () => {
  const base = [{ id: 25, nom: 'Pont fessier', ref: 'JSB-0013', public: ['Taïso'], typeFiche: 'Exercice', ajoute: true }];
  const r = verifier([candidat('Pont fessier', 'JSB-0013')], base);
  assert.equal(r.refuses.length, 0);
  assert.equal(r.majFiches.length, 1);
  assert.equal(r.majFiches[0].id, 25);
});

test('L’import exige une confirmation après l’aperçu, avec précaution pour les gros lots', () => {
  assert.match(html, /var nbFiches = \(rapport\.ajouts \|\| \[\]\)\.length/);
  assert.match(html, /if \(nbFiches >= 20\)/);
  assert.match(html, /if \(!window\.confirm\(question\)\)/);
  assert.match(html, /ligne\(s\) analysée\(s\) en aperçu, sans écriture/);
  assert.match(html, /if \(rapport\.refuses && rapport\.refuses\.length\)/);
});
