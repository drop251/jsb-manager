'use strict';
const {analyzeCatalogueImport}=require('./catalogue-import.cjs');
const HEADERS=Object.freeze(['Nom (exercice)','Exécution','Discipline','Type de fiche','Point de sécurité','Dosage de base','Critère de réussite','Famille principale','Sous-famille','Niveau','Sous-groupe','Matériel','Muscles cibles','Moment de la séance','Variante plus facile','Variante plus difficile','Accessibilité','Inspiration','Format','Catégorie','Tags','Objectif']);
const DETAIL_COLUMNS=Object.freeze({executionDescription:1,sheetType:3,safety:4,dosage:5,successCriteria:6,subfamily:8,level:9,subgroup:10,equipment:11,targetMuscles:12,moment:13,easier:14,harder:15,accessibility:16,inspiration:17,format:18,classification:19,tagsText:20,objective:21});
function mapTaisoRecipe(rows){
 if(!Array.isArray(rows)||rows.length<2||rows.length>2001||!Array.isArray(rows[0])||rows[0].length!==22||HEADERS.some((v,i)=>rows[0][i]!==v))throw Error('En-têtes ou nombre de lignes non conformes');
 const items=rows.slice(1).map((row,i)=>{
  const sourceRow=i+2;
  if(!Array.isArray(row)||row.length!==22||row.some(v=>typeof v!=='string'||!v.trim())||row[2]!=='Taïso'||row[3]!=='Exercice')throw Error('Ligne '+sourceRow+' : type, discipline ou valeur manquante');
  const details=Object.fromEntries(Object.entries(DETAIL_COLUMNS).map(([field,column])=>[field,row[column]]));
  return {sourceRow,exercise:{reference:'RECETTE-L'+String(sourceRow).padStart(4,'0'),name:row[0],family:row[7],details}};
 });
 const result=analyzeCatalogueImport(JSON.stringify({discipline:'taiso',version:'recette-provisoire',exercises:items.map(x=>x.exercise)}),'taiso');
 if(!result.ok)throw Error('Validation canonique refusée : '+JSON.stringify(result.errors));
 // This envelope is deliberately incompatible with the publication service.
 return {purpose:'recipe-only',publishable:false,discipline:'taiso',sourceHeaders:[...HEADERS],items,report:result.report};
}
function restoreSourceRow(item){
 const e=item.exercise,row=Array(22);
 row[0]=e.name;row[2]='Taïso';row[7]=e.family;
 for(const [field,column] of Object.entries(DETAIL_COLUMNS))row[column]=e.details[field];
 return row;
}
module.exports=Object.freeze({HEADERS,mapTaisoRecipe,restoreSourceRow});
