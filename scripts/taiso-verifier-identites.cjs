'use strict';
/**
 * Contrôle non destructif du lot Taïso V46. Ne crée ni ne remplace d'ID.
 * Usage : node scripts/taiso-verifier-identites.cjs lot.json [base-locale.json]
 */
const fs=require('node:fs'),path=require('node:path');
const MANIFEST=path.join(__dirname,'../docs/manifeste-corrections-taiso-v46.NON_IMPORT.json');
const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ');
const liste=v=>Array.isArray(v)?v:(v&&Array.isArray(v.exercices)?v.exercices:null);
function lire(f){const v=liste(JSON.parse(fs.readFileSync(f,'utf8')));if(!v)throw Error('JSON : tableau ou {exercices:[]} requis');return v;}
function controle(lot,manifeste,baseLocale=null){
 if(!Array.isArray(lot)||!manifeste||!Array.isArray(manifeste.items))throw TypeError('Entrées invalides');
 if(baseLocale!==null&&!Array.isArray(baseLocale))throw TypeError('Base locale invalide');
 const erreurs=[],observations=[],rencontres=[];
 const attendu=manifeste.items;
 if(lot.length!==attendu.length)erreurs.push({code:'NOMBRE_FICHES',attendu:attendu.length,lu:lot.length});
 const nomsManifest=new Set(),refs=new Set();
 for(const f of attendu){
   if(nomsManifest.has(norm(f.nom)))erreurs.push({code:'DOUBLON_NOM_MANIFESTE',nom:f.nom});
   nomsManifest.add(norm(f.nom));
   if(refs.has(f.referenceHistorique))erreurs.push({code:'DOUBLON_REFERENCE',ref:f.referenceHistorique});
   refs.add(f.referenceHistorique);
   if(f.idApplicatif!==null)erreurs.push({code:'ID_APPLICATIF_PREATTRIBUE',ref:f.referenceHistorique});
 }
 const vus=new Map();
 for(let i=0;i<lot.length;i++){
   const f=lot[i];
   if(!f||typeof f!=='object'||Array.isArray(f)){erreurs.push({code:'FICHE_INVALIDE',ligne:i+1});continue;}
   const nom=String(f.nom??f['Nom (exercice)']??f.Nom??'').trim();
   const k=norm(nom);if(!k)erreurs.push({code:'NOM_MANQUANT',ligne:i+1});
   if(vus.has(k))erreurs.push({code:'NOM_REPETE_LOT',ligne:i+1,premiere:vus.get(k)});
   else vus.set(k,i+1);
   if(f.id!==undefined||f.ID!==undefined||f.identifiant!==undefined)
     observations.push({ligne:i+1,code:'ID_SOURCE_A_VERIFIER',valeur:String(f.id??f.ID??f.identifiant)});
   if(f.index!==undefined) observations.push({ligne:i+1,code:'INDEX_NON_ID',valeur:String(f.index)});
   const m=attendu.find(x=>norm(x.nom)===k);
   if(!m){erreurs.push({ligne:i+1,code:'FICHE_HORS_MANIFESTE',nom});continue;}
   const ref=m.referenceHistorique;
   let locaux=null;
   if(baseLocale!==null){
     locaux=baseLocale.filter(x=>norm(x?.nom)===k&&([].concat(x?.public??x?.discipline??[]).some(v=>norm(v)==='taiso')));
     if(locaux.length!==1)erreurs.push({ligne:i+1,code:locaux.length?'BASE_LOCALE_AMBIGUE':'FICHE_ABSENTE_BASE_LOCALE',nom,nombre:locaux.length});
   }
   rencontres.push({ligne:i+1,nom,referenceHistorique:ref,
     idApplicatifObserve:locaux?.length===1?(locaux[0].id??null):null,statut:'VALIDATION_HUMAINE_REQUISE'});
 }
 for(const m of attendu)if(!vus.has(norm(m.nom)))erreurs.push({code:'REFERENCE_MANQUANTE_LOT',ref:m.referenceHistorique});
 return {statut:'NO_GO_IMPORT',nombre:lot.length,erreurs,observations,rencontres,
   note:baseLocale===null?'Aucune base locale analysée : identifiants applicatifs inconnus.':'IDs locaux observés uniquement, aucune association automatique à une référence historique.'};
}
if(require.main===module){
 try{
   if(!process.argv[2])throw Error('Usage : node scripts/taiso-verifier-identites.cjs lot.json [base-locale.json]');
   const m=JSON.parse(fs.readFileSync(MANIFEST,'utf8'));
   const r=controle(lire(process.argv[2]),m,process.argv[3]?lire(process.argv[3]):null);
   process.stdout.write(JSON.stringify(r,null,2)+'\n');
   if(r.erreurs.length)process.exitCode=1;
 }catch(e){process.stderr.write(e.message+'\n');process.exitCode=2;}
}
module.exports={controle};
