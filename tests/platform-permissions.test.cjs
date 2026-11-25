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
