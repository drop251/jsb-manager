'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
test('Interface : feuille de style locale chargée après les styles historiques et précachée',()=>{
 const html=read('index.html'), css=read('ui/interface.css'), sw=read('sw.js');
 const link='<link rel="stylesheet" href="./ui/interface.css">';
 assert.equal(html.indexOf(link),html.lastIndexOf(link));
 assert.ok(html.indexOf(link)>html.lastIndexOf('</style>'));
 assert.ok(sw.includes("'./ui/interface.css'"));
 assert.match(css,/prefers-reduced-motion: reduce/);
 assert.match(css,/data-texte-grand/);
 assert.match(css,/\.onglet-txt\s*\{[^}]*font-size:\s*\.75rem/);
 assert.match(css,/\.sous\s*\{\s*min-height:\s*44px/);
});
test('Interface : cinq destinations et titre sémantique conservés',()=>{
 const html=read('index.html');
 assert.match(html,/var NAV = \[\['', 'Accueil', 'accueil'\], \['taiso', 'Taïso', 'taiso'\], \['judo', 'Judo', 'judo'\], \['seance', 'Séances', 'seance'\], \['presences', 'Présences', 'presences'\]\]/);
 assert.ok(html.includes("h('h1', null, f.sous || esp.label)"));
 assert.ok(html.includes("h('h1', null, esp.label)"));
});
