'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {normalize,merge}=require('../core/attendance-sync.js');
const id=n=>String(n).padStart(32,'0');
const g=id(1),a=id(2),b=id(3),t=id(4),date='2026-11-27';
function snapshot(marks=[]){return {groups:[{id:g,name:'Groupe recette'}],members:[{id:a,name:'A fictif',groupId:g,active:true},{id:b,name:'B fictif',groupId:g,active:true}],slots:[{id:t,groupId:g,label:'Vendredi 18h'}],calls:marks.length?[{date,slotId:t,marks}]:[]};}
const mark=(memberId,status)=>({memberId,status});
test('Fusion indépendante de deux appels sur le même créneau',()=>{
 const r=merge(snapshot(),snapshot([mark(a,'present')]),snapshot([mark(b,'excused')]));
 assert.equal(r.state,'ready');assert.deepEqual(r.snapshot,normalize(snapshot([mark(a,'present'),mark(b,'excused')])));
});
test('Divergence réelle par licencié : choix obligatoire et sans mutation',()=>{
 const base=snapshot([mark(a,'absent')]),local=snapshot([mark(a,'present')]),remote=snapshot([mark(a,'excused'),mark(b,'absent')]);
 const before=JSON.stringify([base,local,remote]),r=merge(base,local,remote);
 assert.equal(r.state,'conflict');assert.equal(r.conflicts.length,1);
 const {key}=r.conflicts[0];assert.equal(key,'calls/'+date+':'+t+'/marks/'+a);
 assert.deepEqual(merge(base,local,remote,{[key]:'local'}).snapshot,normalize(snapshot([mark(a,'present'),mark(b,'absent')])));
 assert.deepEqual(merge(base,local,remote,{[key]:'remote'}).snapshot,normalize(remote));
 assert.equal(JSON.stringify([base,local,remote]),before);
});
test('Identité, suppression et intégrité des références',()=>{
 const base=snapshot([mark(a,'present')]),local=snapshot(),remote=snapshot([mark(a,'excused')]);
 assert.equal(merge(base,local,remote).state,'conflict');
 const duplicate=snapshot([mark(a,'present'),mark(a,'absent')]);assert.throws(()=>normalize(duplicate));
 const bad=snapshot([mark(id(99),'present')]);assert.throws(()=>normalize(bad));
 const duplicateCall=snapshot([mark(a,'present')]);duplicateCall.calls.push(structuredClone(duplicateCall.calls[0]));assert.throws(()=>normalize(duplicateCall));
 const badDate=snapshot([mark(a,'present')]);badDate.calls[0].date='2026-02-31';assert.throws(()=>normalize(badDate));
});
test('Conflit de groupe/licencié et fusion impossible de références',()=>{
 const base=snapshot(),local=structuredClone(base),remote=structuredClone(base);
 local.members[0].active=false;remote.members[0].name='Autre nom';
 assert.equal(merge(base,local,remote).state,'conflict');
 const removed=structuredClone(base);removed.members=removed.members.filter(m=>m.id!==a);
 assert.equal(merge(base,removed,snapshot([mark(a,'present')])).state,'invalid-merge');
});
