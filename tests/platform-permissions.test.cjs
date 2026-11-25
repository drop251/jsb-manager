'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {authorize}=require('../core/platform-permissions.cjs');
const actor=(role,id=role,clubIds=[])=>({role,id,clubIds,authenticated:true,status:'active'});
const admin=actor('admin'),coach=actor('coach','coach-a',['club-a']),individual=actor('individual','person-a');
test('administrateur: gestion plateforme, aucune donnée de club ou privée',()=>{
 for(const [r,a] of [['catalogue','import'],['platformAccounts','suspend'],['aggregateStats','read'],['legal','publish'],['generatorTest','run']]) assert.equal(authorize(admin,r,a),true);
 for(const r of ['clubMembers','attendance','clubReports','clubPlanning','privateSessions','privateBackups','legalAcceptance']) for(const a of ['read','write','delete','export']) assert.equal(authorize(admin,r,a,{clubId:'club-a',ownerId:'admin'}),false);
 assert.equal(authorize(admin,'generator','run',{ownerId:'admin'}),false);
});
test('coach: ressources club autorisé uniquement',()=>{
 for(const r of ['clubMembers','attendance','clubReports','clubPlanning']){
  assert.equal(authorize(coach,r,'read',{clubId:'club-a'}),true);
  for(const scope of [undefined,{}, {clubId:'club-b'}, {clubId:''}]) assert.equal(authorize(coach,r,'read',scope),false);
 }
 assert.equal(authorize(coach,'clubReports','write',{clubId:'club-a'}),false);
});
test('utilisateurs: accès personnel et aucune commande de plateforme',()=>{
 for(const u of [coach,individual]){
  for(const r of ['privateSessions','privateBackups','legalAcceptance']){
   assert.equal(authorize(u,r,'read',{ownerId:u.id}),true);
   assert.equal(authorize(u,r,'read',{ownerId:'someone-else'}),false);
   assert.equal(authorize(u,r,'read'),false);
  }
  assert.equal(authorize(u,'catalogue','read'),true);
  assert.equal(authorize(u,'legal','read'),true);
  for(const [r,a] of [['catalogue','write'],['catalogue','delete'],['platformAccounts','read'],['aggregateStats','read'],['legal','publish'],['generatorTest','run']]) assert.equal(authorize(u,r,a),false);
 }
 for(const r of ['clubMembers','attendance','clubReports','clubPlanning']) assert.equal(authorize(individual,r,'read',{clubId:'club-a'}),false);
});
test('refus par défaut: identités absentes, inactives, rôles et opérations inconnus',()=>{
 for(const u of [null,{}, {...admin,authenticated:false},{...admin,status:'suspended'},{...admin,id:''},{...admin,role:'superadmin'},{...admin,role:'__proto__'}]) assert.equal(authorize(u,'catalogue','read'),false);
 assert.equal(authorize(admin,'constructor','read'),false);
 assert.equal(authorize(admin,'catalogue','export'),false);
 assert.equal(authorize(admin,'unknown','read'),false);
});

test('Coach : refus des opérations inter-clubs, y compris modification et suppression',()=>{
 for(const r of ['clubMembers','attendance','clubPlanning']) for(const a of ['read','write','delete']){
  assert.equal(authorize(coach,r,a,{clubId:'club-a'}),true);
  assert.equal(authorize(coach,r,a,{clubId:'club-b'}),false);
  assert.equal(authorize(coach,r,a),false);
 }
 assert.equal(authorize({...coach,clubIds:[]},'attendance','read',{clubId:'club-a'}),false);
});
test('Particulier : aucune opération club même avec une appartenance déclarée',()=>{
 const p={...individual,clubIds:['club-a']};
 for(const r of ['clubMembers','attendance','clubReports','clubPlanning']) for(const a of ['read','write','delete','export'])
  assert.equal(authorize(p,r,a,{clubId:'club-a'}),false);
});
test('Coach et particulier : isolation mutuelle des séances, sauvegardes et acceptations',()=>{
 for(const [u,other] of [[coach,individual],[individual,coach]]) for(const r of ['privateSessions','privateBackups','legalAcceptance']) for(const a of ['read','write','delete'])
  assert.equal(authorize(u,r,a,{ownerId:other.id}),false);
});
test('Coach et particulier : comptes inactifs et sessions non authentifiées refusés',()=>{
 for(const u of [coach,individual]) for(const patch of [{status:'suspended'},{status:'pending'},{status:'deleted'},{authenticated:false},{id:''}]){
  const invalid={...u,...patch};
  assert.equal(authorize(invalid,'catalogue','read'),false);
  assert.equal(authorize(invalid,'generator','run',{ownerId:u.id}),false);
  assert.equal(authorize(invalid,'privateBackups','read',{ownerId:u.id}),false);
  assert.equal(authorize(invalid,'attendance','read',{clubId:'club-a'}),false);
 }
});
test('Grand public : accès aux fonctions usuelles sans privilèges administrateur',()=>{
 for(const u of [coach,individual]){
  assert.equal(authorize(u,'generator','run',{ownerId:u.id}),true);
  assert.equal(authorize(u,'generator','run',{ownerId:'autre'}),false);
  for(const r of ['platformAccounts','aggregateStats','generatorTest']) for(const a of ['read','write','delete','suspend','reactivate','run','export'])
   assert.equal(authorize(u,r,a),false);
  for(const a of ['write','import','delete']) assert.equal(authorize(u,'catalogue',a),false);
  for(const a of ['draft','publish']) assert.equal(authorize(u,'legal',a),false);
 }
});
