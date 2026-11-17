const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
function fixture(fail=false,liste=null){
 const states=[];let index=0,deleted=[];let histo=liste||[{id:'a',date:'2026-11-17',cours:['Adultes'],espace:'Judo',titre:'Appuis',exos:[]}];
 const c={React:{useState(v){const i=index++;if(!(i in states))states[i]=v;return [states[i],v=>states[i]=v];}},h:(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity).filter(x=>x!=null&&x!==false)}),usePlanning:()=>[],useHisto:()=>histo,lireSel:()=>({}),prochainsCreneaux:()=>[],dateFr:x=>x,heureFr:x=>x,progressable:()=>false,SeanceType:'type',SeanceDirecte:'direct',supprimerHisto:id=>{if(fail)return false;deleted.push(id);histo=histo.filter(x=>x.id!==id);return true;}};
 vm.createContext(c);const start=html.indexOf('  function MesSeances(');vm.runInContext(html.slice(start,html.indexOf('\n  }',start)+4),c);
 return {render(){index=0;return c.MesSeances({aller(){}});},deleted};
}
function nodes(n){return n&&typeof n==='object'?[n,...n.children.flatMap(nodes)]:[];}
function text(n){return n&&typeof n==='object'?n.children.map(text).join(''):String(n??'');}
function click(f,label){const n=nodes(f.render()).find(n=>n.type==='button'&&text(n)===label);assert.ok(n,label);n.props.onClick();}
test('La croix demande confirmation et Conserver ne supprime rien',()=>{const f=fixture();click(f,'✕');assert.equal(f.deleted.length,0);click(f,'Conserver');assert.equal(f.deleted.length,0);assert.ok(!text(f.render()).includes('Confirmer la suppression'));});
test('La confirmation supprime uniquement la séance choisie',()=>{const f=fixture();click(f,'✕');click(f,'Confirmer la suppression');assert.deepEqual(f.deleted,['a']);assert.ok(!text(f.render()).includes('Appuis'));});
test('Un échec conserve la séance et permet de réessayer ou de renoncer',()=>{const f=fixture(true);click(f,'✕');click(f,'Confirmer la suppression');assert.ok(nodes(f.render()).some(n=>n.props.role==='alert'&&text(n).includes('Suppression impossible')));assert.ok(text(f.render()).includes('Appuis'));assert.equal(f.deleted.length,0);click(f,'Conserver');assert.ok(!nodes(f.render()).some(n=>n.props.role==='alert'));});

const seancesRecherche=[
 {id:'j',date:'2026-11-17',cours:['Pré-poussins'],espace:'Judo',titre:'Équilibre et appuis',exos:[]},
 {id:'t',date:'2026-11-16',cours:['Seniors'],espace:'Taïso',titre:'Mobilité douce',exos:[]}
];
function changer(f,type,value){const n=nodes(f.render()).find(n=>n.type===type);assert.ok(n);n.props.onChange({target:{value}});}
function lignes(f){return nodes(f.render()).filter(n=>n.type==='li'&&n.props.className==='ms-ligne');}
test('La recherche retrouve les titres et groupes sans tenir compte des accents et de la casse',()=>{
 const f=fixture(false,seancesRecherche);changer(f,'input','EQUILIBRE pre');assert.equal(lignes(f).length,1);assert.equal(lignes(f)[0].props.key,'j');
 changer(f,'input','17/11/2026');assert.equal(lignes(f)[0].props.key,'j');
 changer(f,'input','2026-11-16');assert.equal(lignes(f)[0].props.key,'t');
});
test('Le filtre de discipline se combine à la recherche et peut être effacé',()=>{
 const f=fixture(false,seancesRecherche);changer(f,'select','Taïso');assert.equal(lignes(f)[0].props.key,'t');
 changer(f,'input','appuis');assert.equal(lignes(f).length,0);assert.ok(text(f.render()).includes('Aucune séance ne correspond'));
 click(f,'Effacer les filtres');assert.equal(lignes(f).length,2);
});
test('La pagination porte sur les résultats et revient à trente après un changement de filtre',()=>{
 const f=fixture(false,Array.from({length:65},(_,i)=>({...seancesRecherche[0],id:String(i)})));
 assert.equal(lignes(f).length,30);click(f,'Voir les séances précédentes (35)');assert.equal(lignes(f).length,60);
 changer(f,'input','appuis');assert.equal(lignes(f).length,30);assert.ok(text(f.render()).includes('65 séances trouvées'));
});
