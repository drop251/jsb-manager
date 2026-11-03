'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
let s=fs.readFileSync('index.html','utf8');
function patch(a,b,label) { let i=s.indexOf(a); assert(i>=0,label+' absent'); assert(s.indexOf(a,i+1)<0,label+' dupliqué'); s=s.slice(0,i)+b+s.slice(i+a.length); }
patch("    var meme = l.filter(function (e) { return ph.format ? zoneDe(e) === zoneDe(x.e) : e.categorie === x.e.categorie; });",
      "    if (judo) l = l.filter(function (e) { return !e.rolePedagogique || roleCompatibleJudo(e, ph.nom, rep); });\n    var meme = l.filter(function (e) { return ph.format ? zoneDe(e) === zoneDe(x.e) : (e.rolePedagogique && x.e.rolePedagogique ? e.rolePedagogique === x.e.rolePedagogique : e.categorie === x.e.categorie); });",
      'remplacement cohérent');
patch("lignes(e.categorie, lc[1]), lignes(e.nom, lc[2]),",
      "lignes(e.rolePedagogique || e.categorie, lc[1]), lignes(e.nom, lc[2]),",
      'rôle pédagogique dans le PDF');
patch("lignes(e.description + (/[.!?]$/.test(e.description) ? '' : '.') + (e.dosage ? ' Dosage : ' + e.dosage + '.' : ''), lc[3]),",
      "lignes(e.description + (/[.!?]$/.test(e.description) ? '' : '.') + (e.competenceCiblee ? ' Compétence : ' + e.competenceCiblee + '.' : '') + (e.dosage ? ' Dosage : ' + e.dosage + '.' : '') + (e.organisation ? ' Organisation : ' + e.organisation + '.' : '') + (e.prerequis && !/^(aucun|sans)$/i.test(e.prerequis) ? ' Prérequis : ' + e.prerequis + '.' : ''), lc[3]),",
      'consignes pratiques dans PDF');
patch("        res.manques.length ? h('p', { className: 'gn-aide' }, 'Peu d\\'exercices disponibles pour : ' + res.manques.join(', ') + '. Complétez dans « Ma séance ».') : null,",
      "        res.manques.length ? h('p', { className: 'gn-aide', role: 'status' }, 'Points pédagogiques à compléter ou vérifier : ' + res.manques.join(' · ') + '. Contrôlez avant utilisation.') : null,",
      'avertissements pédagogiques explicites');
patch("ph.exercices.map(function (x) { return ligneExo(i, x, (x.dosage ? x.dosage + ' · ' : '') + x.duree + ' min · ' + court(x.e.categorie)); })",
      "ph.exercices.map(function (x) { return ligneExo(i, x, (x.dosage ? x.dosage + ' · ' : '') + x.duree + ' min · ' + court(judo ? (x.e.rolePedagogique || x.e.categorie) : x.e.categorie) + (judo && x.e.niveauOpposition ? ' · ' + x.e.niveauOpposition : '') + (judo && x.e.organisation ? ' · Organisation : ' + x.e.organisation : '')); })",
      'fiche prévisualisée et organisation');
patch("    BASE = BASE_ORIGINE;\n    return chargerIllusIA()",
      "    BASE = BASE_ORIGINE.slice();\n    return chargerIllusIA()",
      'éviter mutation du catalogue source');
patch("  var VERSION_APP = '04/11/2026 · critères pédagogiques Judo et validation des ajouts';",
      "  var VERSION_APP = '04/11/2026 · six critères Judo, imports stricts et fiches enrichies';",
      'numéro de version');
fs.writeFileSync('index.html',s);
console.log('V3 : remplacements et export compatibles avec les critères pédagogiques Judo.');
