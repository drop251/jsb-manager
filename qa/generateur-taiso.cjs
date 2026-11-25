const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html','utf8');
function part(start,end) {
 const a=html.indexOf(start), b=html.indexOf(end,a+start.length);
 assert.ok(a>=0 && b>a, start); return html.slice(a,b);
}
const source = [
 part('  function hasard(', '  function melanger('),
 part('  function melanger(', '\n'), 
 part('  function supervisionRequiseTaiso(', '  // V26 : moteur Taïso indépendant'),
 part('  function genererSeanceTaiso(', '  // V27 : moteur Judo indépendant'),
 part('  var CONTRAINTES =', '  function zoneDe('),
 part('  function estImpact(', '  function estUnilateral('),
 part('  function niveauOk(', '  // Un exercice convient-il à ce format ?'),
 part('  function estMobilite(', '  function routineParDefaut('),
 'var FORMATS_DOUX=["Circuit"]; var FORMATS_TAISO=["Circuit"];'
].join('\n');
const ctx={
 sg:e=>e.sousGroupes||[], momentsDe:e=>e.moments||[], illustre:()=>false,
 sa:s=>String(s||'').toLowerCase(), MOTS_CALME:/relaxation|respiration/,
 construireBlocs:(format,pool,minutes,doux,choisir,niveau,opts)=>[{minutes,items:choisir(pool,4,true).map(e=>({e}))}],
 zonesTravaillees:()=>({}), cibleZones:()=>0
};
vm.createContext(ctx);vm.runInContext(source,ctx);
const mk=(id,props={})=>({id,nom:'Test '+id,public:['Taïso'],sousGroupes:['Gym douce','Training'],niveau:'Débutant',categorie:'Renforcement',moments:['Corps de séance'],equipement:'Poids du corps',...props});
const good=mk(1), judo=mk(2,{public:['Judo']}), supervision=mk(3,{supervisionRequise:true}),
 impact=mk(4,{categorie:'Pliométrie'}), technique=mk(5,{typeFiche:'Technique'}),
 mobilite=mk(6,{categorie:'Mobilité',moments:['Échauffement']}),
 mobiliteJudo=mk(7,{public:['Judo'],categorie:'Mobilité',moments:['Échauffement']}),
 equipement=mk(8,{equipement:'Haltères'}), niveau=mk(9,{niveau:'Expert'}),
 nonMobilite=mk(10), interdit=mk(11,{accessibilite:'Publics entraînés uniquement'}),
 binome=mk(12,{format:'Binôme'});
const all=[good,judo,supervision,impact,technique,mobilite,mobiliteJudo,equipement,niveau,nonMobilite,interdit,binome];
const rep={groupe:'Gym douce',duree:'60 min',routine:[6,7,10],sansMateriel:true,supervision:false};
const run=(r,items=all)=>ctx.genererSeanceTaiso(r,items,items,42);
const ids=res=>Array.from(res.phases.flatMap(p=>p.exercices.map(x=>x.e.id)));
const res=run(rep);
assert.deepEqual(Array.from(res.phases,p=>p.nom),['Mobilité','Échauffement','Corps de séance','Retour au calme','Étirements']);
assert.equal(res.phases.reduce((a,p)=>a+p.minutes,0),60);
assert.deepEqual(Array.from(res.phases[0].exercices,x=>x.e.id),[6]);
assert.ok(ids(res).includes(1));
for(const id of [2,3,4,5,7,8,9,11,12]) assert.ok(!ids(res).includes(id),'Exclu '+id);
assert.ok(res.manques.some(x=>x.includes('routine')));
assert.deepEqual(ids(res),ids(run(rep)));
assert.ok(ids(run({...rep,supervision:true})).includes(3));
const empty=run({...rep,routine:[]},[]);
assert.equal(ids(empty).length,0);
assert.ok(empty.manques.length);
console.log('V26 : phases, durée, discipline, restrictions, routine, répétabilité et catalogue vide contrôlés (sélecteur de blocs simulé).');
