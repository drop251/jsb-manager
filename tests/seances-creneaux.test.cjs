const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const start=html.indexOf('  function seancePrevue('),ctx={};
vm.createContext(ctx);vm.runInContext(html.slice(start,html.indexOf('\n  }',start)+4),ctx);
const entree=(id,heure,date='2026-11-17',cours=['Adultes'])=>({id,heure,date,cours,exos:[]});
test('Deux horaires du même groupe retrouvent chacun leur préparation',()=>{
 const histo=[entree('soir','19:00'),entree('matin','10:00')];
 assert.equal(ctx.seancePrevue(histo,'2026-11-17',['Adultes'],'10:00').id,'matin');
 assert.equal(ctx.seancePrevue(histo,'2026-11-17',['Adultes'],'19:00').id,'soir');
 assert.equal(ctx.seancePrevue(histo,'2026-11-17',['Adultes'],'14:00'),null);
});
test('Les anciennes séances sans horaire restent disponibles mais ne priment pas sur un horaire exact',()=>{
 const histo=[entree('ancienne',''),entree('exacte','19:00')];
 assert.equal(ctx.seancePrevue(histo,'2026-11-17',['Adultes'],'19:00').id,'exacte');
 assert.equal(ctx.seancePrevue(histo,'2026-11-17',['Adultes'],'10:00').id,'ancienne');
 assert.equal(ctx.seancePrevue(histo,'2026-11-18',['Adultes'],'19:00'),null);
 assert.equal(ctx.seancePrevue(histo,'2026-11-17',['Benjamins'],'19:00'),null);
 assert.equal(ctx.seancePrevue(histo,'2026-11-17',['Adultes']).id,'ancienne');
});
