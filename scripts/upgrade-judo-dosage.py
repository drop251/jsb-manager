#!/usr/bin/env python3
from pathlib import Path
import re
s=Path('index.html').read_text(encoding='utf-8')
def one(a,b,label):
    global s
    n=s.count(a)
    if n != 1: raise RuntimeError(f'{label}: {n} occurences (expected 1)')
    s=s.replace(a,b,1)
methods=Path('scripts/dosage-judo-methods.txt').read_text(encoding='utf-8')
one("  function normaliserRoleJudo(v) {", methods+"\n  function normaliserRoleJudo(v) {", 'Méthodes dosage')

one(r"""    var n = Number(duree.replace(',', '.').replace(/\s*min(?:utes?)?\s*$/i, ''));
    if (!duree || !Number.isFinite(n) || n < 1 || n > 30) erreurs.push('Durée de bloc réaliste : nombre de minutes entre 1 et 30');""",
r"""    var modeBrut = valeurChampPedagogique(brut,['modeDosageJudo','mode de dosage judo','mode de travail judo']);
    var mode=modeDosageJudoDe(brut), reps=repetitionsDoseJudo(brut);
    var secondes=secondesDosageJudo(brut), maxR=maximumRepetitionsJudo(brut);
    var nombreBloc=duree ? Number(duree.replace(',', '.').replace(/\s*min(?:utes?)?\s*$/i, '')) : 0;
    if (duree && (!Number.isFinite(nombreBloc)||nombreBloc<=0||nombreBloc>120)) erreurs.push('Durée du bloc facultative, mais si renseignée elle doit être comprise entre 1 et 120 minutes');
    if (modeBrut&&!normaliserModeDosageJudo(modeBrut)) erreurs.push('Mode de dosage Judo invalide : Répétitions, Durée ou Durée + répétitions max');
    if (!mode) erreurs.push('Dosage Judo illisible : préciser les répétitions ou la durée sans inventer de valeur');
    if (mode==='Répétitions' && (!Number.isFinite(reps)||reps<=0)) erreurs.push('Répétitions : indiquer le nombre dans dosage ou repetitions');
    if (mode==='Durée' && secondes<=0) erreurs.push('Durée : indiquer le temps dans dosage, duree_s ou dureeBlocMin');
    if (mode==='Durée + répétitions max') {
      if (!dosageMixteAutoriseJudo(e.sousGroupes||[])) erreurs.push('Durée + répétitions max : autorisé à partir des Benjamins ; séparer les fiches multi-âges');
      if (secondes<=0) erreurs.push('Mode combiné : indiquer la durée dans dosage ou duree_s');
      if (!Number.isInteger(maxR)||maxR<=0) erreurs.push('Mode combiné : repetitionsMax entier positif obligatoire (maximum par judoka)');
    }
    if (valeurChampPedagogique(brut,['repetitionsMax','répétitions max','maxRepetitions']) && (!Number.isInteger(maxR)||maxR<=0)) erreurs.push('repetitionsMax : entier strictement positif');""",
'Validation conditionnelle Judo')

one(r"""      e.dureeBlocMin = Number(valeurChampPedagogique(brut, ['dureeBlocMin','durée bloc min','dureeBloc','durée de bloc réaliste']).replace(',', '.').replace(/\s*min(?:utes?)?\s*$/i, '')) || 0;""",
r"""      e.dureeBlocMin = Number(valeurChampPedagogique(brut, ['dureeBlocMin','durée bloc min','dureeBloc','durée de bloc réaliste']).replace(',', '.').replace(/\s*min(?:utes?)?\s*$/i, '')) || 0;
      e.modeDosageJudo = modeDosageJudoDe(brut);
      e.repetitionsMax = maximumRepetitionsJudo(brut) || 0;
      e.repetitions = valeurChampPedagogique(brut,['repetitions','répétitions']);
      e.duree_s = Number(valeurChampPedagogique(brut,['duree_s','durée_s'])) || 0;""",
'Conversion import')

one("""['Niveau d’opposition', 'niveauOpposition'], ['Organisation Tori/Uke, rotations et repos', 'organisation'], ['Durée réaliste du bloc (min)', 'dureeBlocMin']];""",
"""['Niveau d’opposition', 'niveauOpposition'], ['Organisation Tori/Uke, rotations et repos', 'organisation'], ['Durée indicative du bloc (min)', 'dureeBlocMin'],
    ['Mode de dosage Judo', 'modeDosageJudo'], ['Maximum de répétitions par judoka', 'repetitionsMax']];""",
'Export champs')

one("""    var d = lireDosage(e && e.dosage), m = parseFloat(x && x.duree), blocs = [];""",
"""    var d = lireDosage(x && x.dosage || e && e.dosage), m = parseFloat(x && x.duree), blocs = [];
    if (e && (e.public||[]).indexOf('Judo')>=0 && e.modeDosageJudo==='Durée + répétitions max' && Number(e.repetitionsMax)>0) {
      return [{type:'effort',sec:secondesDosageJudo(e)||Math.round(m*60)||0,reps:'maximum '+e.repetitionsMax+' répétitions',serie:1,series:1,limiteRepetitions:e.repetitionsMax}];
    }
    if (e && (e.public||[]).indexOf('Judo')>=0 && e.modeDosageJudo==='Répétitions' && Number(e.repetitionsMax)>0) {
      return [{type:'effort',sec:0,reps:'maximum '+e.repetitionsMax+' répétitions',serie:1,series:1,limiteRepetitions:e.repetitionsMax}];
    }""",
'Dosage dans séance en direct')

