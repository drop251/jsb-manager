'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
let s=fs.readFileSync('index.html','utf8');
function one(a,b,t){const p=s.indexOf(a);assert(p>=0,t+' absent');assert(s.indexOf(a,p+1)<0,t+' ambigu');s=s.slice(0,p)+b+s.slice(p+a.length);}
one("e.technique = x.technique || familleDe(e.nom, texte);","e.technique = x.technique || x.famille || familleDe(e.nom, texte);","famille technique conservée");
one("var majPeda = !!(ex && valeurChampPedagogique(l, ['description']) && valeurChampPedagogique(l, ['competenceCiblee','compétence ciblée']));",
    "var majPeda = !!(ex && valeurChampPedagogique(l, ['description']) && !seul);","vérifier également les mises à jour incomplètes");
one("if (!/altern|rotation|chang|tourn|invers/.test(normOrg)) erreurs.push('Organisation : préciser l’alternance ou les rotations');",
    "if (/binome|trio|collectif/.test(format) && !/altern|rotation|chang|tourn|invers/.test(normOrg)) erreurs.push('Organisation : préciser l’alternance ou les rotations');",
    "alternance collective adaptée au format");
fs.writeFileSync('index.html',s);
console.log('V4 : famille technique conservée et corrections incomplètes refusées.');
