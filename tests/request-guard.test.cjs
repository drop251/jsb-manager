'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createRequestGuard}=require('../backend/request-guard.cjs');
const users=new Map([
 ['admin-token',{id:'admin',role:'admin',status:'active',authenticated:true}],
 ['coach-token',{id:'coach-a',role:'coach',status:'active',authenticated:true,clubIds:['club-a']}],
 ['person-token',{id:'person-a',role:'individual',status:'active',authenticated:true}],
 ['suspended-token',{id:'coach-b',role:'coach',status:'suspended',authenticated:true,clubIds:['club-b']}]
]);
const scopes=new Map([['attendance:entry-a',{clubId:'club-a'}],['attendance:entry-b',{clubId:'club-b'}],['privateSessions:session-a',{ownerId:'coach-a'}],['privateSessions:session-b',{ownerId:'person-a'}],['privateBackups:backup-b',{ownerId:'person-a'}]]);
const guard=createRequestGuard({resolveSession:async token=>users.get(token),resolveScope:async(r,id)=>scopes.get(r+':'+id)});
const call=(sessionToken,resource,action,resourceId,extra={})=>guard({sessionToken,route:{resource,action},resourceId,...extra});
test('requête directe: identité et rôle proviennent de la session serveur',async()=>{
 assert.equal((await call('person-token','platformAccounts','read',null,{actor:users.get('admin-token'),role:'admin'})).status,403);
 assert.equal((await call('admin-token','platformAccounts','read')).ok,true);
 for(const token of [undefined,'','unknown','suspended-token']) assert.equal((await call(token,'catalogue','read')).status,401);
});
test('coach: accès au club autorisé, refus inter-club même avec périmètre falsifié',async()=>{
 assert.equal((await call('coach-token','attendance','read','entry-a')).ok,true);
 for(const action of ['read','write','delete']) assert.equal((await call('coach-token','attendance',action,'entry-b',{scope:{clubId:'club-a'},clubId:'club-a'})).status,403);
 assert.equal((await call('coach-token','attendance','read','missing')).status,403);
});
test('particulier: séances et sauvegardes propres uniquement',async()=>{
 assert.equal((await call('person-token','privateSessions','read','session-b')).ok,true);
 for(const action of ['read','write','delete']) assert.equal((await call('person-token','privateSessions',action,'session-a',{ownerId:'person-a'})).status,403);
 assert.equal((await call('person-token','privateBackups','read','backup-b')).ok,true);
 assert.equal((await call('coach-token','privateBackups','read','backup-b')).status,403);
 assert.equal((await call('person-token','attendance','read','entry-a')).status,403);
});
test('administrateur: refus des ressources club et privées',async()=>{
 for(const [r,id] of [['attendance','entry-a'],['privateSessions','session-a'],['privateBackups','backup-b']]) assert.equal((await call('admin-token',r,'read',id)).status,403);
});
test('indisponibilité des adaptateurs: échec fermé sans divulgation',async()=>{
 assert.throws(()=>createRequestGuard({}),TypeError);
 const broken=createRequestGuard({resolveSession:async()=>{throw Error('secret');},resolveScope:async()=>null});
 assert.deepEqual(await broken({sessionToken:'token',route:{resource:'catalogue',action:'read'}}),{ok:false,status:503});
 const unavailable=createRequestGuard({resolveSession:async()=>users.get('coach-token'),resolveScope:async()=>{throw Error('secret');}});
 assert.deepEqual(await unavailable({sessionToken:'token',route:{resource:'attendance',action:'read'},resourceId:'entry-a'}),{ok:false,status:503});
});
