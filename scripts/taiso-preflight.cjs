'use strict';
/**
 * JSB Taïso — audit hors production de lots JSON.
 * Ne convertit pas un classeur Excel ; ne modifie aucune donnée.
 */
const fs = require('node:fs');

function normaliser(v) {
  return String(v == null ? '' : v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');
}
function discipline(row) {
  const p = row.public ?? row.discipline ?? row.activite;
  return Array.isArray(p) ? p.map(normaliser) : [normaliser(p)];
}
function analyser(lignes, {nomFichier = '', nombreAttendu = 20} = {}) {
  if (!Array.isArray(lignes)) throw new TypeError('Un tableau JSON de fiches est requis');
  const erreurs = [], avertissements = [], idMap = new Map(), noms = new Map();
  if (/non[_ -]?import/i.test(nomFichier)) erreurs.push({ligne:null,code:'FICHIER_NON_IMPORT',detail:'Fichier de contrôle interdit à l’import'});
  if (lignes.length !== nombreAttendu) avertissements.push({ligne:null,code:'NOMBRE_INATTENDU',detail:`Attendu ${nombreAttendu}, lu ${lignes.length}`});
  lignes.forEach((row, i) => {
    const ligne = i + 1;
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      erreurs.push({ligne,code:'FICHE_INVALIDE'}); return;
    }
    const nom = String(row.nom ?? row.Nom ?? '').trim();
    if (!nom) erreurs.push({ligne,code:'NOM_MANQUANT'});
    const disciplines = discipline(row);
    if (!disciplines.includes('taiso')) erreurs.push({ligne,code:'DISCIPLINE_NON_TAISO'});
    if (disciplines.includes('judo')) avertissements.push({ligne,code:'DOUBLE_DISCIPLINE_A_VERIFIER'});
    const id = row.id ?? row.ID ?? row.identifiant;
    if (id === null || id === undefined || String(id).trim() === '') {
      erreurs.push({ligne,code:'ID_MANQUANT'});
    } else {
      const key = String(id).trim();
      if (idMap.has(key)) erreurs.push({ligne,code:'ID_DOUBLON',premiereLigne:idMap.get(key)});
      else idMap.set(key,ligne);
    }
    if (nom) {
      const key = normaliser(nom);
      if (noms.has(key)) avertissements.push({ligne,code:'NOM_POTENTIELLEMENT_DOUBLON',premiereLigne:noms.get(key)});
      else noms.set(key,ligne);
    }
    for (const [champ,cles] of Object.entries({
      securite:['pointSecurite','pointDeSecurite','vigilance','Point de sécurité'],
      dosage:['dosage','dosageBase','Dosage de base'],
      critere:['critereReussite','critereDeReussite','Critère de réussite'],
      famille:['famillePrincipale','famille','Famille'],
      niveau:['niveau','Niveau'],
      format:['format','Format']
    })) {
      const value = cles.map(k=>row[k]).find(v=>v!==undefined&&v!==null&&String(v).trim()!=='');
      if (value === undefined) avertissements.push({ligne,code:'CHAMP_A_VERIFIER',champ});
    }
  });
  return {statut:erreurs.length?'NO_GO':'A_VALIDER',nombre:lignes.length,erreurs,avertissements,
    note:'Audit de structure seulement. A_VALIDER ne signifie pas import autorisé.'};
}
function lirePayload(filename) {
  const obj=JSON.parse(fs.readFileSync(filename,'utf8'));
  if (Array.isArray(obj)) return obj;
  if (obj && Array.isArray(obj.exercices)) return obj.exercices;
  throw new TypeError('JSON attendu : tableau ou objet avec clé exercices[]');
}
if (require.main === module) {
  const filename = process.argv[2];
  if (!filename) { process.stderr.write('Usage: node scripts/taiso-preflight.cjs <export.json> [nombre-attendu]\n'); process.exitCode=2; }
  else {
    try {
      const count=process.argv[3]===undefined?20:Number(process.argv[3]);
      if (!Number.isInteger(count)||count<0) throw new TypeError('Nombre attendu entier positif');
      const result=analyser(lirePayload(filename),{nomFichier:filename,nombreAttendu:count});
      process.stdout.write(JSON.stringify(result,null,2)+'\n');
      if(result.statut==='NO_GO') process.exitCode=1;
    } catch (e) { process.stderr.write(String(e.message)+'\n'); process.exitCode=2; }
  }
}
module.exports={analyser,lirePayload};
