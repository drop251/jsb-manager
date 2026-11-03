'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
let s = fs.readFileSync('index.html','utf8');
function one(a,b,n) {
 let at=s.indexOf(a);assert(at>=0,'Point absent : '+n);assert(s.indexOf(a,at+1)<0,'Point ambigu : '+n);
 s=s.slice(0,at)+b+s.slice(at+a.length);
}
one("  function phasesDe(espace) { return espace === 'Taïso' ? PHASES_TAISO : PHASES_SEANCE; }\n  function phasesSeance(s) { return s && s.espace === 'Taïso' && !s.trame ? PHASES_TAISO_V1 : phasesDe(s && s.espace); }",
[
"  var PHASES_EVEIL_JUDO = ['Accueil & salut', 'Jeux moteurs', 'Parcours moteurs', 'Jeux coopératifs', 'Retour au calme'];",
"  var PHASES_PREPOUSSINS_JUDO = ['Accueil & mobilité', 'Jeux moteurs', 'Bases du Judo', 'Opposition éducative', 'Retour au calme'];",
"  function estEveilJudo(g) { return g === 'Éveils (4-5 ans)'; }",
"  function estJeuneJudo(g) { return estEveilJudo(g) || g === 'Pré-poussins'; }",
"  function phasesDe(espace, groupe) {",
"    if (espace === 'Taïso') return PHASES_TAISO;",
"    if (estEveilJudo(groupe)) return PHASES_EVEIL_JUDO;",
"    if (groupe === 'Pré-poussins') return PHASES_PREPOUSSINS_JUDO;",
"    return PHASES_SEANCE;",
"  }",
"  function phasesSeance(s) { return s && s.espace === 'Taïso' && !s.trame ? PHASES_TAISO_V1 : phasesDe(s && s.espace, s && s.infos && s.infos.groupe); }"
].join('\n'),'phases spécifiques');
one("    var J = window.jspdf && window.jspdf.jsPDF, PH = phasesDe(espace), taiso = espace === 'Taïso';",
"    var J = window.jspdf && window.jspdf.jsPDF, PH = phasesDe(espace, infos && infos.groupe), taiso = espace === 'Taïso';",'PDF trame');
one("    var sel = p.sel, n = sel.ids.length, PH = phasesDe(p.espace);",
"    var sel = p.sel, n = sel.ids.length, PH = phasesDe(p.espace, infos.groupe || p.sous);",'panier trame');
one("    var total = 0; items.forEach(function (e) { total += parseFloat(dureeDe(e)) || 0; });",
"    var total = 0; items.forEach(function (e) { total += parseFloat(dureeDe(e)) || 0; });\n    var tempsJeunePlanifie = estJeuneJudo(infos.groupe || p.sous) && Array.isArray(infos.tempsPhases) ? infos.tempsPhases.reduce(function (a,b) { return a + Number(b || 0); },0) : 0;",'temps jeunes');
one("h('p', null, n + (n > 1 ? ' exercices' : ' exercice') + (total ? ' · ' + total + ' min' : '') + ' · trame en ' + PH.length + ' phases')",
"h('p', null, n + (n > 1 ? ' activités' : ' activité') + ((tempsJeunePlanifie || total) ? ' · ' + (tempsJeunePlanifie || total) + ' min' : '') + ' · trame en ' + PH.length + ' phases')",'résumé panier');
one("setDirect({ espace: p.espace, titre: val('thematique') || 'Ma séance ' + p.espace, exos: exos, trame: 2 });",
"setDirect({ espace: p.espace, titre: val('thematique') || 'Ma séance ' + p.espace, exos: exos, infos: { groupe: val('groupe') }, trame: 2 });",'direct');
one("    PH.forEach(function (nom, i) {\n      var items = parPhase[i], total = 0;\n      items.forEach(function (e) { total += parseFloat(durees[e.id]) || 0; });",
"    PH.forEach(function (nom, i) {\n      var items = parPhase[i], total = 0;\n      items.forEach(function (e) { total += parseFloat(durees[e.id]) || 0; });\n      if (estJeuneJudo(infos.groupe) && infos.tempsPhases && infos.tempsPhases[i]) total = Number(infos.tempsPhases[i]);",'PDF compte les rituels');
one("      doc.setDrawColor.apply(doc, NAVY); doc.setLineWidth(1); doc.line(M, y + 16, M + W, y + 16); y += 21;\n      var x = M;",
"      doc.setDrawColor.apply(doc, NAVY); doc.setLineWidth(1); doc.line(M, y + 16, M + W, y + 16); y += 21;\n      var repereJeune = infos.reperesPhases && infos.reperesPhases[i];\n      if (repereJeune) { police('italic', 7.2, [63, 65, 68]); var lr = lignes(repereJeune, W - 22); var hr = lr.length * 9 + 7; place(hr); doc.text(lr, M + 7, y + 7); y += hr; }\n      var x = M;",'PDF affiche repères');
one("               h('h3', null, h('span', null, (i + 1) + ' • ' + nom), h('small', null, grp.length + (grp.length > 1 ? ' exercices' : ' exercice') + (t ? ' · ' + t + ' min' : ''))),",
"               h('h3', null, h('span', null, (i + 1) + ' • ' + nom), h('small', null, grp.length + (grp.length > 1 ? ' activités' : ' activité') + ((infos.tempsPhases && infos.tempsPhases[i]) ? ' · ' + infos.tempsPhases[i] + ' min' : t ? ' · ' + t + ' min' : ''))),\n               infos.reperesPhases && infos.reperesPhases[i] ? h('p', { className: 'gn-aide' }, infos.reperesPhases[i]) : null,",'panier repères');
one("  var DUREES = [45, 60, 75, 90];",
"  var DUREES = [45, 60, 75, 90];\n  function dureesGroupeJudo(g) { return estEveilJudo(g) ? [30, 35, 40, 45] : g === 'Pré-poussins' ? [45, 60] : DUREES; }",'durées par âge');
const jeunes = fs.readFileSync('scripts/jeunes-moteur.txt','utf8');
one("  // Bonus de pertinence (pas un filtre bloquant) : respecte la catégorie d'âge et la technique choisies.",
jeunes+"\n  // Bonus de pertinence (pas un filtre bloquant) : respecte la catégorie d'âge et la technique choisies.",'règles pédagogiques');
one("  function genererSeance(rep, judo, tous, tout, graine) {\n    var r = hasard(graine),",
"  function genererSeance(rep, judo, tous, tout, graine) {\n    if (judo && estJeuneJudo(rep.groupe)) return genererSeanceJeunes(rep,tous,tout,graine);\n    var r = hasard(graine),",'moteur dédié');
one("  var VERSION_APP = '04/11/2026 · six critères Judo, imports stricts et fiches enrichies';",
"  var VERSION_APP = '04/11/2026 · Éveil Judo ludique et Pré-poussins adaptés';",'version');
fs.writeFileSync('index.html',s);
let sw=fs.readFileSync('sw.js','utf8');
assert(sw.includes("jsb-manager-20261104-jsb-pedagogie-validation-v1"),'cache actuel inconnu');
sw=sw.replace(/jsb-manager-20261104-jsb-pedagogie-validation-v1/g,'jsb-manager-20261104-jsb-jeunes-ludiques-v1');
fs.writeFileSync('sw.js',sw);
console.log('Judo jeunes : trames, motorisation, exports et cache ajoutés.');
