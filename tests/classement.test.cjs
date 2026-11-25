'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function fn(n){const a=html.indexOf('  function '+n+'(');assert.ok(a>=0);return html.slice(a,html.indexOf('\n  }',a)+4);}
function fixture({fail=false}={}){
 let stored=[{id:55,nom:'O-soto-gari',note:'Dernière note',image:'data:image/png;base64,AAAA'},{id:56,nom:'Autre'}];
 const writes=[];const c={BASE:[],CLE_AJOUTS:'ajouts-profil-a',uniq:xs=>[...new Set(xs)],cle:x=>String(x).toLowerCase().trim(),Stockage:{lire:async()=>stored,ecrire:async(k,v)=>{writes.push(k);if(fail)return false;stored=v;return true;}}};
 vm.createContext(c);for(const name of ['valeurChampPedagogique','verifierNouvelExerciceJudo','enregistrerClassementFiche'])vm.runInContext(fn(name),c);
 return {c,writes,stored:()=>stored};
}
const exercice={id:55,nom:'O-soto-gari',public:['Judo'],description:'Déséquilibrer puis contrôler le partenaire à la chute.',vigilance:'Accompagner la chute.',critere:'Garder le contrôle.',sousGroupes:['Adultes'],grade:'Orange à noire',technique:'Ashi-waza',image:'ancienne',video:'video.mp4'};
const valeurs={typeFiche:'Exercice',famillePrincipale:'Travail debout',sousFamille:'Jambes',tags:'Appuis, Contrôle, Appuis'};
test('Le classement conserve ID, médias et données récentes sans modifier l’original',async()=>{
 const f=fixture();const original=JSON.stringify(exercice);const saved=await f.c.enregistrerClassementFiche(exercice,valeurs);
 assert.equal(saved.id,55);assert.equal(saved.image,'data:image/png;base64,AAAA');assert.equal(saved.video,'video.mp4');assert.equal(saved.note,'Dernière note');assert.equal(saved._jsbOverride,true);
 assert.equal(saved.famillePrincipale,'Travail debout');assert.deepEqual([...saved.tags],['Appuis','Contrôle']);assert.equal(f.stored().length,2);assert.equal(JSON.stringify(exercice),original);
});
test('Un échec de stockage laisse la fiche et les overrides existants intacts',async()=>{
 const f=fixture({fail:true}),before=JSON.stringify(f.stored());await assert.rejects(f.c.enregistrerClassementFiche(exercice,valeurs),/Enregistrement impossible/);
 assert.equal(JSON.stringify(f.stored()),before);assert.equal(exercice.famillePrincipale,undefined);
});
test('Le profil de destination est capturé au début de l’opération',async()=>{
 const f=fixture();let resolve;f.c.Stockage.lire=()=>new Promise(r=>resolve=r);const p=f.c.enregistrerClassementFiche(exercice,valeurs);f.c.CLE_AJOUTS='ajouts-profil-b';resolve([]);await p;
 assert.deepEqual(f.writes,['ajouts-profil-a']);
});
test('Le changement de type contrôle la sécurité et refuse un doublon de même discipline',async()=>{
 const f=fixture();const saved=await f.c.enregistrerClassementFiche(exercice,{...valeurs,typeFiche:'Technique'});assert.equal(saved.typeFiche,'Technique');
 await assert.rejects(f.c.enregistrerClassementFiche({...exercice,vigilance:''},{...valeurs,typeFiche:'Technique'}),/Vigilance/);
 f.c.BASE=[{...exercice,id:99,typeFiche:'Technique'}];await assert.rejects(f.c.enregistrerClassementFiche(exercice,{...valeurs,typeFiche:'Technique'}),/existe déjà/);
});
test('Une correction locale sur une fiche publiée reçoit encore ses médias au rechargement',()=>{
 const f=fixture();f.c.BASE=[{...exercice,typeFiche:'Technique',_jsbOverride:true}];f.c.cleEL=f.c.cle;f.c.EN_LIGNE={n:0};f.c.disciplinesMasquees=[];vm.runInContext(fn('fusionnerEnLigne'),f.c);
 const received=[];f.c.fusionnerEnLigne([{...exercice,image:'medias/test.png'}],(x,e)=>received.push(e.id));assert.deepEqual(received,[55]);assert.equal(f.c.BASE.length,1);assert.equal(f.c.BASE[0].typeFiche,'Technique');
});
test('Le formulaire bloque la conversion d’une fiche encore sélectionnée dans le brouillon',()=>{
 const f=fixture(),states=[];let index=0;
 f.c.React={useState:initial=>{const i=index++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return[states[i],v=>states[i]=v];}};
 f.c.h=(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity).filter(x=>x!=null&&x!==false)});
 f.c.sousFamilleCatalogue=()=>'';vm.runInContext(fn('ClassementFiche'),f.c);
 const render=()=>{index=0;return f.c.ClassementFiche({e:exercice,sel:{has:()=>true}});};
 const nodes=n=>n&&typeof n==='object'?[n,...n.children.flatMap(nodes)]:[];
 let tree=render();nodes(tree).find(x=>x.type==='select').props.onChange({target:{value:'Technique'}});tree=render();nodes(tree).find(x=>x.type==='form').props.onSubmit({preventDefault(){}});tree=render();
 assert.ok(nodes(tree).some(x=>x.props.role==='status'&&x.children.some(t=>typeof t==='string'&&t.includes('Retirez cette fiche'))));assert.equal(f.writes.length,0);
});
