'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {creerStockage}=require('../core/stockage-web.js');
test('La fermeture attend une écriture déjà en file puis la lecture rouvre la base',async()=>{
 const events=[], data=new Map(), local=new Map();
 const env={localStorage:{getItem:k=>local.get(k)??null,setItem:(k,v)=>local.set(k,v),removeItem:k=>local.delete(k)},indexedDB:{open(){
  const req={}; queueMicrotask(()=>{events.push('open');req.result={close(){events.push('close');},transaction(){
   const tx={objectStore(){return {put(v,k){const rq={};setImmediate(()=>{events.push('put');data.set(k,v);rq.onsuccess?.();tx.oncomplete();});return rq;},get(k){const rq={};setImmediate(()=>{events.push('get');rq.result=data.get(k);rq.onsuccess?.();tx.oncomplete();});return rq;}};}};return tx;
  }};req.onsuccess();});return req;
 }}};
 const stockage=creerStockage(env);
 const write=stockage.ecrire('seance',{id:1});
 const close=stockage.fermer();
 const read=stockage.lire('seance');
 assert.equal(await write,true);await close;assert.deepEqual(await read,{id:1});
 assert.deepEqual(events,['open','put','close','open','get']);
});
