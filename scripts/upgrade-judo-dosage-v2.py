#!/usr/bin/env python3
from pathlib import Path
s=Path('index.html').read_text(encoding='utf-8')
def one(a,b,label):
 global s
 n=s.count(a)
 if n!=1: raise RuntimeError(f'{label}: occurrences {n}')
 s=s.replace(a,b,1)
one(r"""    var bloc=valeurChampPedagogique(brut,['dureeBlocMin','durée bloc min','dureeBloc','durée de bloc réaliste']);
    return bloc && Number(bloc.replace(',','.'))>0 ? Math.round(Number(bloc.replace(',','.'))*60) : 0;""",
r"""    // dureeBlocMin correspond au planning, pas au chronomètre de l'exercice.
    return 0;""",'Séparer temps effort et planning')
one("""return [{type:'effort',sec:secondesDosageJudo(e)||Math.round(m*60)||0,reps:'maximum '+e.repetitionsMax+' répétitions',serie:1,series:1,limiteRepetitions:e.repetitionsMax}];""",
"""return [{type:'effort',sec:secondesDosageJudo(e)||0,reps:'maximum '+e.repetitionsMax+' répétitions',serie:1,series:1,limiteRepetitions:e.repetitionsMax}];""",
'chronomètre mixte explicite')
one("""    if (e && (e.public||[]).indexOf('Judo')>=0 && e.modeDosageJudo==='Répétitions' && Number(e.repetitionsMax)>0) {
      return [{type:'effort',sec:0,reps:'maximum '+e.repetitionsMax+' répétitions',serie:1,series:1,limiteRepetitions:e.repetitionsMax}];
    }""",
"""    if (e && (e.public||[]).indexOf('Judo')>=0 && e.modeDosageJudo==='Répétitions') {
      var nombreJudo=repetitionsDoseJudo(e);
      if (d && d.mode==='reps' && Number(e.repetitionsMax)>0) d.reps='maximum '+e.repetitionsMax+' répétitions';
      if ((!d || d.mode==='temps') && nombreJudo>0) {
        var maintien=secondesDosageJudo(e);
        d={mode:'reps',series:1,reps:nombreJudo+' répétitions'+(maintien?' ('+maintien+' s chacune)':''),cote:false,recup:30};
      }
    }""",
'conserver plusieurs séries en répétitions')
one("""(e.dosage ? ' Dosage : ' + e.dosage + '.' : '')""",
"""(e.dosage ? ' Dosage : ' + (espace === 'Judo' ? dosageAfficheJudo(e) : e.dosage) + '.' : '')""",
'indiquer maximum répétitions au PDF')
Path('index.html').write_text(s,encoding='utf-8')
print('Correction V2 : durée planification distincte de la prescription, séries conservées, PDF détaillé.')
