'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');

test('Éveil Judo : le diagnostic Tora est intégré au générateur sans affecter Taïso',()=>{
  const start=html.indexOf('  function Generateur(p) {');
  const end=html.indexOf('  function ', start+20);
  assert.ok(start>=0 && end>start, 'générateur identifié');
  const code=html.slice(start,html.indexOf('\n  function ',start+1000));
  assert.match(code,/if \(estEveilJudo\(rep\.groupe\)\) \{/);
  assert.match(code,/window\.JSBTora\.auditerCatalogue\(p\.tout\)/);
  assert.match(code,/\(rep\.modeHistoireTora \|\| 'sans'\) !== 'sans' && couvertureTora/);
  assert.match(code,/Histoires disponibles : /);
  assert.match(code,/Correspondance ne signifie pas validation pédagogique/);
  assert.match(code,/absentes/);
  assert.match(code,/incompatibles/);
  assert.match(code,/doublons/);
  assert.match(code,/fiche incompatible/);
  assert.match(code,/h\('details', \{ className: 'tora-couverture' \}/);
});

test('Éveil Judo : le diagnostic ne crée, ne remplace ni ne sauvegarde des fiches',()=>{
  const debut=html.indexOf('      if (estEveilJudo(rep.groupe)) {');
  const fin=html.indexOf("      if (rep.groupe === 'Pré-poussins')",debut);
  const bloc=html.slice(debut,fin);
  assert.ok(debut>=0 && fin>debut, 'bloc narratif trouvé');
  assert.doesNotMatch(bloc,/\b(?:ecrireJSON|setRep|setInfos|setPlan|majPlan|importer|sauvegarder)\s*\(/);
  assert.match(bloc,/p\.tout/);
  assert.match(bloc,/modeHistoireTora/);
});

test('Éveil Judo : le cache PWA inclut la version du diagnostic et le module Tora',()=>{
  assert.match(sw,/var CACHE = 'jsb-manager-[^']+tora[^']*'/);
  assert.match(sw,/\.\/tora\/tora-mode\.js/);
  assert.match(sw,/\.\/index\.html/);
  assert.match(html,/\.tora-couverture summary:focus-visible/);
});
