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

test('Interface : surfaces et commandes adaptées aux deux thèmes sans masquer les actions',()=>{
 const css=read('ui/interface.css');
 assert.match(css,/\.appbar\s*\{[^}]*background:\s*var\(--surface\)/s);
 assert.match(css,/\.gn-option,\s*\.cs-btn,\s*\.rg-taille\s*\{[^}]*min-height:\s*44px/s);
 assert.match(css,/font-size:\s*max\(16px, 1rem\)/);
 assert.match(css,/\.cs-phase li \.cs-reglages\s*\{\s*flex-wrap:\s*wrap/);
});

test('Interface : espace de travail adaptatif et largeur minimale des contrôles',()=>{
 const css=read('ui/interface.css');
 assert.match(css,/\.wrap\s*\{\s*max-width:\s*1360px/);
 assert.match(css,/\.gn:not\(\.cx-gestion\)\s*\{\s*width:\s*min\(740px,100%\)/);
 assert.match(css,/repeat\(5,minmax\(0,1fr\)\)/);
 assert.match(css,/orientation:\s*landscape/);
 assert.match(css,/max-width:\s*360px/);
});

test('Interface : descriptions de l’accueil non tronquées et grille adaptée',()=>{
 const css=read('ui/interface.css');
 assert.match(css,/\.aujourdhui \.tuile strong,\s*\.aujourdhui \.tuile small\s*\{[^}]*white-space:\s*normal;[^}]*text-overflow:\s*clip/s);
 assert.match(css,/max-width:\s*360px\)\s*\{\s*\.aujourdhui\s*\{\s*grid-template-columns:\s*minmax\(0,1fr\)/);
});

test('Interface : navigation animée courte et respect de la réduction des mouvements',()=>{
 const css=read('ui/interface.css');
 assert.match(css,/--jsb-ui-motion:\s*240ms/);
 assert.match(css,/\.page\.va-avant > \.wrap > :not\(\.appbar\)\s*\{\s*animation: jsb-ui-avant/);
 assert.match(css,/\.page\.va-arriere > \.wrap > :not\(\.appbar\)\s*\{\s*animation: jsb-ui-retour/);
 assert.match(css,/:root\[data-anim="reduit"\] \.page\.va-arriere > \.wrap > \*\s*\{\s*animation: none !important/);
 assert.match(css,/:focus-visible\s*\{\s*outline:\s*3px solid var\(--focus\)/);
});

test('Interface : tableau de bord et commande principale reliés aux données et actions locales',()=>{
 const html=read('index.html'), css=read('ui/interface.css');
 assert.ok(html.includes("className: 'accueil-preparer'"));
 assert.ok(html.includes("poserIntention({ type: 'generer' }); aller(label === 'Judo' ? 'judo' : 'taiso')"));
 assert.ok(html.includes("suivi.actifs == null ? '—' : suivi.actifs"));
 assert.ok(html.includes("historiqueAccueil.filter(function (x) { return x.date === auj; }).length"));
 assert.ok(html.includes("historiqueAccueil.slice(0, 3)"));
 assert.match(css,/--bg:\s*#f4f5f9/);
 assert.match(css,/--bg:\s*#0d0f13/);
 assert.match(css,/--jsb-accent:\s*#3459d4/);
});
