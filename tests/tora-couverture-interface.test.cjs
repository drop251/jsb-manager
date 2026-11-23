'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');

test('Tora est présenté dans la fiche exercice Éveil et repéré en bibliothèque',()=>{
 const debut=html.indexOf('  function HistoireToraFiche(p) {');
 const fin=html.indexOf('  function Fiche(p) {',debut);
 const bloc=html.slice(debut,fin);
 assert.ok(debut>=0 && fin>debut);
 assert.match(bloc,/window\.JSBTora\.fichePedagogique\(p\.e\)/);
 assert.match(bloc,/histoire\.histoire/);
 assert.match(bloc,/histoire\.consigne/);
 assert.match(html,/judo && typeof HistoireToraFiche === 'function' \? h\(HistoireToraFiche, \{ e: e \}\) : null/);
 assert.match(html,/judo && window\.JSBTora && window\.JSBTora\.fichePedagogique\(e\) \? h\('span', \{ className: 'tag tora-tag' \}/);
 assert.doesNotMatch(bloc,/\b(?:majInfo|setInfos|setPlan|importer|sauvegarder)\s*\(/);
});

test('Le générateur réutilise les histoires des fiches, sans second sélecteur',()=>{
 const debut=html.indexOf('      if (estEveilJudo(rep.groupe)) {');
 const fin=html.indexOf("      if (rep.groupe === 'Pré-poussins')",debut);
 const bloc=html.slice(debut,fin);
 assert.ok(debut>=0 && fin>debut);
 assert.match(bloc,/window\.JSBTora\.auditerCatalogue\(p\.tout\)/);
 assert.match(bloc,/Histoires associées à des fiches/);
 assert.match(bloc,/absentes/);
 assert.match(bloc,/incompatibles/);
 assert.match(bloc,/doublons/);
 assert.doesNotMatch(bloc,/tora-choix|modeHistoireTora|\bmaj\('/);
 assert.doesNotMatch(html,/id: 'cs-tora-mode'/);
 assert.match(html,/window\.JSBTora\.fichePedagogique\(x\.e\)/);
 assert.match(html,/toraPDF\.consigne/);
});

test('Le cache PWA et les styles de la fiche contiennent Tora',()=>{
 assert.match(sw,/var CACHE = 'jsb-manager-[^']+tora[^']*'/);
 assert.match(sw,/\.\/tora\/tora-mode\.js/);
 assert.match(sw,/\.\/index\.html/);
 assert.match(html,/\.fiche-tora/);
 assert.match(html,/\.tora-couverture summary:focus-visible/);
});
