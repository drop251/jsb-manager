'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function fonction(n) {
  const a=src.indexOf('  function '+n+'(');
  assert.ok(a>0,'Fonction absente : '+n);
  const b=src.indexOf('\n  }',a);
  assert.ok(b>a,'Fin de fonction absente : '+n);
  return src.slice(a,b+4);
}
function baseContexte() {
  const c={
    console,
    PHASES_SEANCE:['Mobilité','Échauffement','Corps de séance','Randori','Étirement'],
    PHASES_TAISO:['Mobilité','Échauffement','Corps de séance','Retour au calme','Étirements'],
    PHASES_TAISO_V1:['Échauffement et mobilité','Corps de séance','Fin de séance'],
    PHASES_EVEIL_JUDO:['Accueil & salut','Jeux moteurs','Parcours moteurs','Jeux coopératifs','Retour au calme'],
    PHASES_PREPOUSSINS_JUDO:['Accueil & mobilité','Jeux moteurs','Bases du Judo','Opposition éducative','Retour au calme'],
    PHASES_JUDO_AGES: {
      Poussins:['Activation ludique','Échauffement orienté','Apprentissage technique','Mise en situation éducative','Retour au calme et bilan'],
      Benjamins:['Mobilité spécifique','Échauffement technique','Acquisition et consolidation','Opposition à thème','Retour au calme'],
      Minimes:['Activation et mobilité','Préparation technique','Progression technique','Randori à thème','Récupération et bilan'],
      Cadets:['Activation ciblée','Échauffement spécifique','Travail technico-tactique','Randori dirigé ou libre','Récupération et bilan'],
      Juniors:['Préparation physique adaptée','Échauffement spécifique','Développement technico-tactique','Opposition et randori','Récupération'],
      Adultes:['Mobilité et activation','Échauffement orienté','Apprentissage ou perfectionnement','Randori adapté à l’objectif','Retour au calme']
    },
    OBJECTIFS_JUDO:['Découverte et initiation','Apprentissage technique'],
    OBJECTIFS_EVEIL_JUDO:['Découvrir le dojo et les règles','Équilibre et déplacements','Coordination et motricité','Rouler et se relever','Coopération et partage','Explorer le contact en douceur'],
    OBJECTIFS_PREPOUSSINS_JUDO:['Jeux d’équilibre et déplacements','Chutes et roulades','Saisies et déplacements','Coopération à deux','Découverte du travail au sol','Opposition éducative à thème'],
    FAMILLE_DE:{'o-soto-gari':'Nage-waza','juji-gatame':'Kansetsu-waza'},
    MATERIEL_JUDO:[],
    sg:e=>e.sousGroupes||[],
    sa:s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''),
    techniqueDe:s=>String(s||'').split(' : ')[0],
    momentsDe:e=>[e.moment],
    hasard:g=>{let x=g||1;return()=>((x=(x*16807)%2147483647)/2147483647);}
  };
  vm.createContext(c);
  ['estEveilJudo','estJeuneJudo','phasesDe','phasesSeance','dureesGroupeJudo',
    'objectifsGroupeJudo','estExerciceJeuneAdapte','convientPhaseJeune','scoreObjectifJeune','genererSeanceJeunes'].forEach(n=>vm.runInContext(fonction(n),c));
  return c;
}
function exercise(id,nom,groupe,moment,role,opposition,format){
  return {id,nom,description:nom+' au tatami, déplacement contrôlé et alternance',sousGroupes:[groupe],
    moment,categorie:'Jeux',thematique:'Motricité',equipement:'Tatami',rolePedagogique:role||'Préparation',
    niveauOpposition:opposition||'Coopération',format:format||'Solo',dureeBlocMin:4,technique:'Préparation ludique'};
}
test('Éveil, Pré-poussins, Poussins et groupes avancés ont des titres adaptés sans imposer le PDF',()=>{
  const c=baseContexte();
  assert.equal(c.phasesDe('Judo','Éveils (4-5 ans)')[3],'Jeux coopératifs');
  assert.equal(c.phasesDe('Judo','Pré-poussins')[3],'Opposition éducative');
  assert.equal(c.phasesDe('Judo','Poussins')[2],'Apprentissage technique');
  assert.equal(c.phasesDe('Judo','Minimes')[3],'Randori à thème');
  assert.equal(c.phasesDe('Judo','Adultes')[2],'Apprentissage ou perfectionnement');
  assert.equal(c.phasesDe('Taïso','Éveils (4-5 ans)')[3],'Retour au calme');
  const perso=['Départ','Jeux','Technique','Situations','Bilan'];
  assert.deepEqual(Array.from(c.phasesDe('Judo','Poussins',perso)),perso);
  assert.equal(c.phasesSeance({espace:'Judo',trame:2,infos:{groupe:'Pré-poussins'}})[3],'Randori');
  assert.equal(c.phasesSeance({espace:'Judo',trame:3,infos:{groupe:'Pré-poussins'}})[3],'Opposition éducative');
});
test('Objectifs Éveil Judo différents de la technique et du Taïso',()=>{
  const c=baseContexte();
  assert.ok(c.objectifsGroupeJudo('Éveils (4-5 ans)').includes('Coopération et partage'));
  assert.ok(c.objectifsGroupeJudo('Pré-poussins').includes('Opposition éducative à thème'));
  assert.deepEqual(Array.from(c.objectifsGroupeJudo('Poussins')),Array.from(c.OBJECTIFS_JUDO));
});
test('Éveil : aucune projection formelle, immobilisation ni opposition dirigée',()=>{
  const c=baseContexte();
  const g='Éveils (4-5 ans)';
  assert.equal(c.estExerciceJeuneAdapte(exercise(1,'Jeu des animaux',g,'Échauffement')),true);
  console.log('DIAGNOSTIC JEUNES', {eveil:c.estEveilJudo(g), groupe:g, nom:exercise(2,'O-soto-gari : entrée',g,'Corps de séance').nom, technique:c.techniqueDe('O-soto-gari : entrée'), score:c.estExerciceJeuneAdapte(exercise(2,'O-soto-gari : entrée',g,'Corps de séance')), regex:/\\b(?:o-soto-gari)\\b/.test('o-soto-gari : entrée'), source:c.estExerciceJeuneAdapte.toString().slice(0,950)});
  assert.equal(c.estExerciceJeuneAdapte(exercise(2,'O-soto-gari : entrée',g,'Corps de séance')),false);
  assert.equal(c.estExerciceJeuneAdapte(exercise(3,'Jeu opposition éducative',g,'Corps de séance','Opposition','Opposition dirigée','Binôme')),false);
  assert.equal(c.estExerciceJeuneAdapte(exercise(4,'Juji-gatame',g,'Corps de séance')),false);
});
test('Pré-poussins : opposition éducative dirigée possible, opposition libre exclue',()=>{
  const c=baseContexte(),g='Pré-poussins';
  const a=exercise(1,'Jeu d’opposition éducative',g,'Corps de séance','Opposition','Opposition dirigée','Binôme');
  const b=exercise(2,'Randori libre',g,'Corps de séance','Opposition','Opposition libre','Binôme');
  assert.equal(c.convientPhaseJeune(a,'Opposition éducative',g),true);
  assert.equal(c.estExerciceJeuneAdapte(b,g),false);
});
test('Séances Éveils : les rituels restent des temps encadrés, pas de faux exercices',()=>{
  const c=baseContexte(),g='Éveils (4-5 ans)';
  const pool=[
    exercise(1,'Jeu des animaux',g,'Échauffement'),
    exercise(2,'Jeu de déplacements',g,'Échauffement'),
    exercise(3,'Parcours équilibre',g,'Corps de séance'),
    exercise(4,'Atelier ramper et rouler',g,'Corps de séance'),
    exercise(5,'Jeu coopératif à deux',g,'Corps de séance','Application','Coopération','Binôme'),
    exercise(6,'Jeu calme de respiration',g,'Fin de séance','Retour au calme','Sans opposition')
  ];
  const r=c.genererSeanceJeunes({groupe:g,duree:'45 min',objectif:'Coordination et motricité'},pool,pool,43);
  assert.equal(r.phases.reduce((s,p)=>s+p.minutes,0),45);
  assert.equal(r.phases.length,5);
  assert.equal(r.phases[0].exercices.length,0);
  assert.ok(r.phases.every(p=>p.minutes===p.transitions+p.exercices.reduce((s,x)=>s+x.duree,0)));
  assert.ok(r.phases[0].repere.includes('salut'));
  assert.equal(r.phases.some(p=>p.nom==='Randori'),false);
});
test('Aucun blocage par une fiche PDF ou absence d’exercice dans le catalogue',()=>{
  const c=baseContexte(),g='Éveils (4-5 ans)';
  const r=c.genererSeanceJeunes({groupe:g,duree:'60 min',objectif:'Équilibre et déplacements'},[],[],1);
  assert.equal(r.phases.reduce((s,p)=>s+p.minutes,0),60);
  assert.ok(r.manques.some(s=>s.includes('Aucun exercice')));
  assert.equal(r.phases.length,5);
  assert.match(src,/tempsPhases\s*=\s*res\.phases\.map/);
  assert.match(src,/infos\.intitulesPhases/);
  assert.match(src,/PDF.*indicatif|intitulé de cette phase|Intitulé de cette phase/i);
});
