'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function extraire(name){
 const start=html.indexOf('  function '+name+'(');
 assert.ok(start>=0,'Fonction absente : '+name);
 return html.slice(start,html.indexOf('\n  }',start)+4);
}
function nodes(n){return n&&typeof n==='object'?[n,...n.children.flatMap(nodes)]:[];}
function fixture(largeur){
 const states=[],refs=[],effects=[];let cursor=0,refCursor=0,listener=null,focusCalls=0,closeCalls=0;
 const win={innerWidth:largeur,addEventListener(event,fn){if(event==='resize')listener=fn;},removeEventListener(event,fn){if(event==='resize'&&listener===fn)listener=null;}};
 const doc={body:{classList:{add(){},remove(){}}}};
 const ctx={
  window:win,document:doc,
  React:{useState(initial){
    const i=cursor++;
    if(!(i in states))states[i]=initial;
    return [states[i],v=>{states[i]=typeof v==='function'?v(states[i]):v;}];
   },useEffect(fn){effects.push(fn);},useRef(initial){
    const i=refCursor++;
    if(!refs[i])refs[i]={current:initial};
    return refs[i];
   }},
  ReactDOM:{createPortal:x=>x},
  h:(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity).filter(x=>x!=null&&x!==false)}),
  teinte:()=>({}),court:x=>x,etapesDe:()=>[],aVideo:()=>false,
  dosageAfficheJudo:x=>x.dosage||'',familleCatalogue:()=>'',sousFamilleCatalogue:()=>'',sg:()=>[],
  sansCesure:x=>x,niveauTexte:()=>'',Icone:'Icone',Description:'Description',
  Illustration:'Illustration',Grade:'Grade',ClassementFiche:'ClassementFiche',
  BoutonIllusIA:'BoutonIllusIA',BoutonVideo:'BoutonVideo',BoutonExportFiche:'BoutonExportFiche'
 };
 vm.createContext(ctx);vm.runInContext(extraire('Fiche'),ctx);
 const e={id:101,nom:'Exercice de contrôle',categorie:'Test',public:['Judo'],dosage:'6 répétitions'};
 const props={e,espace:{key:'judo',label:'Judo'},fermer(){closeCalls++;}};
 return {
  render(){cursor=0;refCursor=0;effects.length=0;return ctx.Fiche(props);},
  runEffects(){const cleanups=effects.map(fn=>fn());return cleanups;},
  resize(value){win.innerWidth=value;assert.ok(listener,'Abonnement resize absent');listener();},
  attachAndFocus(){
   assert.ok(refs[0],'Référence de fiche absente');
   refs[0].current={focus(){focusCalls++;}};
  },
  get focusCalls(){return focusCalls;},
  get closeCalls(){return closeCalls;},
  get resizeSubscribed(){return !!listener;}
 };
}
function dialog(tree){const n=nodes(tree).find(n=>n.props.role==='dialog');assert.ok(n,'Dialog absent');return n;}
test('La fiche est modale sur mobile et non modale sur desktop, y compris après redimensionnement',()=>{
 const f=fixture(390);
 let d=dialog(f.render());assert.equal(d.props['aria-modal'],'true');assert.equal(d.props.tabIndex,-1);
 f.runEffects();f.resize(1024);d=dialog(f.render());assert.equal(d.props['aria-modal'],undefined);
 f.runEffects();f.resize(390);d=dialog(f.render());assert.equal(d.props['aria-modal'],'true');
});
test('La fiche conserve une référence stable pour recevoir le focus à l’ouverture',()=>{
 const f=fixture(390),tree=f.render();const d=dialog(tree);
 assert.ok(d.props.ref&&typeof d.props.ref==='object','ref objet nécessaire');
 f.attachAndFocus();f.runEffects();assert.equal(f.focusCalls,1);
});

test('La fermeture Escape et le clic sur le voile n’effacent pas la fiche sans action explicite',()=>{
 const f=fixture(390),t=f.render(),d=dialog(t);
 d.props.onKeyDown({key:'Tab'});assert.equal(f.closeCalls,0);
 d.props.onKeyDown({key:'Escape'});assert.equal(f.closeCalls,1);
 const overlay=nodes(t).find(n=>n.props.className==='voile voile-fiche');
 assert.ok(overlay&&typeof overlay.props.onClick==='function');
 overlay.props.onClick();assert.equal(f.closeCalls,2);
 let stopped=false;d.props.onClick({stopPropagation(){stopped=true;}});
 assert.equal(stopped,true,'Un clic dans la fiche ne doit pas atteindre le voile');
});
test('Le gestionnaire de redimensionnement est retiré lors du démontage',()=>{
 const f=fixture(390);f.render();const cleanups=f.runEffects();
 assert.equal(f.resizeSubscribed,true);
 cleanups.filter(fn=>typeof fn==='function').forEach(fn=>fn());
 assert.equal(f.resizeSubscribed,false);
});
