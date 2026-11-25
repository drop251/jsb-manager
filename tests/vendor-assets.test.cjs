'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const files=['react','react-dom','xlsx','jspdf'].map(name=>'vendor/'+name+'.js');
test('Le fichier HTML reste accessible aux outils GitHub (moins de 1 Mo)',()=>{
  assert.ok(Buffer.byteLength(html,'utf8')<1000000,'Le fichier HTML dépasse le budget de maintenance');
});
test('Les bibliothèques locales sont chargées une seule fois, en ordre, avant le code applicatif',()=>{
  let previous=-1;
  const application=html.indexOf('var h = React.createElement');
  assert.ok(application>0);
  for(const file of files){
    const marker='<script src="./'+file+'"></script>';
    const pos=html.indexOf(marker);
    assert.ok(pos>previous && pos<application,file);
    assert.equal(html.lastIndexOf(marker),pos,file);
    previous=pos;
    const source=fs.readFileSync(path.join(root,file),'utf8');
    assert.ok(Buffer.byteLength(source)>10000 && Buffer.byteLength(source)<1000000,file);
    assert.doesNotThrow(()=>new vm.Script(source,{filename:file}));
    assert.ok(sw.includes("'./"+file+"'"),'Ressource hors ligne absente : '+file);
  }
});
test('Les données et le gabarit PDF restent dans le HTML',()=>{
  assert.match(html,/<script id="base" type="application\/json">/);
  assert.match(html,/<script id="exemples" type="application\/json">/);
  assert.match(html,/<script id="fiche-pdf" type="text\/plain">/);
});

test('La typographie Archivo reste locale et disponible hors ligne',()=>{
  const marker='<link rel="stylesheet" href="./ui/archivo.css">';
  assert.ok(html.includes(marker));
  assert.equal(html.indexOf(marker),html.lastIndexOf(marker));
  assert.ok(!html.includes('data:font/woff2;base64,'));
  const css=fs.readFileSync(path.join(root,'ui/archivo.css'),'utf8');
  assert.match(css,/@font-face\s*\{\s*font-family:\s*'Archivo'/);
  assert.match(css,/data:font\/woff2;base64,/);
  assert.ok(sw.includes("'./ui/archivo.css'"),'Police absente du cache hors ligne');
});

test('Le noyau de stockage modulaire est chargé avant l’application et précaché',()=>{
  const marker='<script src="./core/stockage-web.js"></script>';
  assert.ok(html.includes(marker));
  assert.equal(html.indexOf(marker),html.lastIndexOf(marker));
  assert.ok(html.indexOf(marker)<html.indexOf('var h = React.createElement'));
  assert.ok(sw.includes("'./core/stockage-web.js'"));
  const source=fs.readFileSync(path.join(root,'core/stockage-web.js'),'utf8');
  assert.doesNotThrow(()=>new vm.Script(source));
  const {creerStockage}=require('../core/stockage-web.js');
  const api=creerStockage({});
  assert.deepEqual(Object.keys(api).sort(),['lire','ecrire','ecrireLot','fermer','oublierAncien','ancien','proteger'].sort());
  assert.match(source,/BASE = 'jsb-manager', TABLE = 'donnees'/);
  assert.match(html,/var Stockage = window.JSBStockageWeb.creerStockage\(window\)/);
});

test('Les modules métier du Judo, du Taïso et du club sont locaux et précachés',()=>{
  for(const name of ['judo','taiso','club']){
    const file='modules/'+name+'.js',marker='<script src="./'+file+'"></script>';
    assert.ok(html.includes(marker),file);
    assert.equal(html.indexOf(marker),html.lastIndexOf(marker),file);
    assert.ok(html.indexOf(marker)<html.indexOf('var h = React.createElement'),file);
    assert.ok(sw.includes("'./"+file+"'"),file);
    assert.doesNotThrow(()=>new vm.Script(fs.readFileSync(path.join(root,file),'utf8')));
  }
  const {creerService}=require('../modules/club.js');
  const service=creerService({CATEGORIES:[],COURS_ADULTES:'Adultes',COURS_TAISO:'Taïso',Date,aujourdhui:()=> '2026-11-25'});
  assert.equal(typeof service.bilanDe,'function');
  assert.equal(typeof service.suiviDe,'function');
  assert.deepEqual(service.bilanDe({judokas:[],seances:[]},''),[]);
});
