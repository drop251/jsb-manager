'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const racine = path.resolve(__dirname, '..');
const sw = fs.readFileSync(path.join(racine, 'sw.js'), 'utf8');

function ressourcesPrecachees() {
  const declaration = sw.match(/\bvar\s+FICHIERS\s*=\s*(\[[\s\S]*?\]);/);
  assert.ok(declaration, 'Liste FICHIERS absente du service worker');
  const fichiers = vm.runInNewContext(declaration[1], Object.create(null), { timeout: 1000 });
  assert.ok(Array.isArray(fichiers), 'FICHIERS doit etre un tableau');
  return Array.from(fichiers);
}

test('PWA : toutes les ressources de precache existent dans le depot', () => {
  const fichiers = ressourcesPrecachees();
  assert.ok(fichiers.length > 0, 'Precache vide');
  for (const valeur of fichiers) {
    assert.equal(typeof valeur, 'string', 'Chemin non textuel');
    assert.match(valeur, /^\.\/[a-zA-Z0-9._/-]*$/, 'Chemin de precache non local');
    const relatif = valeur === './' ? 'index.html' : valeur.slice(2);
    assert.ok(relatif && !relatif.split('/').includes('..'), 'Chemin invalide : ' + valeur);
    const cible = path.resolve(racine, relatif);
    assert.ok(cible.startsWith(racine + path.sep), 'Chemin hors du depot : ' + valeur);
    assert.ok(fs.statSync(cible, { throwIfNoEntry: false })?.isFile(), 'Ressource absente : ' + valeur);
  }
});

test('PWA : pas de doublons, socle de navigation et controle tactile precaches', () => {
  const fichiers = ressourcesPrecachees();
  assert.equal(new Set(fichiers).size, fichiers.length, 'Doublons dans le precache');
  for (const obligatoire of ['./', './index.html', './jsb-edge-swipe.js', './manifest.webmanifest']) {
    assert.ok(fichiers.includes(obligatoire), 'Ressource obligatoire absente : ' + obligatoire);
  }
});

test('PWA : noms de cache versionnes et handlers install, activate, fetch declares', () => {
  assert.match(sw, /\bvar\s+CACHE\s*=\s*['"]jsb-manager-[^'"]+['"]/);
  for (const evenement of ['install', 'activate', 'fetch']) {
    assert.ok(sw.includes("self.addEventListener('" + evenement + "'"), evenement + ' non gere');
  }
});
