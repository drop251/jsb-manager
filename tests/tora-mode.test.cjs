const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Tora = require('../tora/tora-mode.js');
const root = path.join(__dirname, '..');
const judo = {
  nom: 'Chemin d’appuis au sol',
  sousGroupes: ['Éveils (4-5 ans)'],
  niveauOpposition: 'Sans opposition',
  typeFiche: 'Exercice',
  dosage: '3 passages',
  vigilance: 'Cerceaux plats, pas de saut imposé'
};
test('Tora : 24 récits, éligibilité limitée au Judo Éveil', () => {
  assert.equal(Tora.nombre, 24);
  assert.equal(Tora.estEveil('Éveils (4-5 ans)'), true);
  assert.equal(Tora.estEveil('Pré-poussins'), false);
  assert.equal(Tora.actif('Judo', 'Éveils (4-5 ans)', 'aventure'), true);
  assert.equal(Tora.actif('Taïso', 'Éveils (4-5 ans)', 'aventure'), false);
  assert.equal(Tora.actif('Judo', 'Poussins', 'courtes'), false);
  assert.equal(Tora.actif('Judo', 'Éveils (4-5 ans)', 'sans'), false);
});
test('Tora : correspondance stricte, aucun récit inventé', () => {
  const story = Tora.trouver(judo);
  assert.ok(story);
  assert.match(story.titre, /pierres magiques/i);
  assert.equal(Tora.pourEnfant({...judo, nom:'Exercice absent'}, 'courtes'), null);
  assert.equal(Tora.pourEnfant(judo, 'sans'), null);
});
test('Tora : sécurité et périmètre inchangés', () => {
  const before=JSON.stringify(judo);
  assert.equal(Tora.trouver({...judo,typeFiche:'Technique'}), null);
  assert.equal(Tora.trouver({...judo,niveauOpposition:'Opposition dirigée'}), null);
  assert.equal(Tora.trouver({...judo,sousGroupes:['Benjamins']}), null);
  assert.ok(Tora.pourEnfant(judo,'aventure'));
  assert.equal(JSON.stringify(judo),before);
});
test('JSB : scripts Tora chargés et précachés par le service worker', () => {
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
  assert.match(html, /src="\.\/tora\/tora-mode\.js"/);
  assert.match(sw, /\.\/tora\/tora-mode\.js/);
  assert.match(html, /infos\.modeHistoireTora\s*=/);
  assert.match(html, /majInfo\('modeHistoireTora'/);
  assert.match(html, /toraPDF\.consigne/);
});
test('JSB : le script principal reste syntaxiquement valide', () => {
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const sections=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  const js=sections.map(x=>x[1]).sort((a,b)=>b.length-a.length)[0];
  assert.ok(js.length>300000,'script principal introuvable');
  assert.doesNotThrow(()=>new vm.Script(js,{filename:'index-app.js'}));
});
