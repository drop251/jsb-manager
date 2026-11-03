'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
function fn(name) {
  const start=html.indexOf('  function '+name+'(');
  assert.ok(start>=0,name);
  const end=html.indexOf('\n  }',start);
  assert.ok(end>start,name+' closing');
  return html.slice(start,end+4);
}
test('import: une ligne Judo complète met à jour la même fiche sans dupliquer son ID',()=>{
  const context={
    IMG_PERSO:{},ILLUS_IA:{},VIDEOS:{},lireIdMax:()=>5000,
    cle:x=>String(x||'').toLowerCase().trim(),
    illustrationDe:()=>({image:'',svg:'',lien:false}),
    classer:l=>({nom:l.nom,public:['Judo'],description:l.description||'',competenceCiblee:l.competenceCiblee||'',rolePedagogique:l.rolePedagogique,prerequis:l.prerequis}),
    verifierNouvelExerciceJudo:l=>l.complet?[]:['Fiche incomplète'],
    formeEnfants:()=>({exclu:null}),
  };
  vm.createContext(context);
  vm.runInContext(fn('valeurChampPedagogique'),context);
  vm.runInContext(fn('preparerAjouts'),context);
  const anciens=[{id:5001,nom:'O-soto-gari',public:['Judo'],description:'Ancien contenu',image:'data:image/png;base64,AAAA'}];
  const row={nom:'O-soto-gari',description:'Nouvelle consigne',competenceCiblee:'Contrôle du déséquilibre',rolePedagogique:'Acquisition',prerequis:'Aucun',complet:true};
  const result=context.preparerAjouts([row],anciens);
  assert.equal(result.ajouts.length,0);
  assert.equal(result.majFiches.length,1);
  assert.equal(result.majFiches[0].id,5001);
  assert.equal(result.majFiches[0].description,'Nouvelle consigne');
  assert.equal(result.majFiches[0].image,'data:image/png;base64,AAAA');
  assert.equal(result.majFiches[0]._jsbOverride,true);
  assert.equal(result.refuses.length,0);
  const refused=context.preparerAjouts([Object.assign({},row,{complet:false})],anciens);
  assert.equal(refused.refuses.length,1);
  assert.equal(refused.majFiches.length,0);
});
test('import: une nouvelle ligne incomplète est refusée',()=>{
  const context={
    IMG_PERSO:{},ILLUS_IA:{},VIDEOS:{},lireIdMax:()=>5000,
    cle:x=>String(x||'').toLowerCase().trim(),
    illustrationDe:()=>({image:'',svg:'',lien:false}),
    classer:l=>({nom:l.nom,public:['Judo'],description:l.description||''}),
    verifierNouvelExerciceJudo:()=>['Compétence ciblée obligatoire'],
    formeEnfants:()=>({exclu:null})
  };
  vm.createContext(context);
  vm.runInContext(fn('preparerAjouts'),context);
  const r=context.preparerAjouts([{nom:'Exercice nouveau'}],[]);
  assert.equal(r.ajouts.length,0);
  assert.equal(r.refuses.length,1);
});
test('les enrichissements des fiches historiques sont appliqués et les ajouts conservés',async()=>{
  const ctx={
    BASE_ORIGINE:null, BASE:[{id:1,nom:'Ancien',public:['Judo']}],
    CLE_AJOUTS:'ajouts',
    chargerIllusIA:()=>Promise.resolve(),
    chargerEnLigne:()=>Promise.resolve(true),
    Stockage:{lire:()=>Promise.resolve([{id:1,nom:'Corrigé',public:['Judo'],_jsbOverride:true,ajoute:false},{id:3,nom:'Nouveau',public:['Judo'],ajoute:true}])}
  };
  vm.createContext(ctx);
  vm.runInContext(fn('ajouterLocaux'),ctx);
  await ctx.ajouterLocaux();
  assert.equal(ctx.BASE.length,2);
  assert.equal(ctx.BASE[0].nom,'Corrigé');
  assert.equal(ctx.BASE[0].ajoute,false);
  assert.equal(ctx.BASE[1].nom,'Nouveau');
  assert.equal(ctx.BASE[1].ajoute,true);
});
test('les informations pédagogiques apparaissent dans les exports de fiches',()=>{
  for(const s of ['competenceCiblee','rolePedagogique','prerequis','niveauOpposition','organisation','dureeBlocMin']){
    assert.match(html,new RegExp("\\['[^']+', '"+s+"'\\]"));
  }
});
