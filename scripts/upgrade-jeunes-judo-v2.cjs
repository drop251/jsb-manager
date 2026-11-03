'use strict';
const fs=require('node:fs'), assert=require('node:assert/strict');
let s=fs.readFileSync('index.html','utf8');
function one(a,b,label) {
 const k=s.indexOf(a); assert(k>=0,'Missing '+label); assert(s.indexOf(a,k+1)<0,'Ambiguous '+label); s=s.slice(0,k)+b+s.slice(k+a.length);
}
const profiles=[
"  var PHASES_JUDO_AGES = {",
"    'Poussins': ['Activation ludique','Échauffement orienté','Apprentissage technique','Mise en situation éducative','Retour au calme et bilan'],",
"    'Benjamins': ['Mobilité spécifique','Échauffement technique','Acquisition et consolidation','Opposition à thème','Retour au calme'],",
"    'Minimes': ['Activation et mobilité','Préparation technique','Progression technique','Randori à thème','Récupération et bilan'],",
"    'Cadets': ['Activation ciblée','Échauffement spécifique','Travail technico-tactique','Randori dirigé ou libre','Récupération et bilan'],",
"    'Juniors': ['Préparation physique adaptée','Échauffement spécifique','Développement technico-tactique','Opposition et randori','Récupération'],",
"    'Adultes': ['Mobilité et activation','Échauffement orienté','Apprentissage ou perfectionnement','Randori adapté à l’objectif','Retour au calme']",
"  };"
].join('\n');
one("  function estEveilJudo(g) { return g === 'Éveils (4-5 ans)'; }",
profiles+"\n  function estEveilJudo(g) { return g === 'Éveils (4-5 ans)'; }",
'profiles');
one("  function phasesDe(espace, groupe) {\n    if (espace === 'Taïso') return PHASES_TAISO;\n    if (estEveilJudo(groupe)) return PHASES_EVEIL_JUDO;\n    if (groupe === 'Pré-poussins') return PHASES_PREPOUSSINS_JUDO;\n    return PHASES_SEANCE;\n  }",
"  function phasesDe(espace, groupe, noms) {\n    if (espace === 'Taïso') return PHASES_TAISO;\n    if (Array.isArray(noms) && noms.length === 5 && noms.every(function (n) { return typeof n === 'string' && !!n.trim(); })) return noms;\n    if (estEveilJudo(groupe)) return PHASES_EVEIL_JUDO;\n    if (groupe === 'Pré-poussins') return PHASES_PREPOUSSINS_JUDO;\n    return PHASES_JUDO_AGES[groupe] || PHASES_SEANCE;\n  }",
'flexible phases');
one("  function phasesSeance(s) { return s && s.espace === 'Taïso' && !s.trame ? PHASES_TAISO_V1 : phasesDe(s && s.espace, s && s.infos && s.infos.groupe); }",
"  function phasesSeance(s) {\n    if (s && s.espace === 'Taïso' && !s.trame) return PHASES_TAISO_V1;\n    if (s && s.espace === 'Judo' && s.trame && s.trame < 3) return PHASES_SEANCE;\n    return phasesDe(s && s.espace, s && s.infos && s.infos.groupe, s && s.infos && s.infos.intitulesPhases);\n  }",
'old history');
one("PH = phasesDe(espace, infos && infos.groupe), taiso",
"PH = phasesDe(espace, infos && infos.groupe, infos && infos.intitulesPhases), taiso",
'PDF titles');
one("PH = phasesDe(p.espace, infos.groupe || p.sous);",
"PH = phasesDe(p.espace, infos.groupe || p.sous, infos.intitulesPhases);",
'manual planner titles');
one("    var defauts = {\n      groupe:", "    var defauts = {\n      groupe:",'point defs');
one("enregistreLe: Date.now(), trame: 2 });",
"enregistreLe: Date.now(), trame: 3 });",
'new sessions marker');
one("infos: { groupe: val('groupe') }, trame: 2",
"infos: { groupe: val('groupe'), intitulesPhases: infos.intitulesPhases }, trame: 3",
'live session names');
one("((infos.tempsPhases && infos.tempsPhases[i]) ? ' · ' + infos.tempsPhases[i] + ' min' : t ? ' · ' + t + ' min' : ''))),",
"((infos.tempsPhases && infos.tempsPhases[i]) ? ' · ' + infos.tempsPhases[i] + ' min' : t ? ' · ' + t + ' min' : ''))),",
'phase duration baseline');
one("               infos.reperesPhases && infos.reperesPhases[i] ? h('p', { className: 'gn-aide' }, infos.reperesPhases[i]) : null,",
"               judoEsp ? h('label', { className: 'cs-champ' }, 'Intitulé de cette phase (modifiable)', h('input', { type: 'text', value: nom, onChange: function (ev) { var arr = PH.slice(); arr[i] = ev.target.value || phasesDe('Judo',infos.groupe||p.sous)[i]; majInfo('intitulesPhases',arr); } })) : null,\n               estJeuneJudo(infos.groupe || p.sous) ? h('label', { className: 'cs-champ' }, 'Durée de la phase (minutes, à titre indicatif)', h('input', { type: 'number', min: 0, max: 120, value: infos.tempsPhases && infos.tempsPhases[i] !== undefined ? infos.tempsPhases[i] : t, onChange: function (ev) { var temps = (infos.tempsPhases || []).slice(); temps[i] = Math.max(0,Number(ev.target.value)||0); majInfo('tempsPhases',temps); } })) : null,\n               infos.reperesPhases && infos.reperesPhases[i] ? h('p', { className: 'gn-aide' }, infos.reperesPhases[i]) : null,",
'editable titles and phases');
one("  function dureesGroupeJudo(g) { return estEveilJudo(g) ? [30, 35, 40, 45] : g === 'Pré-poussins' ? [45, 60] : DUREES; }",
"  function dureesGroupeJudo(g) { return estEveilJudo(g) ? [30, 35, 40, 45, 60] : g === 'Pré-poussins' ? [30, 45, 60, 75] : DUREES; }",
'age durations optional');
one("    return { phases: resultat, manques: manques };\n  }\n\n  function Generateur(p)",
"    if (judo && typeof phasesDe === 'function') { var labelsAge = phasesDe('Judo',rep.groupe); resultat.forEach(function (p,i) { p.libelle = labelsAge[i] || p.nom; }); }\n    return { phases: resultat, manques: manques };\n  }\n\n  function Generateur(p)",
'add age titles without changing internal roles');
one("    var groupes = judo ? ['Éveils (4-5 ans)', 'Pré-poussins', 'Poussins', 'Benjamins', 'Adultes']",
"    var groupes = judo ? ['Éveils (4-5 ans)', 'Pré-poussins', 'Poussins', 'Benjamins', 'Minimes', 'Cadets', 'Juniors', 'Adultes']",
'young groups and older');
one("    var objectifs = judo ? OBJECTIFS_JUDO : ['Varié', 'Renforcement', 'Gainage', 'Cardio', 'Équilibre et coordination', 'Pliométrie (impact)'];",
"    var objectifs = judo ? OBJECTIFS_JUDO : ['Varié', 'Renforcement', 'Gainage', 'Cardio', 'Équilibre et coordination', 'Pliométrie (impact)'];\n    if (judo) objectifs = objectifsGroupeJudo(rep.groupe);",
'objectives per category');
one("      var infos = { groupe: rep.groupe, duree: rep.duree, intensite: 'Modérée',",
"      var infos = { groupe: rep.groupe, duree: rep.duree, intensite: estJeuneJudo(rep.groupe) ? 'Faible' : 'Modérée',",
'age intensity');
one("      if (infos.objectif) infos._objectif = true;",
"      if (infos.objectif) infos._objectif = true;\n      if (judo) infos.intitulesPhases = res.phases.map(function (ph) { return ph.libelle || ph.nom; });\n      if (judo && estJeuneJudo(rep.groupe)) { infos.tempsPhases = res.phases.map(function (ph) { return ph.minutes; }); infos.reperesPhases = res.phases.map(function (ph) { return ph.repere || ''; }); }",
'preserve generation metadata');
one("h('strong', null, ph.nom), h('small', null, ph.minutes + ' min'",
"h('strong', null, ph.libelle || ph.nom), h('small', null, ph.minutes + ' min'",
'display tailored titles');
one("        res.manques.length ? h('p', { className: 'gn-aide', role: 'status' }, 'Points pédagogiques",
"        res.manques.length ? h('p', { className: 'gn-aide', role: 'status' }, 'Points pédagogiques",
'warning preserve');
fs.writeFileSync('index.html',s);
console.log('Trames souples et intitulés adaptés : PDF libre, ancienne séance compatible.');