one("""      if (judo && (e.rolePedagogique || e.competenceCiblee || e.dureeBlocMin)) s += bonusPedagogiqueJudo(e, rep, phasePedagogique);""",
"""      if (judo && (e.rolePedagogique || e.competenceCiblee || e.dureeBlocMin)) s += bonusPedagogiqueJudo(e, rep, phasePedagogique);
      if (judo && rep.modeTravailJudo && (e.modeDosageJudo || modeDosageJudoDe(e))===rep.modeTravailJudo) s += 9;""",
'Pertinence mode de travail')

one("""var tri = melanger(pool.filter(function (e) { return !pris[e.id] && (!judo || !e.rolePedagogique || roleCompatibleJudo(e, phasePedagogique, rep)); }), r)""",
"""var tri = melanger(pool.filter(function (e) { return !pris[e.id] && (!judo || (compatibleDosageJudo(e,rep) && (!e.rolePedagogique || roleCompatibleJudo(e, phasePedagogique, rep)))); }), r)""",
'Filtrage modes')

one("""        } else manques.push(ph[0] + ' : durées des fiches historiques estimées, à confirmer par l’éducateur');""",
"""        } else manques.push(ph[0] + ' : temps de phase indicatif, les répétitions du dosage restent prioritaires');""",
'Message temps indicatif')

one("""      if (!estExerciceJeuneAdapte(e,groupe)) return false;
      if (e.prerequis""",
"""      if (!estExerciceJeuneAdapte(e,groupe) || !compatibleDosageJudo(e,rep)) return false;
      if (e.prerequis""",
'Mode par âge chez les jeunes')

one("""        h('summary', null, 'Critères pédagogiques avancés', h('small', null, 'Compétence, prérequis, opposition, organisation et durée')),""",
"""        h('summary', null, 'Critères pédagogiques avancés', h('small', null, 'Compétence, prérequis, opposition, organisation et dosage')),""",
'Titre panneau')

one("""        choix('cibleDureeBlocMin','Durée cible par bloc (minutes)',['4','5','6','8','10']),""",
"""        choix('modeTravailJudo','Prescription de travail Judo',dosageMixteAutoriseJudo([rep.groupe])?['Répétitions','Durée','Durée + répétitions max']:['Répétitions','Durée']),
        choix('cibleDureeBlocMin','Temps indicatif du bloc (minutes)',['4','5','6','8','10']),""",
'Choix de mode dans le générateur')

one("""        h('p', { className: 'gn-aide' }, 'Les fiches existantes sans ces données restent utilisables, mais les durées sont signalées comme estimées.'));""",
"""        h('p', { className: 'gn-aide' }, 'Une fiche en répétitions ne demande pas de durée de bloc. Dès Benjamins, il est possible de combiner une durée et un maximum de répétitions par judoka. Les minutes de séance restent indicatives.'));""",
'Aide utilisateur')

one("""       if (judo) l = l.filter(function (e) { return !e.rolePedagogique || roleCompatibleJudo(e, ph.nom, rep); });""",
"""       if (judo) l = l.filter(function (e) { return compatibleDosageJudo(e,rep) && (!e.rolePedagogique || roleCompatibleJudo(e, ph.nom, rep)); });""",
'Remplacement sous contrainte')

one("""        ouvert ? h('div', { className: 'gn-exo-fiche' }, h('p', null, sansCesure(x.e.description)), x.e.vigilance""",
"""        ouvert ? h('div', { className: 'gn-exo-fiche' }, h('p', null, sansCesure(x.e.description)),
          judo ? h('p', { className: 'gn-exo-usage' }, 'Dosage : ' + dosageAfficheJudo(x.e) + (x.e.modeDosageJudo==='Répétitions' ? ' · sans chronomètre obligatoire' : '') + ' · Temps indicatif dans la séance : '+x.duree+' min') : null,
          x.e.vigilance""",
'Affichage séparé prescription et planning')

one("""  var VERSION_APP = '04/11/2026 · Éveil Judo ludique et Pré-poussins adaptés';""",
"""  var VERSION_APP = '04/11/2026 · Judo : répétitions, durée, combinaison dès Benjamins';""",
'Version')
Path('index.html').write_text(s,encoding='utf-8')
sw=Path('sw.js').read_text(encoding='utf-8')
sw,n=re.subn(r'jsb-manager-20261104-jsb-jeunes-ludiques-v1', 'jsb-manager-20261104-jsb-repetitions-et-duree-v1',sw)
if n!=1: raise RuntimeError(f'Cache PWA : {n} occurrence(s)')
Path('sw.js').write_text(sw,encoding='utf-8')
print('Correctif dosage Judo : modifications appliquées.')
