'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function fn(n){const a=html.indexOf('  function '+n+'(');assert.ok(a>=0);const end=html.indexOf('\n',a),line=html.slice(a,end);return /\}\s*$/.test(line)?line:html.slice(a,html.indexOf('\n  }',a)+4);}
function init(){
 const c={cle:x=>String(x).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,''),publicDe:()=> 'Judo',categorieDe:()=> 'Force-Puissance',piloteDe:()=> 'Dynamique',formatDe:x=>x.format,equipementDe:x=>x.equipement,momentDe:(p,cat,x)=>x.moment,agesDe:()=>['Adultes'],AGE_TXT:{Adultes:'Adultes'},FAMILLES:{},familleDe:()=> 'Ashi-waza'};
 vm.createContext(c);vm.runInContext(html.slice(html.indexOf('  var CHAMPS ='),html.indexOf('  function normaliserLigne(')),c);
 for(const n of ['sansAcc','normaliserLigne','valeurChampPedagogique','gradeDe','niveauDe','normaliserModeDosageJudo','maximumRepetitionsJudo','repetitionsDoseJudo','secondesDosageJudo','modeDosageJudoDe','normaliserRoleJudo','normaliserOppositionJudo','dosageMixteAutoriseJudo','verifierNouvelExerciceJudo','classer'])vm.runInContext(fn(n),c);
 return c;
}
function ligne(){return {'Nom (exercice)':'Entrées en déplacement','Exécution':'Tori entre sans projeter ; Uke accompagne le déplacement et conserve ses appuis.','Discipline':'Judo','Type de fiche':'Exercice','Point de sécurité':'Contrôler les déplacements sans heurter le partenaire.','Dosage de base':'3 × 6 répétitions, récup 30 s','Critère de réussite':'Placement stable avant chaque entrée.','Famille':'Travail debout','Niveau':'Intermédiaire','Grade':'Verte à bleue','Sous-groupe':'Adultes','Matériel':'Tatami + Judogi','Muscles cibles':'Selon la situation','Moment de la séance':'Corps de séance','Variante plus facile':'Sans déplacement.','Variante plus difficile':'Avec changement de direction.','Accessibilité':'Avec la variante douce','Inspiration':'Création personnelle, adaptation du cycle précédent','Format':'Binôme','Technique':'Ashi-waza','Thématique':'Placement et contrôle','Compétence ciblée':'Coordonner déplacement et entrée','Rôle pédagogique':'Acquisition','Prérequis':'Aucun','Niveau d’opposition':'Coopération','Organisation':'Tori réalise six entrées et Uke accompagne ; alterner les rôles après chaque série, repos 30 s.'};}
test('Les intitulés humains sont classés et validés sans perdre accessibilité, source, dosage et variantes',()=>{
 const c=init(),brut=ligne(),e=c.classer(brut,'Judo');assert.equal(e.dosage,brut['Dosage de base']);assert.equal(e.accessibilite,brut.Accessibilité);assert.equal(e.inspiration,brut.Inspiration);assert.equal(e.varianteFacile,brut['Variante plus facile']);assert.equal(e.varianteDifficile,brut['Variante plus difficile']);assert.equal(e.niveau,'Intermédiaire');assert.equal(e.grade,'Verte à bleue');assert.equal(e.technique,'Ashi-waza');assert.equal(e.modeDosageJudo,'Répétitions');assert.deepEqual([...c.verifierNouvelExerciceJudo(brut,e)],[]);
});
test('L’organisation détaillée ne suffit pas à déclarer un format manquant',()=>{
 const c=init(),b=ligne();delete b.Format;const e=c.classer(b,'Judo');assert.match(c.verifierNouvelExerciceJudo(b,e).join(' '),/Format manquant/);
});
test('Aucune source ni accessibilité ne sont inventées lorsque ces champs sont absents',()=>{
 const c=init(),b=ligne();delete b.Inspiration;delete b.Accessibilité;delete b.Niveau;const e=c.classer(b,'Judo');assert.equal(e.inspiration,'');assert.equal(e.accessibilite,'');assert.equal(e.niveau,'');assert.equal(e.grade,'Verte à bleue');
});
function nodes(n){return n&&typeof n==='object'?[n,...n.children.flatMap(nodes)]:[];}
function texte(n){return n&&typeof n==='object'?n.children.map(texte).join(''):String(n??'');}
function renderFiche(e){const c={React:{useState:x=>[x,()=>{}],useEffect(){},useRef:value=>({current:value})},ReactDOM:{createPortal:x=>x},h:(type,props,...children)=>({type,props:props||{},children:children.flat(Infinity).filter(x=>x!=null&&x!==false)}),window:{innerWidth:390},document:{body:{}},teinte:()=>({}),etapesDe:()=>[],aVideo:()=>false,dosageAfficheJudo:e=>e.dosage,familleCatalogue:e=>e.famille,sousFamilleCatalogue:()=>'',sg:e=>e.sousGroupes,sansCesure:x=>x,niveauTexte:e=>e.grade||e.niveau,court:x=>x};for(const n of ['Icone','Description','Illustration','Grade','ClassementFiche','BoutonIllusIA','BoutonVideo','BoutonExportFiche'])c[n]=n;vm.createContext(c);vm.runInContext(fn('Fiche'),c);return c.Fiche({e,espace:{key:'judo',label:'Judo'}});}
test('La fiche priorise la sécurité et conserve toutes les rubriques ainsi que le grade séparé',()=>{
 const c=init(),e=c.classer(ligne(),'Judo'),t=renderFiche(e),flat=nodes(t);
 const essential=flat.find(n=>n.type==='dl'&&n.props.className==='faits fiche-essentiel');
 assert.deepEqual(nodes(essential).filter(n=>n.type==='dt').map(texte),['Point de sécurité','Dosage de base','Critère de réussite']);
 assert.ok(flat.indexOf(essential)<flat.findIndex(n=>n.type==='Description'));
 const labels=flat.filter(n=>n.type==='dt').map(texte);
 for(const label of ['Famille','Niveau','Sous-groupe','Matériel','Muscles cibles','Moment de la séance','Variante plus facile','Variante plus difficile','Accessibilité','Inspiration','Format','Grade Judo'])assert.ok(labels.includes(label),label);
 const adapt=flat.find(n=>n.props.className==='fiche-adapt');
 assert.deepEqual(nodes(adapt).filter(n=>n.type==='dt').map(texte),['Variante plus facile','Variante plus difficile','Accessibilité']);
 const admin=flat.find(n=>n.props.className==='fiche-outils fiche-admin');
 for(const type of ['ClassementFiche','BoutonVideo','BoutonExportFiche'])assert.ok(nodes(admin).some(n=>n.type===type),type);
 assert.equal(flat.some(n=>n.type==='figure'),false,'Pas de média vide');
});
test('L’export HTML conserve le texte complet, les sources et l’ordre des champs',()=>{
 const c=init();vm.runInContext(fn('esc'),c);vm.runInContext(html.slice(html.indexOf('  var CHAMPS_FICHE ='),html.indexOf('  function esc(')),c);vm.runInContext(fn('ficheHtml'),c);const e=c.classer(ligne(),'Judo'),out=c.ficheHtml(e,{},'');assert.ok(out.includes(e.inspiration));assert.ok(out.indexOf(e.description)<out.indexOf('Point de sécurité</h2>'));const fields=['Dosage de base','Critère de réussite','Famille','Niveau','Sous-groupe','Matériel','Muscles cibles','Moment de la séance','Variante plus facile','Variante plus difficile','Accessibilité','Inspiration','Format'];let last=-1;for(const f of fields){const at=out.indexOf('<dt>'+f+'</dt>');assert.ok(at>last,f);last=at;}
});
