#!/usr/bin/env python3
from pathlib import Path
p=Path('index.html')
s=p.read_text(encoding='utf-8')
a="""    var tm = reste.match(/(\\d+)(?:\\s*à\\s*(\\d+))?\\s*(s|sec|secondes?|min|minutes?)\\b/);"""
b="""    // La récupération n'est jamais la durée de l'effort. Ex. 3 × 6 répétitions, récup 30 s.
    var tm = reste.split(/r[ée]cup(?:[ée]ration)?|repos\\b|pause\\b/i)[0].match(/(\\d+)(?:\\s*à\\s*(\\d+))?\\s*(s|sec|secondes?|min|minutes?)\\b/);"""
if s.count(a)!=1: raise RuntimeError('Interprétation du repos: '+str(s.count(a))+' occurrence(s)')
s=s.replace(a,b,1)
p.write_text(s,encoding='utf-8')
print('Le récup ne détermine plus le mode : répétitions conservées.')
