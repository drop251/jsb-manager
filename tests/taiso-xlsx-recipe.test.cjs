'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {HEADERS,mapTaisoRecipe,restoreSourceRow}=require('../core/taiso-xlsx-recipe.cjs');
const {analyzeCatalogueImport}=require('../core/catalogue-import.cjs');
function fixture(i){
 const row=HEADERS.map((_,j)=>'Fixture '+i+' / '+j);
 row[2]='Taïso';row[3]='Exercice';row[7]='Renforcement';row[20]='a, b, a';
 return row;
}
test('Contrat du classeur provisoire : 228 lignes, 22 champs, aucune perte',()=>{
 const rows=Array.from({length:228},(_,i)=>fixture(i));
 const recipe=mapTaisoRecipe([[...HEADERS],...rows]);
 assert.equal(recipe.publishable,false);assert.equal(recipe.report.count,228);
 assert.deepEqual(recipe.items.map(restoreSourceRow),rows);
 assert.equal(recipe.items[0].exercise.reference,'RECETTE-L0002');
 assert.equal(recipe.items[227].exercise.reference,'RECETTE-L0229');
 assert.equal(analyzeCatalogueImport(JSON.stringify(recipe),'taiso').ok,false);
});
test('Contrat provisoire : refus des cellules absentes, colonnes inattendues et autre discipline',()=>{
 const row=fixture(0);
 assert.throws(()=>mapTaisoRecipe([[...HEADERS].reverse(),row]),/En-têtes/);
 assert.throws(()=>mapTaisoRecipe([[...HEADERS],[...row.slice(0,21),'']]),/Ligne 2/);
 assert.throws(()=>mapTaisoRecipe([[...HEADERS],[...row,'extra']]),/Ligne 2/);
 const judo=[...row];judo[2]='Judo';
 assert.throws(()=>mapTaisoRecipe([[...HEADERS],judo]),/Ligne 2/);
});
