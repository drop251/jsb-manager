'use strict';
/**
 * JSB Manager / Taïso V46 : rapprochement descriptif en lecture seule.
 * Entrées JSON (tableau ou {exercices: [...]}); aucun ajout ni fusion.
 */
const fs = require('node:fs');
function normaliser(v) {
  return String(v == null ? '' : v).normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
    .replace(/[’']/g, "'").replace(/[\s_-]+/g, ' ');
}
function idDe(row) {
  const v = row.id ?? row.ID ?? row.identifiant;
  return v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim();
}
function nomDe(row) {
  return String(row.nom ?? row.Nom ?? '').trim();
}
function charger(file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const rows = Array.isArray(data) ? data : data && data.exercices;
  if (!Array.isArray(rows)) throw Error('Format JSON invalide : tableau ou {exercices:[]} requis');
  if (!rows.every(x=>x && typeof x === 'object' && !Array.isArray(x)))
    throw Error('Chaque entrée doit être une fiche JSON');
  return rows;
}
function indexer(rows) {
  const ids = new Map(), noms = new Map();
  rows.forEach((row, i) => {
    const id=idDe(row), nom=normaliser(nomDe(row));
    if (id !== null) { if(!ids.has(id)) ids.set(id, []); ids.get(id).push(i); }
    if (nom) { if(!noms.has(nom)) noms.set(nom, []); noms.get(nom).push(i); }
  });
  return {ids,noms};
}
function rapprocher(candidats, controle) {
  if (!Array.isArray(candidats) || !Array.isArray(controle))
    throw TypeError('Deux tableaux sont requis');
  const idx=indexer(controle), internes=indexer(candidats);
  const entrees=candidats.map((row,i)=>{
    if (!row || typeof row!=='object' || Array.isArray(row))
      return {ligne:i+1,statut:'INVALIDE',motif:'Fiche candidate non objet'};
    const id=idDe(row), nom=nomDe(row), n=normaliser(nom);
    const candidatsId=id === null ? [] : (idx.ids.get(id) || []);
    const candidatsNom=n ? (idx.noms.get(n) || []) : [];
    const uniqueId=id===null || (internes.ids.get(id)||[]).length===1;
    const uniqueNom=!n || (internes.noms.get(n)||[]).length===1;
    const fiche={ligne:i+1,id,nom,statut:'',references:[],motif:''};
    const refs=new Set([...candidatsId,...candidatsNom]);
    fiche.references=[...refs].sort((a,b)=>a-b).map(j=>({ligne:j+1,id:idDe(controle[j]),nom:nomDe(controle[j])}));
    if (!id || !nom) {fiche.statut='INCOMPLET';fiche.motif='Identifiant ou nom manquant';}
    else if (!uniqueId || !uniqueNom) {fiche.statut='AMBIGU_CANDIDATS';fiche.motif='Doublon interne au lot candidat';}
    else if (candidatsId.length>1 || candidatsNom.length>1 || refs.size>1) {
      fiche.statut='AMBIGU_REFERENCE';fiche.motif='Plusieurs références possibles dans le contrôle';
    } else if (candidatsId.length===1 && candidatsNom.length===1 && candidatsId[0]===candidatsNom[0]) {
      fiche.statut='CORRESPONDANCE_EXACTE';fiche.motif='Même identifiant et même nom normalisé';
    } else if (candidatsId.length===1) {
      fiche.statut='CONFLIT_ID_NOM';fiche.motif='Identifiant identique mais nom différent ou absent';
    } else if (candidatsNom.length===1) {
      fiche.statut='NOM_SEUL';fiche.motif='Nom identique mais identifiant différent ou absent';
    } else {
      fiche.statut='AUCUNE_CORRESPONDANCE';fiche.motif='Aucun rapprochement exact possible';
    }
    return fiche;
  });
  const repartition=Object.fromEntries([...new Set(entrees.map(x=>x.statut))].sort().map(k=>[k,entrees.filter(x=>x.statut===k).length]));
  return {nature:'RAPPROCHEMENT_DOCUMENTAIRE_NON_IMPORT',totalCandidats:candidats.length,
    totalControle:controle.length,repartition,entrees,
    decision:'NO_GO_IMPORT',note:'Tout statut nécessite une décision humaine ; aucune fusion ni écriture.'};
}
if (require.main === module) {
  const [a,b]=process.argv.slice(2);
  if(!a||!b) {process.stderr.write('Usage: node scripts/taiso-rapprochement.cjs candidats.json controle_NON_IMPORT.json\n');process.exitCode=2;}
  else {
    try {
      if(!/non[_ -]?import/i.test(b)) throw Error('Le second fichier doit porter explicitement NON_IMPORT');
      const out=rapprocher(charger(a),charger(b));
      process.stdout.write(JSON.stringify(out,null,2)+'\n');
    } catch(err) {process.stderr.write(String(err.message)+'\n');process.exitCode=2;}
  }
}
module.exports={normaliser,idDe,nomDe,charger,rapprocher};
