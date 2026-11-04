'use strict';
// Tests du moteur Présences — sans navigateur ni dépendance supplémentaire.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

function source(nom, retrait = 2) {
  const p = ' '.repeat(retrait), debut = html.indexOf(p + 'function ' + nom + '(');
  assert.ok(debut >= 0, 'Fonction absente : ' + nom);
  const ligneFin = html.indexOf('\n', debut);
  // Plusieurs helpers de Présences tiennent sur une seule ligne.
  if (html.slice(debut, ligneFin).trimEnd().endsWith('}')) return html.slice(debut, ligneFin);
  const fin = html.indexOf('\n' + p + '}', debut);
  assert.ok(fin > debut, 'Fonction non fermée : ' + nom);
  return html.slice(debut, fin + p.length + 3);
}
class DateFixe extends Date {
  constructor(...args) { super(...(args.length ? args : ['2026-11-04T12:00:00Z'])); }
  static now() { return Date.parse('2026-11-04T12:00:00Z'); }
}
function environnement() {
  const c = {
    console, Date: DateFixe, Blob, Uint8Array,
    CATEGORIES: [['Éveils 4 ans',0,4],['Éveils 5 ans',5,5],['Pré-poussins',6,7],['Poussins',8,9],['Benjamins',10,11],['Minimes',12,13],['Cadets',14,16],['Juniors',17,19],['Seniors',20,200]],
    COURS_ADULTES:'Adultes (12 ans et +)', COURS_TAISO:'Taïso (13 ans et +)',
    COL_LICENCE:['licence','nlicence','nodelicence','numerodelicence','numerolicence','nlicencie','licencen'],
    COL_NAISSANCE:['datedenaissance','naissance','nele','neele','datenaissance','ddn'],
    aujourdhui:()=> '2026-11-04', nouvelId:()=> 'id-nouveau', 
    setMsg:()=>{}, enregistrerFichier:()=>{}
  };
  c.window=c;
  vm.createContext(c);
  for (const n of ['debutSaison','catDe','coursDe','ageDe','peutTaiso','coursListe','rangCat','triCat','triJudokas','bilanDe','suiviDe','aSurveiller','cleTexte','oui','deux','lireDate','brut','colonne','memeJudoka','distance','trouverJudoka','fusionnerJudokas','exporterExcel','dateFr','nomComplet'])
    vm.runInContext(source(n),c);
  return c;
}
test('export Excel inclut sans erreur les judokas archivés et leurs présences historiques',()=>{
  const c=environnement();
  const fichiers={};
  c.XLSX={
    utils:{book_new:()=>({feuilles:{}}), json_to_sheet:rows=>rows,
      book_append_sheet:(wb,rows,n)=>{wb.feuilles[n]=rows;fichiers[n]=rows;}},
    write:()=>new Uint8Array([1,2,3])
  };
  c.enregistrerFichier=()=>{};
  const j={id:'j1',nom:'MARTIN',prenom:'Alex',naissance:'2016-02-01',archive:'2026-2027'};
  const d={judokas:[j],seances:[
    {id:'s1',date:'2025-04-10',groupe:'Poussins',statuts:{j1:'P'}},
    {id:'s2',date:'2026-10-10',groupe:'Benjamins',statuts:{j1:'A'}}
  ]};
  assert.doesNotThrow(()=>c.exporterExcel(d,()=>{}));
  assert.equal(fichiers.Bilan.length,1);
  assert.equal(fichiers.Bilan[0]['Présent'],1);
  assert.equal(fichiers.Bilan[0].Absent,1);
  assert.equal(fichiers.Présences[0]['10/04/2025 Poussins'],'P');
});
test('bilan général garde les anciennes catégories sans les attribuer au nouveau cours',()=>{
  const c=environnement();
  const j={id:'j1',nom:'Martin',prenom:'Alex',naissance:'2016-02-01'};
  const d={judokas:[j],seances:[
    {date:'2025-04-10',groupe:'Poussins',statuts:{j1:'P'}},
    {date:'2026-10-10',groupe:'Benjamins',statuts:{j1:'A'}}]};
  assert.equal(c.bilanDe(d,'')[0].nb,2);
  assert.equal(c.bilanDe(d,'Benjamins')[0].nb,1);
  assert.equal(c.suiviDe(d,j).saison.n,1);
});
test('trois absences sur des dates différentes déclenchent une alerte par cours',()=>{
  const c=environnement();
  const j={id:'j1',nom:'Martin',prenom:'Alex',naissance:'2000-01-01',activite:'les deux'};
  const t=c.COURS_TAISO, a=c.COURS_ADULTES;
  const seances=[
    {date:'2026-10-24',groupe:a,statuts:{j1:'A'}},
    {date:'2026-10-24',groupe:a,statuts:{j1:'A'}},
    {date:'2026-10-17',groupe:a,statuts:{j1:'A'}},
    {date:'2026-10-10',groupe:a,statuts:{j1:'A'}},
    {date:'2026-10-17',groupe:t,statuts:{j1:'P'}}
  ];
  const suivi=c.suiviDe({judokas:[j],seances},j);
  assert.equal(suivi.serie,3);
  assert.equal(suivi.serieCours,a);
});
test('un import photo Non retire aussi la photo précédemment autorisée',()=>{
  const c=environnement();
  const old={id:'j1',nom:'Martin',prenom:'Alex',licence:'123',naissance:'2016-02-01',autorisationPhoto:true,photo:'data:image/jpeg;base64,AA=='};
  const rows=[{Nom:'Martin','Prénom':'Alex','N° de licence':'123','Date de naissance':'01/02/2016','Autorisation photo':'Non'}];
  const result=c.fusionnerJudokas([old],rows);
  assert.equal(result.completes,1);
  assert.equal(result.liste[0].autorisationPhoto,false);
  assert.equal(result.liste[0].photo,'');
  assert.equal(result.liste[0].id,'j1');
});
test('rapprochement approximatif refuse les conflits de licence ou de naissance',()=>{
  const c=environnement();
  const liste=[{id:'j1',nom:'Durand',prenom:'Emma',naissance:'2016-01-01',licence:'AAA'}];
  assert.equal(c.trouverJudoka(liste,{nom:'Durand',prenom:'Ema',naissance:'2017-01-01',licence:''}),null);
  assert.equal(c.trouverJudoka(liste,{nom:'Durand',prenom:'Ema',naissance:'2016-01-01',licence:'BBB'}),null);
});
test('un appel validé reste verrouillé pendant la validation d’un autre cours',()=>{
  const c=environnement();
  const a=c.COURS_ADULTES, t=c.COURS_TAISO, j={id:'j1',nom:'Martin',prenom:'Alex'};
  c.donnees={judokas:[j],seances:[{id:'s1',date:'2026-11-04',groupe:a,statuts:{j1:'P'},validee:'2026-11-04T10:00:00.000Z'}]};
  c.date='2026-11-04'; c.appelValide=false; c.coursAppel=[a,t]; c.inscrits=[{j,c:a},{j,c:t}]; c.aNoter=[{j,c:t}]; c.compte={P:1,A:0};
  c.maj=d=>{c.donnees=d;}; c.setConfValider=()=>{}; c.vibrer=()=>{};c.annoncer=()=>{};
  for(const n of ['seanceDe','coursVerrouille','noter','validerAppel','pluriel'])
    vm.runInContext(source(n,4),c);
  c.noter([['j1',a]],'A');
  assert.equal(c.donnees.seances[0].statuts.j1,'P');
  c.noter([['j1',t]],'P');
  assert.equal(c.donnees.seances.length,2);
  assert.equal(c.donnees.seances[1].statuts.j1,'P');
  c.validerAppel();
  assert.equal(c.donnees.seances[0].validee,'2026-11-04T10:00:00.000Z');
  assert.ok(c.donnees.seances[1].validee);
  assert.equal(c.donnees.seances[0].statuts.j1,'P');
});

