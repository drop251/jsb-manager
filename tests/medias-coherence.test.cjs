'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function fn(n){const a=html.indexOf('  function '+n+'(');assert.ok(a>=0);const first=html.slice(a,html.indexOf('\n',a));return /\}\s*$/.test(first)?first:html.slice(a,html.indexOf('\n  }',a)+4);}
const fiche=JSON.parse(fs.readFileSync(path.join(__dirname,'../illustres/catalogue.json'),'utf8')).exercices.find(e=>e.id===9018);
test('La fiche assis-debout reste présente sans les associations publiques incohérentes',()=>{
 assert.ok(fiche);assert.equal(fiche.nom,'Assis-debout de la chaise');assert.equal(fiche.equipement,'Chaise');assert.match(fiche.mediasARevoir,/chaise au mur/);assert.equal(fiche.image,undefined);assert.equal(fiche.video,undefined);assert.equal(fiche.dosage,'5 à 10 répétitions');
});
test('Les illustrations restent absentes même avec des images enregistrées',()=>{
 const c={IMG_PERSO:{9018:'data:image/png;base64,AAAA'},VIDEOS:{},EN_LIGNE:{img:{9018:'ancienne.jpg'},vid:{9018:'ancienne.mp4'}},h:()=>{throw Error('Aucun élément visuel attendu');}};vm.createContext(c);for(const name of ['imagePerso','aVideo','illustre','Illustration','svgIA','BoutonIllusIA'])vm.runInContext(fn(name),c);
 assert.equal(c.imagePerso(fiche),'');assert.equal(c.svgIA(fiche),'');assert.equal(c.Illustration({e:fiche}),null);assert.equal(c.BoutonIllusIA({e:fiche}),null);assert.equal(c.illustre(fiche),false);c.VIDEOS[9018]={nom:'personnelle.mp4'};assert.equal(c.aVideo(fiche),true);
});
test('La suspension publique est transmise à une fiche existante sans changer son contenu ni son identifiant',()=>{
 const existing={id:55,nom:fiche.nom,public:['Taïso'],description:'Contenu du profil'};const c={BASE:[existing],EN_LIGNE:{n:0},disciplinesMasquees:[],cleEL:s=>s.toLowerCase()};vm.createContext(c);vm.runInContext(fn('fusionnerEnLigne'),c);c.fusionnerEnLigne([fiche],()=>{});assert.equal(c.BASE.length,1);assert.equal(existing.id,55);assert.equal(existing.description,'Contenu du profil');assert.equal(existing.mediasARevoir,fiche.mediasARevoir);
});

test('Les disciplines vidées ne sont pas réintroduites par le catalogue distant',()=>{
 const c={BASE:[],EN_LIGNE:{n:0},disciplinesMasquees:['Judo'],cleEL:s=>s.toLowerCase()};vm.createContext(c);vm.runInContext(fn('fusionnerEnLigne'),c);
 c.fusionnerEnLigne([{id:1,nom:'Judo',public:['Judo']},{id:2,nom:'Commun',public:['Judo','Taïso']}],()=>{});
 assert.deepEqual(JSON.parse(JSON.stringify(c.BASE.map(e=>[e.id,e.public]))),[[2,['Taïso']]]);
 c.disciplinesMasquees=['Judo','Taïso'];c.BASE=[];c.fusionnerEnLigne([{id:2,nom:'Commun',public:['Judo','Taïso']}],()=>{});assert.equal(c.BASE.length,0);
});
