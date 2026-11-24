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
 assert.match(css,/--jsb-brand-ivory:\s*#f4f5ef/);
 assert.match(css,/--bg:\s*#151c29/);
 assert.match(css,/--jsb-brand-gold:\s*#dab174/);
});

test('Palette JSB : contraste des associations de texte choisies',()=>{
 const lum=hex=>{const rgb=hex.match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];};
 const contrast=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
 for(const [a,b] of [['1f2839','ffffff'],['1f2839','f4f5ef'],['76511f','ffffff'],['76511f','f7ecd9'],['dab174','1f2839'],['dab174','3a342d'],['f4f5ef','151c29'],['5c6370','ffffff'],['bfc5cf','1f2839']]){
  assert.ok(contrast(a,b)>=4.5,a+' / '+b+' : '+contrast(a,b));
 }
});

test('Palette JSB : le libellé actif mobile ne dépend pas de la couleur héritée',()=>{
 const css=read('ui/interface.css');
 assert.match(css,/\.onglets \.onglet-nav\[aria-current="page"\] \.onglet-txt,\s*\.onglets \.onglet-nav\[aria-current="page"\] svg\s*\{\s*color:var\(--jsb-accent-ink\)/);
 assert.match(css,/\.onglets \.onglet-nav\[aria-current="page"\]:nth-child\(n\)\s*\{\s*background:transparent;\s*color:var\(--jsb-accent-ink\)/);
});

test('Interface V7 : catalogue compact sur iPhone, cibles tactiles et texte agrandi',()=>{
 const css=read('ui/interface.css');
 assert.match(css,/\.wrap:has\(> \.catalogue-types\)\s*\{\s*gap:10px/);
 assert.match(css,/\.wrap > \.catalogue-types > \.btn\s*\{[^}]*min-height:44px/s);
 assert.match(css,/\.wrap > \.catalogue-familles\s*\{\s*margin:0/);
 assert.match(css,/\.wrap > \.barre-recherche \.cherche\s*\{[^}]*font-size:max\(16px,1rem\)/);
 assert.match(css,/:root\[data-texte-grand\] \.wrap > \.catalogue-types\s*\{\s*grid-template-columns:1fr/);
});
