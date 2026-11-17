'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function fn(n){const a=html.indexOf('  function '+n+'(');assert.ok(a>=0);const first=html.slice(a,html.indexOf('\n',a));return /\}\s*$/.test(first)?first:html.slice(a,html.indexOf('\n  }',a)+4);}
const fiche=JSON.parse(fs.readFileSync(path.join(__dirname,'../illustres/catalogue.json'),'utf8')).exercices.find(e=>e.id===9018);
test('La fiche assis-debout reste présente sans les associations publiques incohérentes',()=>{
 assert.ok(fiche);assert.equal(fiche.nom,'Assis-debout de la chaise');assert.equal(fiche.equipement,'Chaise');assert.match(fiche.mediasARevoir,/chaise au mur/);assert.equal(fiche.image,undefined);assert.equal(fiche.video,undefined);assert.equal(fiche.dosage,'5 à 10 répétitions');
});
test('Les médias publics suspendus sont ignorés même si une ancienne association est encore chargée',()=>{
 const c={IMG_PERSO:{},VIDEOS:{},EN_LIGNE:{img:{9018:'ancienne.jpg'},vid:{9018:'ancienne.mp4'}},svgIA:()=>'',h:(type,props,...children)=>({type,props,children})};vm.createContext(c);for(const name of ['imagePerso','aVideo','illustre','Illustration'])vm.runInContext(fn(name),c);
 assert.equal(c.imagePerso(fiche),'');assert.equal(c.aVideo(fiche),false);assert.equal(c.illustre(fiche),false);const visuel=c.Illustration({e:fiche});assert.equal(visuel.type,'div');assert.match(visuel.props['aria-label'],/Visuel à corriger/);
 c.IMG_PERSO[9018]='data:image/png;base64,AAAA';assert.equal(c.Illustration({e:fiche}).type,'img');assert.equal(c.illustre(fiche),true);c.VIDEOS[9018]={nom:'remplacement personnel.mp4'};assert.equal(c.aVideo(fiche),true);
});
test('La suspension publique est transmise à une fiche existante sans changer son contenu ni son identifiant',()=>{
 const existing={id:55,nom:fiche.nom,public:['Taïso'],description:'Contenu du profil'};const c={BASE:[existing],EN_LIGNE:{n:0},cleEL:s=>s.toLowerCase()};vm.createContext(c);vm.runInContext(fn('fusionnerEnLigne'),c);c.fusionnerEnLigne([fiche],()=>{});assert.equal(c.BASE.length,1);assert.equal(existing.id,55);assert.equal(existing.description,'Contenu du profil');assert.equal(existing.mediasARevoir,fiche.mediasARevoir);
});
