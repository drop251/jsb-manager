'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
function fn(name) {
  const start = html.indexOf('  function '+name+'(');
  assert.ok(start>=0, name+' présent dans index.html');
  const end = html.indexOf('\n  }',start);
  assert.ok(end>start,name+' correctement fermé');
  return html.slice(start,end+4);
}
function setup(names) {
  const ctx={console};
  vm.createContext(ctx);
  names.forEach(n=>vm.runInContext(fn(n),ctx));
  return ctx;
}
const names=['valeurChampPedagogique','normaliserRoleJudo','normaliserOppositionJudo','verifierNouvelExerciceJudo','roleCompatibleJudo','bonusPedagogiqueJudo'];
function fiche() {
  return {
    nom:'Tate-shiho-gatame : conserver le contrôle',
    public:'Judo', description:'Conserver la position pendant que Uke essaie de tourner sur le côté.',
    thematique:'Immobilisations et sorties', dosage:'4 répétitions de 30 secondes',
    vigilance:'Aucune pression sur le cou et arrêt au signal.',
    critere:'Garder le contrôle tout en laissant respirer Uke.',
    sousGroupes:'Poussins', grade:'Jaune à orange', famille:'Ne-waza (Osaekomi-waza)',
    moment:'Corps de séance', format:'Binôme', equipement:'Tatami + Judogi',
    varianteFacile:'Uke reste passif', varianteDifficile:'Uke sort sur un côté',
    competenceCiblee:'Conserver Tate-shiho-gatame face à une sortie',
    rolePedagogique:'Consolidation', prerequis:'Aucun', niveauOpposition:'Opposition dirigée',
    organisation:'Tori maintient, Uke cherche une sortie ; alternance après chaque reprise, repos 30 s.',
    dureeBlocMin:'6'
  };
}
test('les six nouveaux champs et les données du catalogue sont obligatoires pour un nouvel exercice Judo',()=>{
  const x=setup(names);
  assert.deepEqual([...x.verifierNouvelExerciceJudo(fiche(),{nom:'test',public:['Judo']})],[]);
  const incomplet=fiche();
  delete incomplet.prerequis;delete incomplet.critere;delete incomplet.dureeBlocMin;
  assert.match(x.verifierNouvelExerciceJudo(incomplet,{nom:'test',public:['Judo']}).join(' '),/Prérequis|prérequis/);
  assert.match(x.verifierNouvelExerciceJudo(incomplet,{nom:'test',public:['Judo']}).join(' '),/Critère de réussite/);
  assert.match(x.verifierNouvelExerciceJudo(incomplet,{nom:'test',public:['Judo']}).join(' '),/Durée de bloc/);
  assert.deepEqual([...x.verifierNouvelExerciceJudo(incomplet,{nom:'test',public:['Taïso']})],[]);
});
test('rôles Tori-Uke, rotation, repos et durée réaliste sont contrôlés',()=>{
  const x=setup(names);
  const f=fiche();
  f.organisation='Deux partenaires côte à côte, sans détails';
  f.dureeBlocMin='0';
  const m=x.verifierNouvelExerciceJudo(f,{nom:'test',public:['Judo']}).join(' / ');
  assert.match(m,/Tori et Uke/);assert.match(m,/rotations/);assert.match(m,/repos/);
  assert.match(m,/Durée de bloc/);
});
test('rôle, prerequis et niveau d’opposition gouvernent la phase',()=>{
  const x=setup(names);
  const exercice={rolePedagogique:'Acquisition',prerequis:'Savoir se placer',niveauOpposition:'Coopération',format:'Binôme'};
  assert.equal(x.roleCompatibleJudo(exercice,'Échauffement',{}),false);
  assert.equal(x.roleCompatibleJudo(exercice,'Corps de séance',{}),false);
  assert.equal(x.roleCompatibleJudo(exercice,'Corps de séance',{prerequisAcquis:'Savoir se placer',niveauOpposition:'Opposition dirigée'}),true);
  assert.equal(x.roleCompatibleJudo(exercice,'Corps de séance',{prerequisAcquis:'Savoir se placer',niveauOpposition:'Sans opposition'}),false);
  assert.equal(x.roleCompatibleJudo({rolePedagogique:'Opposition',prerequis:'Aucun',niveauOpposition:'Opposition dirigée',format:'Binôme'},'Randori',{niveauOpposition:'Opposition dirigée'}),true);
  assert.equal(x.roleCompatibleJudo({rolePedagogique:'Opposition',prerequis:'Aucun',niveauOpposition:'Coopération',format:'Binôme'},'Randori',{}),false);
});
test('aucune fiche invalidée ne peut être sauvegardée en contournant l’aperçu',()=>{
  assert.match(html,/Import refusé : corrigez toutes les fiches/);
  assert.match(html,/Enregistrement bloqué : corrigez les fiches refusées/);
  assert.match(html,/disabled: !!\(rapport\.refuses && rapport\.refuses\.length\)/);
  assert.match(html,/var erreursFiche = verifierNouvelExerciceJudo\(l, e\)/);
  assert.match(html,/roleCompatibleJudo\(e, phasePedagogique, rep\)/);
});
test('la génération utilise les durées déclarées et signale les trous sans inventer des exercices',()=>{
  const ctx=setup(names);
  Object.assign(ctx,{
    hasard:()=>()=>0.5, melanger:a=>a, MATERIEL_JUDO:[],
    MOTS_RANDORI:/randori/i,MOTS_CALME:/calme/i,
    sa:s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''),
    scoreObjectifJudo:()=>1,sg:e=>e.sousGroupes,momentsDe:e=>[e.moment],
    illustre:()=>false,evite:()=>false,estMobilite:()=>false,
    formatParDefaut:()=>'Circuit',niveauParDefaut:()=>'Débutant',formatsDe:()=>['Circuit'],
    niveauOk:()=>true,zoneDe:()=>'tronc',cibleZones:()=>0,
    construireBlocs:()=>[],zonesTravaillees:()=>({})
  });
  vm.runInContext(fn('okTaiso'),ctx);
  vm.runInContext(fn('repartirDurees'),ctx);
  vm.runInContext(fn('genererSeance'),ctx);
  function e(id,nom,moment,role,duree,opp) {
    return {id,nom,sousGroupes:['Poussins'],equipement:'Tatami',moment,categorie:'Équilibre',technique:'Ne-waza (Osaekomi-waza)',rolePedagogique:role,competenceCiblee:'Conserver une immobilisation',prerequis:'Aucun',niveauOpposition:opp||'Coopération',dureeBlocMin:duree,format:'Binôme'};
  }
  const list=[
    e(1,'Routine','Échauffement','Préparation',6), e(2,'Échauffement','Échauffement','Préparation',10),
    e(3,'Préparer placement','Corps de séance','Acquisition',6),
    e(4,'Contrôle 1','Corps de séance','Consolidation',6),
    e(5,'Contrôle 2','Corps de séance','Consolidation',6),
    e(6,'Contrôle 3','Corps de séance','Application',6),
    e(7,'Randori sortie','Corps de séance','Opposition',6,'Opposition dirigée'),
    e(8,'Randori entrée','Corps de séance','Opposition',6,'Opposition dirigée'),
    e(9,'Retour calme','Fin de séance','Retour au calme',7,'Sans opposition')
  ];
  const rep={groupe:'Poussins',duree:'60 min',routine:[1],objectif:'Travail au sol — Ne-waza',calme:'Étirements',cibleDureeBlocMin:'6',niveauOpposition:'Opposition dirigée',organisationSeance:'Mixte'};
  const result=ctx.genererSeance(rep,true,list,list,10);
  assert.equal(result.phases.reduce((s,p)=>s+p.minutes,0),60);
  for(const ph of result.phases) {
    if(!ph.exercices.length)continue;
    assert.equal(ph.exercices.reduce((s,x)=>s+x.duree,0)+(ph.transitions||0),ph.minutes,ph.nom);
  }
  assert.ok(result.phases.find(x=>x.nom==='Randori').exercices.every(x=>x.e.rolePedagogique==='Opposition'));
});
