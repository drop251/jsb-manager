'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {hashPassword,verifyPassword,validPassword}=require('../backend/passwords.cjs');
test('Mots de passe : sel aléatoire, vérification correcte et refus des secrets erronés',async()=>{
 const password='Une phrase longue de test !';
 const a=await hashPassword(password),b=await hashPassword(password);
 assert.notEqual(a,b);assert.ok(!a.includes(password));assert.match(a,/^scrypt-v1\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{43}$/);
 assert.equal(await verifyPassword(password,a),true);
 assert.equal(await verifyPassword('Une autre phrase de test !',a),false);
});
test('Mots de passe : longueur bornée et refus des formats invalides',async()=>{
 for(const p of [null,123,'court','a'.repeat(1025)]){assert.equal(validPassword(p),false);await assert.rejects(hashPassword(p),RangeError);assert.equal(await verifyPassword(p,'invalid'),false);}
 const password='Une phrase longue de test !';
 for(const stored of [null,'invalid','scrypt-v2$abc$abc','scrypt-v1$'+ 'a'.repeat(200)+'$abc']) assert.equal(await verifyPassword(password,stored),false);
});
test('Mots de passe : espaces et Unicode conservés sans transformation silencieuse',async()=>{
 const password='  Équilibre et sécurité 🥋  ';
 const stored=await hashPassword(password);
 assert.equal(await verifyPassword(password,stored),true);
 assert.equal(await verifyPassword(password.trim(),stored),false);
 assert.equal(await verifyPassword(password.normalize('NFD'),stored),false);
});
