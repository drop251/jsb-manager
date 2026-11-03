'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
let src=fs.readFileSync('index.html','utf8');
function one(a,b,title){let i=src.indexOf(a);assert(i>=0,title+' absent');assert(src.indexOf(a,i+1)<0,title+' dupliqué');src=src.slice(0,i)+b+src.slice(i+a.length);}
one("    if (etape === 0) {\n      titre = 'Routine de mobilité';",
"    if (etape === 0) {\n      titre = 'Routine de mobilité (facultative pour les séances Judo)';",
'liberté de routine');
one("        presets.push(['Complète', complete, 'De la nuque aux chevilles'], ['Express', express, 'Un mouvement sur deux, pour gagner du temps']);",
"        presets.push(['Complète', complete, 'De la nuque aux chevilles'], ['Express', express, 'Un mouvement sur deux, pour gagner du temps']);\n        if (judo) presets.push(['Sans routine', [], 'Passer directement à la construction pédagogique : aucune activité imposée par le PDF']);",
'ne pas imposer un exercice');
one("        peutSuivre = rep.routine.length > 0;",
"        peutSuivre = judo || rep.routine.length > 0;",
'routine facultative');
one("      peutSuivre = !!rep.famille;",
"      if (estEveilJudo(rep.groupe)) { titre = 'Quel type de jeux souhaitez-vous ?'; aide = 'Le jeu et l’exploration motrice guident le choix ; aucune technique formelle à imposer.'; corps = h('p', { className: 'gn-aide' }, 'Le générateur choisit des jeux de déplacement, un parcours moteur et des situations coopératives en fonction de l’objectif retenu.'); }\n      if (rep.groupe === 'Pré-poussins') aide = 'La famille technique est facultative : privilégier les fondamentaux et les jeux pédagogiques.';\n      peutSuivre = estJeuneJudo(rep.groupe) || !!rep.famille;",
'aucune technique obligatoire pour jeunes');
one("    var s2 = React.useState(function () {\n      var r0 = { groupe: p.sous || '', duree: '60 min',",
"    var s2 = React.useState(function () {\n      var r0 = { groupe: p.sous || '', duree: p.espace === 'Judo' && estEveilJudo(p.sous) ? '45 min' : '60 min',",
'durée initiale age');
one("h('div', { className: 'gn-durees', role: 'group', 'aria-label': 'Durée' }, DUREES.map(function (d) {",
"h('div', { className: 'gn-durees', role: 'group', 'aria-label': 'Durée' }, (judo ? dureesGroupeJudo(rep.groupe) : DUREES).map(function (d) {",
'durées suggérées sans blocage');
one("      if (rep.routine.length) ecrireRoutine(p.espace, rep.routine);",
"      if (rep.routine.length && !(judo && estJeuneJudo(rep.groupe))) ecrireRoutine(p.espace, rep.routine);",
'les rituels jeunes ne changent pas la routine adulte');
one("    var candidats = tous.filter(function (e) {\n      if (!estExerciceJeuneAdapte(e,groupe)) return false;",
"    var candidats = tous.filter(function (e) {\n      if (!estExerciceJeuneAdapte(e,groupe)) return false;\n      if (e.prerequis && !/^(aucun|sans|néant|neant)$/i.test(String(e.prerequis).trim())) {\n        var acquis = sa(rep.prerequisAcquis || '');\n        if (!acquis || acquis.indexOf(sa(e.prerequis)) < 0) return false;\n      }",
'prérequis réels des jeunes');
fs.writeFileSync('index.html',src);
console.log('Judo jeunes : mobilité facultative, technique non imposée, durées choisies, prérequis réels.');
