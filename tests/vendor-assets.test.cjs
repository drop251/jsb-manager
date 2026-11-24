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
