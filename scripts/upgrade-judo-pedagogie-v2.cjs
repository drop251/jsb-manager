'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
let src=fs.readFileSync('index.html','utf8');
function replace(before,after,name) {let i=src.indexOf(before);assert(i>=0,name+' introuvable');assert(src.indexOf(before,i+1)<0,name+' ambigu');src=src.slice(0,i)+after+src.slice(i+before.length);}
replace("materielDetail: String(x.equipement || ''),", "materielDetail: String(x.materielDetail || x.equipement || ''),", 'matériel');
replace("var r = { ajouts: [], doublons: [], ignores: 0, formes: 0, exclus: {}, illustrations: [], liens: 0, refuses: [] };",
        "var r = { ajouts: [], majFiches: [], doublons: [], ignores: 0, formes: 0, exclus: {}, illustrations: [], liens: 0, refuses: [] };",'rapport');
const old=[
'      if (deja[k]) {',
'        r.doublons.push(e.nom);',
'        // Exercice déjà dans la base : on garde seulement son illustration',
'        var ex = (l.id != null && parId[Number(l.id)] && cle(parId[Number(l.id)].nom) === cle(e.nom) ? parId[Number(l.id)] : null) || parCle[k] || parNom[cle(e.nom)];',
'        if (ex && (il.image || il.svg)) r.illustrations.push({ id: ex.id, nom: ex.nom, image: il.image, svg: il.svg });',
'        return;',
'      }'
].join('\n');
const neu=[
'      if (deja[k]) {',
'        var ex = (l.id != null && parId[Number(l.id)] && cle(parId[Number(l.id)].nom) === cle(e.nom) ? parId[Number(l.id)] : null) || parCle[k] || parNom[cle(e.nom)];',
'        if (ex && (il.image || il.svg)) r.illustrations.push({ id: ex.id, nom: ex.nom, image: il.image, svg: il.svg });',
"        var majPeda = !!(ex && valeurChampPedagogique(l, ['description']) && valeurChampPedagogique(l, ['competenceCiblee','compétence ciblée']));",
'        if (majPeda) {',
'          var erreursMaj = verifierNouvelExerciceJudo(l, e);',
'          if (erreursMaj.length) { r.refuses.push({ nom: e.nom, raisons: erreursMaj }); return; }',
'          var ficheMaj = Object.assign({}, ex, e, { id: ex.id, ref: ex.ref || e.ref, ajoute: !!ex.ajoute, _jsbOverride: !ex.ajoute });',
"          ['image','illustration','video'].forEach(function (m) { if (!e[m] && ex[m]) ficheMaj[m] = ex[m]; });",
'          r.majFiches.push(ficheMaj);',
'          return;',
'        }',
'        r.doublons.push(e.nom);',
'        return;',
'      }'
].join('\n');
replace(old,neu,'mise à jour par nom et ID');
replace("if (r.refuses && r.refuses.length) { r.ajouts = []; r.formes = 0; setRapport(r);",
        "if (r.refuses && r.refuses.length) { r.ajouts = []; r.majFiches = []; r.formes = 0; setRapport(r);",'aucune mise à jour si refus');
const beforeSave=[
'      (rapport.ajouts.length ? Stockage.lire(CLE_AJOUTS).then(function (anciens) {',
'        return Stockage.ecrire(CLE_AJOUTS, (Array.isArray(anciens) ? anciens : []).concat(rapport.ajouts));',
'      }) : Promise.resolve(true)).then(function (ok) {'
].join('\n');
const afterSave=[
'      (rapport.ajouts.length || rapport.majFiches.length ? Stockage.lire(CLE_AJOUTS).then(function (anciens) {',
'        var parId = {};',
'        (Array.isArray(anciens) ? anciens : []).forEach(function (ex) { if (ex && ex.id) parId[ex.id] = ex; });',
'        rapport.ajouts.concat(rapport.majFiches).forEach(function (ex) { parId[ex.id] = ex; });',
'        return Stockage.ecrire(CLE_AJOUTS, Object.keys(parId).map(function (id) { return parId[id]; }));',
'      }) : Promise.resolve(true)).then(function (ok) {'
].join('\n');
replace(beforeSave,afterSave,'enregistrement des enrichissements');
replace("setMsg([rapport.ajouts.length ? rapport.ajouts.length + ' exercices ajoutés' : '',",
        "setMsg([rapport.ajouts.length ? rapport.ajouts.length + ' exercices ajoutés' : '', rapport.majFiches.length ? rapport.majFiches.length + ' fiches mises à jour' : '',",'confirmation');
replace("          rapport.illustrations.length ? rapport.illustrations.length + (rapport.illustrations.length > 1 ? ' illustrations' : ' illustration') + ' pour des exercices existants' : '',",
        "          rapport.majFiches.length ? rapport.majFiches.length + ' fiches existantes prêtes à être mises à jour' : '',\n          rapport.illustrations.length ? rapport.illustrations.length + (rapport.illustrations.length > 1 ? ' illustrations' : ' illustration') + ' pour des exercices existants' : '',",'aperçu');
replace("rapport.refuses && rapport.refuses.length ? 'Import bloqué' : rapport.ajouts.length ? 'Enregistrer' : 'Intégrer les illustrations'",
        "rapport.refuses && rapport.refuses.length ? 'Import bloqué' : rapport.ajouts.length || rapport.majFiches.length ? 'Enregistrer les fiches' : 'Intégrer les illustrations'",'libellé bouton');
replace("if (!Array.isArray(a) || !a.length) return;\n      var ids = {}; BASE.forEach(function (e) { ids[e.id] = 1; });\n      BASE = BASE.concat(a.filter(function (e) { return e && !ids[e.id]; }).map(function (e) { return Object.assign({}, e, { ajoute: true }); }));",
        "if (!Array.isArray(a) || !a.length) return;\n      var ids = {}; BASE.forEach(function (e,i) { ids[e.id] = i; });\n      a.forEach(function (e) { if (!e || !e.id) return;\n        if (ids[e.id] !== undefined) { if (e._jsbOverride) BASE[ids[e.id]] = Object.assign({}, BASE[ids[e.id]], e, { ajoute: false }); }\n        else { ids[e.id] = BASE.length; BASE.push(Object.assign({}, e, { ajoute: true })); }\n      });",'appliquer les mises à jour');
replace("Stockage.ecrire(CLE_AJOUTS, [])]);",
        "Stockage.lire(CLE_AJOUTS).then(function (ajouts) { return Stockage.ecrire(CLE_AJOUTS, (Array.isArray(ajouts) ? ajouts : []).filter(function (e) { return e && e._jsbOverride; })); })]);",'préserver les enrichissements lors du retrait des ajouts');
replace("['Accessibilité', 'accessibilite'], ['Précaution ostéoporose', 'precaution'], ['Inspiration', 'inspiration']];",
        "['Accessibilité', 'accessibilite'], ['Précaution ostéoporose', 'precaution'], ['Inspiration', 'inspiration'],\n    ['Compétence ciblée', 'competenceCiblee'], ['Rôle pédagogique', 'rolePedagogique'], ['Prérequis', 'prerequis'],\n    ['Niveau d’opposition', 'niveauOpposition'], ['Organisation Tori/Uke, rotations et repos', 'organisation'], ['Durée réaliste du bloc (min)', 'dureeBlocMin']];",
        'fiche exportée');
fs.writeFileSync('index.html',src);
console.log('V2 : enrichissement des exercices existants, médias préservés, détails exportables.');
