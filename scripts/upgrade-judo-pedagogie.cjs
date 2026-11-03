'use strict';
// Patch idempotent applique sur GitHub Actions avec la source complète (index.html volumineux).
const fs = require('node:fs');
const assert = require('node:assert/strict');
let src = fs.readFileSync('index.html', 'utf8');
function one(oldValue, newValue, title) {
  const first = src.indexOf(oldValue);
  assert(first >= 0, 'Point de patch introuvable : ' + title);
  assert(src.indexOf(oldValue, first + 1) < 0, 'Point de patch ambigu : ' + title);
  src = src.slice(0, first) + newValue + src.slice(first + oldValue.length);
}
function valeurChampPedagogique(brut, noms) {
  function clef(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ''); }
  var colonnes = Object.keys(brut || {});
  for (var i = 0; i < noms.length; i++) for (var j = 0; j < colonnes.length; j++) {
    if (clef(colonnes[j]) === clef(noms[i])) {
      var v = brut[colonnes[j]];
      return Array.isArray(v) ? v.join(', ').trim() : v == null ? '' : String(v).trim();
    }
  }
  return '';
}
function normaliserRoleJudo(v) {
  var t = String(v || '').trim();
  var roles = ['Préparation', 'Découverte', 'Acquisition', 'Consolidation', 'Réinvestissement', 'Application', 'Opposition', 'Retour au calme'];
  var k = t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return roles.filter(function (x) { return x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === k; })[0] || '';
}
function normaliserOppositionJudo(v) {
  var t = String(v || '').trim();
  var types = ['Sans opposition', 'Coopération', 'Opposition dirigée', 'Opposition libre'];
  var k = t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return types.filter(function (x) { return x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === k; })[0] || '';
}
function verifierNouvelExerciceJudo(brut, e) {
  var erreurs = [];
  if (!e || !e.nom || !String(e.nom).trim()) return ['Nom obligatoire'];
  if (!e.public || e.public.indexOf('Judo') < 0) return erreurs; // moteur Taïso inchangé
  var obligatoires = [
    ['Description', ['description']], ['Thématique', ['thematique']], ['Dosage', ['dosage']],
    ['Vigilance', ['vigilance']], ['Critère de réussite', ['critere','critereDeReussite']],
    ['Catégorie d’âge', ['sousGroupes', 'categorieAge']], ['Grade', ['grade']],
    ['Famille technique', ['famille', 'technique']], ['Moment', ['moment']],
    ['Format', ['format']], ['Matériel', ['equipement', 'materielDetail']],
    ['Variante facile', ['varianteFacile']], ['Variante difficile', ['varianteDifficile']]
  ];
  obligatoires.forEach(function (c) { if (!valeurChampPedagogique(brut, c[1])) erreurs.push(c[0] + ' manquant'); });
  if (!valeurChampPedagogique(brut, ['description']) || valeurChampPedagogique(brut, ['description']).length < 15) erreurs.push('Description trop courte (15 caractères minimum)');
  if (!valeurChampPedagogique(brut, ['vigilance']) || valeurChampPedagogique(brut, ['vigilance']).length < 10) erreurs.push('Vigilance trop courte (10 caractères minimum)');
  var competence = valeurChampPedagogique(brut, ['competenceCiblee','compétence ciblée','competence','apprentissageVise']);
  var role = valeurChampPedagogique(brut, ['rolePedagogique','rôle pédagogique','role']);
  var prerequis = valeurChampPedagogique(brut, ['prerequis','pré-requis','prerequisTechniques']);
  var opposition = valeurChampPedagogique(brut, ['niveauOpposition','niveau d opposition','opposition']);
  var organisation = valeurChampPedagogique(brut, ['organisation','organisationPedagogique']);
  var duree = valeurChampPedagogique(brut, ['dureeBlocMin','durée bloc min','dureeBloc','durée de bloc réaliste']);
  if (competence.length < 8) erreurs.push('Compétence ciblée obligatoire (8 caractères minimum)');
  if (!normaliserRoleJudo(role)) erreurs.push('Rôle pédagogique invalide : préparation, découverte, acquisition, consolidation, réinvestissement, application, opposition ou retour au calme');
  if (prerequis.length < 4) erreurs.push('Prérequis à préciser (écrire « Aucun » si aucun)');
  if (!normaliserOppositionJudo(opposition)) erreurs.push('Niveau d’opposition invalide');
  if (organisation.length < 20) erreurs.push('Organisation incomplète (20 caractères minimum)');
  var format = valeurChampPedagogique(brut, ['format']).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  var normOrg = organisation.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/binome|trio/.test(format) && (!/\btori\b/.test(normOrg) || !/\buke\b/.test(normOrg))) erreurs.push('Organisation : préciser les rôles de Tori et Uke');
  if (!/altern|rotation|chang|tourn|invers/.test(normOrg)) erreurs.push('Organisation : préciser l’alternance ou les rotations');
  if (!/repos|recuper|pause/.test(normOrg)) erreurs.push('Organisation : préciser la récupération ou le repos');
  var n = Number(duree.replace(',', '.').replace(/\s*min(?:utes?)?\s*$/i, ''));
  if (!duree || !Number.isFinite(n) || n < 1 || n > 30) erreurs.push('Durée de bloc réaliste : nombre de minutes entre 1 et 30');
  return erreurs;
}
function roleCompatibleJudo(e, phase, rep) {
  if (!e || !e.rolePedagogique) return true; // anciennes fiches : pas de blocage rétroactif
  var roles = {
    'Mobilité': ['Préparation'], 'Échauffement': ['Préparation', 'Découverte'],
    'Corps de séance': ['Découverte', 'Acquisition', 'Consolidation', 'Réinvestissement', 'Application'],
    'Randori': ['Opposition', 'Réinvestissement', 'Application'],
    'Étirement': ['Retour au calme', 'Préparation']
  };
  if (roles[phase] && roles[phase].indexOf(e.rolePedagogique) < 0) return false;
  var niveaux = ['Sans opposition','Coopération','Opposition dirigée','Opposition libre'];
  var niveau = niveaux.indexOf(e.niveauOpposition || '');
  var max = niveaux.indexOf((rep && rep.niveauOpposition) || '');
  if (max >= 0 && niveau > max) return false;
  if (phase === 'Randori' && niveau >= 0 && niveau < 2) return false;
  if ((phase === 'Échauffement' || phase === 'Mobilité') && niveau > 1) return false;
  if (e.prerequis && !/^(aucun|sans|néant|neant)$/i.test(e.prerequis.trim())) {
    var acquis = ((rep && rep.prerequisAcquis) || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    var necessaire = e.prerequis.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (!acquis || acquis.indexOf(necessaire) < 0) return false;
  }
  if (rep && rep.organisationSeance && rep.organisationSeance !== 'Mixte' && phase !== 'Échauffement' && phase !== 'Mobilité' && phase !== 'Étirement') {
    if (rep.organisationSeance === 'Binômes' && e.format !== 'Binôme') return false;
    if (rep.organisationSeance === 'Trios' && e.format !== 'Trio') return false;
    if (rep.organisationSeance === 'Collectif' && e.format !== 'Collectif') return false;
  }
  return true;
}
function bonusPedagogiqueJudo(e, rep, phase) {
  var score = 5;
  var cible = String((rep && (rep.competenceCiblee || rep.technique)) || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  var texte = [e.competenceCiblee, e.nom, e.thematique, e.technique].join(' ').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (cible && texte.indexOf(cible) >= 0) score += 15;
  if (e.rolePedagogique && roleCompatibleJudo(e,phase,rep)) score += 9;
  if (rep && rep.cibleDureeBlocMin && e.dureeBlocMin) score += Math.max(0, 4 - Math.abs(Number(rep.cibleDureeBlocMin)-Number(e.dureeBlocMin)));
  return score;
}
const helpers = [
  valeurChampPedagogique, normaliserRoleJudo, normaliserOppositionJudo,
  verifierNouvelExerciceJudo, roleCompatibleJudo, bonusPedagogiqueJudo
].map(function (fn) { return '  ' + fn.toString().replace(/\n/g, '\n  '); }).join('\n\n') + '\n\n';
one('  function classer(brut, pub0) {', helpers + '  function classer(brut, pub0) {', 'métadonnées et contrôle');
one("    return e;\n  }\n  // --- Formes enfants", [
"    if (pub === 'Judo') {",
"      e.competenceCiblee = valeurChampPedagogique(brut, ['competenceCiblee','compétence ciblée','competence','apprentissageVise']);",
"      e.rolePedagogique = normaliserRoleJudo(valeurChampPedagogique(brut, ['rolePedagogique','rôle pédagogique','role']));",
"      e.prerequis = valeurChampPedagogique(brut, ['prerequis','pré-requis','prerequisTechniques']);",
"      e.niveauOpposition = normaliserOppositionJudo(valeurChampPedagogique(brut, ['niveauOpposition','niveau d opposition','opposition']));",
"      e.organisation = valeurChampPedagogique(brut, ['organisation','organisationPedagogique']);",
"      e.dureeBlocMin = Number(valeurChampPedagogique(brut, ['dureeBlocMin','durée bloc min','dureeBloc','durée de bloc réaliste']).replace(',', '.').replace(/\\s*min(?:utes?)?\\s*$/i, '')) || 0;",
"    }",
"    return e;",
"  }",
"  // --- Formes enfants"
].join('\n'), 'conversion des six champs');
one('var r = { ajouts: [], doublons: [], ignores: 0, formes: 0, exclus: {}, illustrations: [], liens: 0 };',
    'var r = { ajouts: [], doublons: [], ignores: 0, formes: 0, exclus: {}, illustrations: [], liens: 0, refuses: [] };','rapport refus');
one('var e = classer(l); if (!e) { r.ignores++; return; }',
    "var e = classer(l); if (!e) { r.refuses.push({ nom: valeurChampPedagogique(l,['nom']) || 'Sans nom', raisons: ['Nom obligatoire'] }); r.ignores++; return; }",
    'nom manquant');
one('      if (il.image) e.image = il.image;',
    "      var erreursFiche = verifierNouvelExerciceJudo(l, e);\n      if (erreursFiche.length) { r.refuses.push({ nom: e.nom, raisons: erreursFiche }); return; }\n      if (il.image) e.image = il.image;",
    'refus avant ajout');
one("        var r = preparerAjouts(lignes, BASE);\n        return imagesParNom",
    "        var r = preparerAjouts(lignes, BASE);\n        if (r.refuses && r.refuses.length) { r.ajouts = []; r.formes = 0; setRapport(r); setMsg('Import refusé : corrigez toutes les fiches signalées avant de réimporter ce fichier.'); return; }\n        return imagesParNom",
    'import atomique');
one('    function enregistrer() {\n      var il = rapport.illustrations || [];',
    "    function enregistrer() {\n      if (rapport.refuses && rapport.refuses.length) { setMsg('Enregistrement bloqué : corrigez les fiches refusées.'); return; }\n      var il = rapport.illustrations || [];",
    'garde enregistrement');
one("      rapport ? h('div', { className: 'gestion-rapport', role: 'region', 'aria-label': 'Compte rendu du classement' },",
    "      rapport ? h('div', { className: 'gestion-rapport', role: 'region', 'aria-label': 'Compte rendu du classement' },\n        rapport.refuses && rapport.refuses.length ? h('div', { role: 'alert' }, h('strong', null, rapport.refuses.length + ' fiche(s) refusée(s) : aucun nouvel exercice ne sera importé.'), h('ul', null, rapport.refuses.map(function (f,i) { return h('li', { key: i }, f.nom + ' : ' + f.raisons.join(' ; ')); }))) : null,",
    'afficher refus');
one("h('button', { type: 'button', className: 'btn plein', onClick: enregistrer }, rapport.ajouts.length ? 'Enregistrer' : 'Intégrer les illustrations')",
    "h('button', { type: 'button', className: 'btn plein', disabled: !!(rapport.refuses && rapport.refuses.length), onClick: enregistrer }, rapport.refuses && rapport.refuses.length ? 'Import bloqué' : rapport.ajouts.length ? 'Enregistrer' : 'Intégrer les illustrations')",
    'bouton désactivé');
one("        h('li', null, h('strong', null, 'Judo'), ' — techniques, travail avec partenaire, jeux et préparation physique des enfants, rangés par catégorie d\\'âge (Éveils à Adultes) avec un grade.'),",
    "        h('li', null, h('strong', null, 'Judo'), ' — les nouvelles fiches exigent les champs essentiels du catalogue et six critères pédagogiques : compétence, rôle, prérequis, opposition, organisation, durée réelle. Import refusé en cas de manque.'),",
    'aide catalogue');
one('    var eviter = rep.eviter || {};\n    function score(e) {',
    "    var eviter = rep.eviter || {};\n    var phasePedagogique = '';\n    function score(e) {",
    'phase judo');
one('      if (judo && obj) s += scoreObjectifJudo(e, obj);',
    "      if (judo && obj) s += scoreObjectifJudo(e, obj);\n      if (judo && (e.rolePedagogique || e.competenceCiblee || e.dureeBlocMin)) s += bonusPedagogiqueJudo(e, rep, phasePedagogique);",
    'score pédagogique');
one("var tri = melanger(pool.filter(function (e) { return !pris[e.id]; }), r).map",
    "var tri = melanger(pool.filter(function (e) { return !pris[e.id] && (!judo || !e.rolePedagogique || roleCompatibleJudo(e, phasePedagogique, rep)); }), r).map",
    'filtrage rôles et prerequis');
one("    phases.forEach(function (ph, i) {\n      var min = ph[1], ex;",
    "    phases.forEach(function (ph, i) {\n      if (judo) phasePedagogique = ph[0];\n      var min = ph[1], ex;",
    'phase active');
one("        var dernier = i === phases.length - 1, n = Math.max(dernier && judo && rep.calme === 'Les deux' ? 2 : 1, Math.round(min / ph[2])), pool;",
    "        var dernier = i === phases.length - 1, n = Math.max(dernier && judo && rep.calme === 'Les deux' ? 2 : 1, Math.round(min / ph[2])), pool;\n        if (judo && rep.cibleDureeBlocMin && (ph[0] === 'Corps de séance' || ph[0] === 'Randori')) n = Math.min(6, Math.max(1, Math.round(min / Number(rep.cibleDureeBlocMin))));",
    'n blocs');
one("pool = base.filter(function (e) { return mom('Corps de séance')(e) && MOTS_RANDORI.test(sa(e.nom + ' ' + e.thematique)) && !pris[e.id]; });\n          if (pool.length < n) pool = pool.concat(base.filter(function (e) { return mom('Corps de séance')(e) && e.categorie === 'Cardio' && pool.indexOf(e) < 0; }));",
    "pool = base.filter(function (e) { return mom('Corps de séance')(e) && !pris[e.id] && (e.rolePedagogique === 'Opposition' || (e.niveauOpposition && /Opposition dirigée|Opposition libre/.test(e.niveauOpposition)) || MOTS_RANDORI.test(sa(e.nom + ' ' + e.thematique))); });\n          if (!pool.length) manques.push('Randori : aucun exercice d’opposition adapté, aucune substitution cardio automatique');",
    'randori véridique');
one("      var durees = repartirDurees(min, ex.length);\n      resultat.push({ nom: ph[0], minutes: min, exercices: ex.map(function (e, k) { return { e: e, duree: durees[k] }; }) });",
    [
"      var durees = repartirDurees(min, ex.length), transitionsPedagogiques = 0;",
"      if (judo && i > 0 && ex.length) {",
"        if (ex.every(function (e) { return Number(e.dureeBlocMin) > 0; })) {",
"          var prevues = ex.map(function (e) { return Math.round(Number(e.dureeBlocMin)); });",
"          var somme = prevues.reduce(function (a,b) { return a + b; },0);",
"          if (somme <= min) { durees = prevues; transitionsPedagogiques = min - somme;",
"            if (transitionsPedagogiques > Math.max(3, Math.round(min * 0.2))) manques.push(ph[0] + ' : ' + transitionsPedagogiques + ' min non décrites (transitions ou rotations à préciser)');",
"          } else manques.push(ph[0] + ' : dosage des blocs dépasse le temps disponible ; répartition indicative');",
"        } else manques.push(ph[0] + ' : durées des fiches historiques estimées, à confirmer par l’éducateur');",
"      }",
"      resultat.push({ nom: ph[0], minutes: min, transitions: transitionsPedagogiques, exercices: ex.map(function (e, k) { return { e: e, duree: durees[k] }; }) });"
    ].join('\n'), 'durée realiste');
function pedagogiePanneau() {
  function texte(cle, titre, aide) {
    return h('label', { className: 'cs-champ' }, titre, h('input', { type: 'text', value: rep[cle] || '', placeholder: aide,
      onChange: function (ev) { maj(cle, ev.target.value); } }));
  }
  function choix(cle, titre, valeurs) {
    return h('label', { className: 'cs-champ' }, titre, h('select', { value: String(rep[cle] || ''), onChange: function (ev) { maj(cle, ev.target.value); } },
      [['','Automatique / sans contrainte']].concat(valeurs.map(function (v) { return [v,v]; })).map(function (x) { return h('option', {key:x[0],value:x[0]}, x[1]); })));
  }
  return h('details', { className: 'gn-avances' },
    h('summary', null, 'Critères pédagogiques avancés', h('small', null, 'Compétence, prérequis, opposition, organisation et durée')),
    h('p', { className: 'gn-aide' }, 'Le rôle pédagogique est déterminé par la phase : préparation, acquisition, réinvestissement, opposition ou retour au calme. Les nouvelles fiches doivent préciser leur rôle.'),
    texte('competenceCiblee','Compétence ciblée','Ex. maintenir Tate-shiho-gatame'),
    texte('prerequisAcquis','Prérequis acquis par le groupe','Ex. sorties d’immobilisation'),
    choix('niveauOpposition','Niveau d’opposition maximal',['Sans opposition','Coopération','Opposition dirigée','Opposition libre']),
    choix('organisationSeance','Organisation',['Mixte','Binômes','Trios','Collectif']),
    choix('cibleDureeBlocMin','Durée cible par bloc (minutes)',['4','5','6','8','10']),
    h('p', { className: 'gn-aide' }, 'Les fiches existantes sans ces données restent utilisables, mais les durées sont signalées comme estimées.'));
}
one('    var titre, aide = null, corps, peutSuivre = true;',
    '    ' + pedagogiePanneau.toString().replace(/\n/g, '\n    ') + '\n    var titre, aide = null, corps, peutSuivre = true;',
    'panneau six critères');
const lines = src.split('\n');
const indexes = lines.map(function (s,i) { return s.indexOf("techniques.length ? h('div', { className: 'gn-choix multi gn-sous' }") >= 0 ? i : -1; }).filter(function (i) { return i >= 0; });
assert.equal(indexes.length, 1, 'Sélecteur techniques unique');
assert(lines[indexes[0]].endsWith(' : null);'), 'Fin sélecteur techniques');
lines[indexes[0]] = lines[indexes[0]].replace(/: null\);$/, ': null, pedagogiePanneau());');
src=lines.join('\n');
one("  var VERSION_APP = '03/11/2026 · objectifs pédagogiques Judo';",
    "  var VERSION_APP = '04/11/2026 · critères pédagogiques Judo et validation des ajouts';",
    'version');
fs.writeFileSync('index.html',src);
let sw=fs.readFileSync('sw.js','utf8');
assert(sw.includes('jsb-manager-20261103-jsb-objectifs-judo-v1'));
sw=sw.replace(/jsb-manager-20261103-jsb-objectifs-judo-v1/g,'jsb-manager-20261104-jsb-pedagogie-validation-v1');
fs.writeFileSync('sw.js',sw);
console.log('Patch pédagogique appliqué. Source :',src.length,'caractères');