test('le stockage de secours rétablit les données après une indisponibilité IndexedDB',async()=>{
  const local=new Map(), base=new Map();
  const db={
    transaction(){
      const tx={};
      tx.objectStore=()=>({
        get(cle) { const req={}; queueMicrotask(()=>{req.result=base.get(cle);req.onsuccess?.();queueMicrotask(()=>tx.oncomplete?.());});return req; },
        put(val,cle) { const req={}; queueMicrotask(()=>{base.set(cle,val);req.result=cle;req.onsuccess?.();queueMicrotask(()=>tx.oncomplete?.());});return req; }
      });
      return tx;
    }
  };
  const idb={
    open(){const req={};queueMicrotask(()=>{req.result=db;req.onsuccess?.();});return req;}
  };
  const c={
    console,Promise,queueMicrotask,indexedDB:idb,
    localStorage:{
      getItem:k=>local.get(k)??null,
      setItem:(k,v)=>{local.set(k,String(v));},
      removeItem:k=>{local.delete(k);}
    },navigator:{storage:{}}
  };
  c.window=c; c.window.indexedDB=null;
  vm.createContext(c);
  const debut=html.indexOf('  var Stockage = (function () {');
  const fin=html.indexOf('\n  })();',debut);
  assert.ok(debut>=0 && fin>debut);
  vm.runInContext(html.slice(debut,fin+8),c);
  assert.equal(await c.Stockage.ecrire('presences-test',{numero:2}),true);
  assert.equal(JSON.parse(local.get('presences-test-secours')).numero,2);
  c.window.indexedDB=idb;
  const relu=await c.Stockage.lire('presences-test');
  assert.equal(relu.numero,2);
  assert.equal(base.get('presences-test').numero,2);
  assert.equal(local.has('presences-test-secours'),false);
});
