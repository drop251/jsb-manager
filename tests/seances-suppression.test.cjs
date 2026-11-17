const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
function fixture(fail=false){
 const states=[];let index=0,deleted=[];let histo=[{id:'a',date:'2026-11-17',cours:['Adultes'],espace:'Judo',titre:'Appuis',exos:[]}];
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
