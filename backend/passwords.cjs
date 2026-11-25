'use strict';
const {randomBytes,scrypt,timingSafeEqual}=require('node:crypto');
const {promisify}=require('node:util');
const derive=promisify(scrypt);
// Paramètres fixes et bornés. Pas de paramètres de calcul dictés par le client.
const N=32768,r=8,p=3,keyLength=32,maxmem=64*1024*1024;
const PREFIX='scrypt-v1';
const validPassword=value=>typeof value==='string'&&Buffer.byteLength(value,'utf8')<=1024&&Array.from(value).length>=12;
const validEncoding=value=>typeof value==='string'&&/^[A-Za-z0-9_-]+$/.test(value);
async function calculate(password,salt){return derive(password,salt,keyLength,{N,r,p,maxmem});}
async function hashPassword(password){
 if(!validPassword(password))throw new RangeError('Mot de passe invalide');
 const salt=randomBytes(16);
 const key=await calculate(password,salt);
 return [PREFIX,salt.toString('base64url'),key.toString('base64url')].join('$');
}
function parse(stored){
 if(typeof stored!=='string'||stored.length>100)return null;
 const parts=stored.split('$');
 if(parts.length!==3||parts[0]!==PREFIX||!validEncoding(parts[1])||!validEncoding(parts[2]))return null;
 const salt=Buffer.from(parts[1],'base64url'),key=Buffer.from(parts[2],'base64url');
 if(salt.length!==16||key.length!==keyLength||salt.toString('base64url')!==parts[1]||key.toString('base64url')!==parts[2])return null;
 return {salt,key};
}
// Un appelant doit appliquer limitation des tentatives et contrôle de concurrence
// avant le calcul. Pour un compte absent, utiliser le chemin de comparaison factice.
async function verifyPassword(password,stored){
 if(!validPassword(password))return false;
 const parsed=parse(stored);
 const salt=parsed?parsed.salt:Buffer.alloc(16);
 const expected=parsed?parsed.key:Buffer.alloc(keyLength);
 const actual=await calculate(password,salt);
 const match=timingSafeEqual(actual,expected);
 return Boolean(parsed&&match);
}
module.exports=Object.freeze({hashPassword,verifyPassword,validPassword});
