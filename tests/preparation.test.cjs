'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function fn(name){const a=html.indexOf('  function '+name+'('),b=html.indexOf('\n  }',a);assert.ok(a>=0&&b>a);return html.slice(a,b+4);}
function fixture({fail=false,failSelection=false,intention=null,exosHistorique=null}={}){
 const states=[];let index=0;const saved=[],exported=[],effects=[];
 const c={JSON,Date,Math,Object,console};vm.createContext(c);
 c.React={Fragment:'fragment',useState(initial){const i=index++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],x=>states[i]=typeof x==='function'?x(states[i]):x];},useEffect(fn){effects.push(fn);}};
 c.h=(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity).filter(x=>x!=null&&x!==false)});
 c.lireJSON=()=>({infos:{},plan:{1:{phase:2,duree:'8'}}});c.sa=x=>x.toLowerCase();c.suffixeProfil=()=> '-test';c.usePlanning=()=>[];c.useHisto=()=>[];
 c.phasesDe=()=> ['Accueil','Échauffement','Technique','Opposition','Retour au calme'];c.phaseDefaut=()=>2;c.estJeuneJudo=()=>false;c.prochainsCreneaux=()=>[];
 c.dateIsoLocale=()=> '2026-11-17';c.ajouterHisto=s=>{if(fail)return false;saved.push(s);return true;};c.materielSeance=()=> 'Tatami';c.uniq=xs=>[...new Set(xs)];c.sg=e=>e.sousGroupes||[];c.FORMATS_TAISO=[];
 c.construirePdf=()=>new Blob(['test']);c.enregistrerFichier=(...args)=>exported.push(args);c.SeanceDirecte='SeanceDirecte';
 c.window={confirm:()=>true};
 c.prendreIntention=()=>intention;c.lireHisto=()=>[{id:'ancienne',date:'2026-11-16',espace:'Judo',trame:3,infos:{groupe:'Adultes',thematique:'Ancienne séance'},exos:exosHistorique||[{id:1,phase:2,duree:'12'}]}];c.dateFr=x=>x;
 vm.runInContext(fn('PanierSeance'),c);
 const props={espace:'Judo',sous:'Poussins',sel:{ids:[1],set:()=>!failSelection},donnees:[{id:1,nom:'Entrées',public:['Judo'],sousGroupes:['Poussins'],categorieAge:'Poussins',technique:'Ashi-waza',thematique:'Placement',dosage:'3 × 6'}]};
 const render=()=>{index=0;return c.PanierSeance(props);};
 let tree=render();tree.props.onClick();
 return {render,saved,exported,reprendreIntention:()=>effects[1]()};
}
function nodes(n){return n&&typeof n==='object'?[n,...n.children.flatMap(nodes)]:[];}
function text(n){return n&&typeof n==='object'?n.children.map(text).join(''):String(n??'');}
function find(t,p){const n=nodes(t).find(p);assert.ok(n,'Contrôle manquant');return n;}
function button(t,label){return find(t,n=>n.type==='button'&&text(n)===label);}
test('Une séance manuelle conserve ses valeurs proposées dans l’historique et au lancement',()=>{
 const f=fixture();let t=f.render();button(t,'Enregistrer la séance').props.onClick();
 assert.equal(f.saved.length,1);assert.equal(f.saved[0].infos.groupe,'Poussins');assert.equal(f.saved[0].infos.duree,'8 min');assert.equal(f.saved[0].infos.objectif,'Placement');
 t=f.render();assert.ok(text(find(t,n=>n.props.className==='cs-etat')).includes('Cette version est enregistrée'));
 button(t,'▶ Lancer la séance').props.onClick();t=f.render();const direct=find(t,n=>n.type==='SeanceDirecte');
 assert.equal(direct.props.seance.infos.groupe,'Poussins');assert.equal(direct.props.seance.exos.length,1);
});
test('Une retouche après enregistrement remet la version à l’état de brouillon',()=>{
 const f=fixture();let t=f.render();button(t,'Enregistrer la séance').props.onClick();t=f.render();
 find(t,n=>n.props.id==='cs-groupe').props.onChange({target:{value:'Benjamins'}});t=f.render();
 assert.ok(text(find(t,n=>n.props.className==='cs-etat')).includes('Brouillon'));
 assert.equal(f.saved[0].infos.groupe,'Poussins');
 button(t,'Enregistrer la séance').props.onClick();assert.equal(f.saved[1].infos.groupe,'Benjamins');
});
test('Un échec d’enregistrement ne marque pas la séance comme conservée et ne masque pas l’erreur par un export',()=>{
 const f=fixture({fail:true});let t=f.render();button(t,'Enregistrer la séance').props.onClick();t=f.render();
 assert.ok(text(find(t,n=>n.props.className==='cs-etat')).includes('Brouillon'));
 assert.ok(text(find(t,n=>n.props.className==='cs-msg')).includes('Enregistrement impossible'));
 button(t,'Exporter la fiche PDF').props.onClick();assert.equal(f.exported.length,0);assert.equal(f.saved.length,0);
});

test('Une reprise depuis le planning qui échoue conserve les informations du brouillon',()=>{
 const f=fixture({failSelection:true,intention:{type:'reprendre',id:'ancienne',cle:'2026-11-18|cours'}});
 f.reprendreIntention();const t=f.render();
 assert.ok(text(find(t,n=>n.props.className==='cs-msg')).includes('Reprise impossible'));
 button(t,'Enregistrer la séance').props.onClick();
 assert.equal(f.saved[0].infos.groupe,'Poussins');assert.equal(f.saved[0].infos._cours,undefined);
 assert.equal(f.saved[0].exos[0].duree,'8');
});
test('Une reprise réussie depuis le planning transmet le créneau et les informations de la séance',()=>{
 const f=fixture({intention:{type:'reprendre',id:'ancienne',cle:'2026-11-18|cours'}});
 f.reprendreIntention();const t=f.render();button(t,'Enregistrer la séance').props.onClick();
 assert.equal(f.saved[0].infos.groupe,'Adultes');assert.equal(f.saved[0].infos._cours,'2026-11-18|cours');
 assert.equal(f.saved[0].exos[0].duree,'12');
});

test('Une reprise avec un exercice absent du catalogue conserve le brouillon au lieu de tronquer la séance',()=>{
 const f=fixture({intention:{type:'reprendre',id:'ancienne',cle:'2026-11-18|cours'},exosHistorique:[{id:1,phase:2,duree:'12'},{id:999,phase:2,duree:'6'}]});
 f.reprendreIntention();const t=f.render();
 assert.ok(text(find(t,n=>n.props.className==='cs-msg')).includes('1 exercice ne figure plus'));
 button(t,'Enregistrer la séance').props.onClick();
 assert.equal(f.saved[0].infos.groupe,'Poussins');assert.equal(f.saved[0].infos._cours,undefined);assert.equal(f.saved[0].exos[0].duree,'8');
});
