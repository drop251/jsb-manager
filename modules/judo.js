/* JSB Manager V32 — moteur judo, sans DOM ni stockage. Les services métier sont injectés. */
(function (root) {
  'use strict';
  // V33 : règles pédagogiques Judo indépendantes du DOM.
  function creerPedagogie(deps) {
    var sa = deps.sa, sg = deps.sg, techniqueDe = deps.techniqueDe,
        FAMILLE_DE = deps.FAMILLE_DE, momentsDe = deps.momentsDe,
        estEveilJudo = deps.estEveilJudo, estJeuneJudo = deps.estJeuneJudo;
  function estExerciceJeuneAdapte(e, groupe) {
    if (groupe === 'Éveils (4-5 ans)' && e && /o-soto-gari|o-uchi-gari|ko-uchi-gari|seoi-nage|tai-otoshi|harai-goshi|ippon-seoi-nage|kesa-gatame|yoko-shiho-gatame|tate-shiho-gatame|juji-gatame/.test(sa(e.nom))) return false;
    if (!estJeuneJudo(groupe)) return true;
    if (!e || sg(e).indexOf(groupe) < 0) return false;
    var s = sa([e.nom, e.description, e.thematique, e.technique, e.famille].join(' '));
    var nom = sa(e.nom);
    var techniques = [techniqueDe(e.nom)].map(sa);
    var techniqueFormelle = techniques.some(function (t) { return !!FAMILLE_DE[t]; }) || /o-soto-gari|o-uchi-gari|ko-uchi-gari|seoi-nage|tai-otoshi|harai-goshi|ippon-seoi-nage|kesa-gatame|yoko-shiho-gatame|tate-shiho-gatame/.test(nom);
    var danger = /sutemi|kansetsu|shime|etrangl|juji|sankaku|waki.gatame|cle articulaire|saisie des jambes|projection violente|charge lourde|kettlebell|battle rope|souleve de terre|sprint maximum/;
    if (danger.test(s)) return false;
    if (groupe === 'Pré-poussins') {
      if (e.niveauOpposition === 'Opposition libre' || /randori libre|combat libre/.test(nom)) return false;
      return true;
    }
    // À 4–5 ans : apprentissage par l'exploration motrice, sans techniques formelles ni randori.
    if (techniqueFormelle || /(?:\b|[- ])(?:waza|nage|gatame|osaekomi|ippon|uchi.komi|nage.komi|kumi.kata)\b/.test(s)) return false;
    if (/projection|immobilisation|combat|randori|opposition libre|musculation|renforcement|gainage statique|pompes? |prise de judo/.test(s)) return false;
    if (e.rolePedagogique === 'Opposition' || e.niveauOpposition === 'Opposition dirigée' || e.niveauOpposition === 'Opposition libre') return false;
    return /jeu|ludique|parcours|motric|equilibr|coordina|deplac|marche|roul|ramper|grimper|saut|animal|imitation|mimer|relever|explor|cooper|partenair|entraide|salut|respir|relax|calme|appui|orientation|adresse|prehension|poursuite|saisir/.test(s);
  }
  function convientPhaseJeune(e, nomPhase, groupe) {
    if (!estExerciceJeuneAdapte(e, groupe)) return false;
    var s = sa([e.nom,e.thematique,e.description,e.competenceCiblee,e.rolePedagogique].join(' '));
    var m = momentsDe(e), fin = m.indexOf('Fin de séance') >= 0;
    var aDeux = e.format === 'Binôme' || e.format === 'Collectif' || e.format === 'Trio';
    if (nomPhase === 'Retour au calme') return fin && /calme|respir|relax|repos|doux|salut|detente|jeu calme/.test(s);
    if (fin) return false;
    if (estEveilJudo(groupe)) {
      if (nomPhase === 'Jeux moteurs') return /jeu|animal|imitation|deplac|march|equilibr|coordina|saut|ramper|roul|motric/.test(s) && !/opposition|combat/.test(s);
      if (nomPhase === 'Parcours moteurs') return /parcours|atelier|equilibr|franchis|obstacle|explor|ramper|roul|relever|appui|orientation|adresse/.test(s) && !/combat/.test(s);
      if (nomPhase === 'Jeux coopératifs') return aDeux && /jeu|cooper|entraide|partenair|collectif|transport|ensemble|binome|partage/.test(s) && !/opposition|combat/.test(s);
      return false;
    }
    if (nomPhase === 'Jeux moteurs') return /jeu|animal|motric|equilibr|deplac|coordina|roul|chute|appui/.test(s) && !/randori|opposition/.test(s);
    if (nomPhase === 'Bases du Judo') return m.indexOf('Corps de séance') >= 0 && e.rolePedagogique !== 'Opposition' && e.niveauOpposition !== 'Opposition dirigée';
    if (nomPhase === 'Opposition éducative') {
      return aDeux && m.indexOf('Corps de séance') >= 0 &&
        (e.niveauOpposition === 'Opposition dirigée' || /jeu d.opposition|opposition educative|randori educatif/.test(s)) &&
        e.niveauOpposition !== 'Opposition libre';
    }
    return false;
  }
  function scoreObjectifJeune(e, objectif) {
    var o = sa(objectif), s = sa([e.nom,e.thematique,e.description,e.competenceCiblee].join(' '));
    var motifs = [
      [/equilibr|deplac/, /equilibr|deplac|appui|orient|marche/],
      [/coordina|motric/, /coordina|motric|animal|imitation|saut|ramper|parcours/],
      [/roul|chute/, /roul|chute|ukemi|relever|sol/],
      [/cooper|partage|deux/, /cooper|partag|entraide|ensemble|binome|partenair/],
      [/contact|saisie/, /contact|saisie|prehension|partenair|toucher/],
      [/dojo|regle/, /dojo|salut|regle|respect|orientation/],
      [/travail au sol/, /sol|quadrupedie|roul|retournement/],
      [/opposition/, /opposition|jeu de lutte|randori educatif/]
    ];
    for (var i=0;i<motifs.length;i++) if (motifs[i][0].test(o)) return motifs[i][1].test(s) ? 12 : 0;
    return 0;
  }
  function scoreObjectifJudo(e, objectif) {
    var nom = sa(e.nom), theme = sa(e.thematique), technique = sa(e.technique);
    var identite = [nom, theme, technique].join(' ');
    var texte = identite + ' ' + sa(e.description);
    if (objectif === 'Découverte et initiation') {
      return /ukemi|chute|decouv|initiation|ludique|\bjeu\b|\bjeux\b|salut|fondamentaux|placement de base/.test(texte) ? 6 : 0;
    }
    if (objectif === 'Apprentissage technique') {
      return /uchi.?komi|nage.?komi|apprentissage|technique|projection|entree/.test(texte) ? 6 :
        (technique && technique !== 'preparation physique generale' ? 4 : 0);
    }
    if (objectif === 'Perfectionnement technique') {
      return /uchi.?komi|nage.?komi|repetition|precision|maitrise|perfectionnement|tsukuri|forme de corps|placement/.test(texte) ? 6 : 0;
    }
    if (objectif === 'Déplacements et déséquilibres') {
      return /shintai|tai.?sabaki|kuzushi|deplacement|desequilibr|tsugi.?ashi|ayumi.?ashi|pivot|creation d.angle|appui/.test(texte) ? 7 : 0;
    }
    if (objectif === 'Enchaînements et combinaisons') {
      return /renraku|encha(i|î)nement|combinaison|liaison|encha(i|î)ner|\bpuis\b|attaque successive/.test(texte) ? 7 : 0;
    }
    if (objectif === 'Défense et contre-attaques') {
      return /kaeshi|gaeshi|contre.?attaque|contre.?prise|defense|esquive|evitement|reaction a l.attaque/.test(texte) ? 7 : 0;
    }
    if (objectif === 'Travail au sol — Ne-waza') {
      return /ne.?waza|osaekomi|kansetsu|shime.?waza|gatame|jime|immobilis|retournement|passage de garde|quadrupedie|\bsol\b/.test(identite) ||
        /retournement|immobilis|passage de garde|sortie d.immobilisation/.test(sa(e.description)) ? 8 : 0;
    }
    if (objectif === 'Opposition et randori') {
      return /randori|kakari|shiai|opposition|combat|situation d.opposition|mise en situation/.test(texte) ? 7 : 0;
    }
    return 0;
  }
    return { estExerciceJeuneAdapte: estExerciceJeuneAdapte, convientPhaseJeune: convientPhaseJeune, scoreObjectifJeune: scoreObjectifJeune, scoreObjectifJudo: scoreObjectifJudo };
  }
  function creerMoteur(deps) {
    var hasard = deps.hasard,
        melanger = deps.melanger,
        MATERIEL_JUDO = deps.MATERIEL_JUDO,
        sg = deps.sg,
        estMobilite = deps.estMobilite,
        scoreObjectifJudo = deps.scoreObjectifJudo,
        momentsDe = deps.momentsDe,
        sa = deps.sa,
        techniqueDe = deps.techniqueDe,
        bonusPedagogiqueJudo = deps.bonusPedagogiqueJudo,
        modeDosageJudoDe = deps.modeDosageJudoDe,
        illustre = deps.illustre,
        compatibleDosageJudo = deps.compatibleDosageJudo,
        roleCompatibleJudo = deps.roleCompatibleJudo,
        MOTS_CALME = deps.MOTS_CALME,
        MOTS_RANDORI = deps.MOTS_RANDORI,
        repartirDurees = deps.repartirDurees,
        phasesDe = deps.phasesDe,
        estEveilJudo = deps.estEveilJudo,
        estJeuneJudo = deps.estJeuneJudo,
        estExerciceJeuneAdapte = deps.estExerciceJeuneAdapte,
        convientPhaseJeune = deps.convientPhaseJeune,
        scoreObjectifJeune = deps.scoreObjectifJeune;
  function genererSeanceJeunes(rep, tous, tout, graine) {
    tous = tous.filter(function (e) { return e.typeFiche !== 'Technique'; });
    tout = tout.filter(function (e) { return e.typeFiche !== 'Technique'; });
    var groupe = rep.groupe, eveil = estEveilJudo(groupe);
    if (!estJeuneJudo(groupe)) throw new Error('Groupe jeunes invalide');
    var minutes = parseInt(rep.duree,10) || 45;
    if (minutes < 20 || minutes > 120) throw new Error('Durée de séance hors limites pratiques (20 à 120 min)');
    var ph = phasesDe('Judo', groupe), poids = eveil ? [0.11,0.22,0.34,0.22,0.11] : [0.10,0.20,0.40,0.20,0.10];
    var portions = poids.map(function (p) { return Math.floor(minutes*p); });
    var aRepartir = minutes - portions.reduce(function (a,b) { return a+b; },0);
    for (var k=0;k<aRepartir;k++) portions[[2,1,3,0,4][k % 5]]++;
    var repl = eveil ? [
      'Accueil individuel, jeu libre surveillé, salut collectif et rappel d’une règle simple.',
      'Jeux d’imitation et de locomotion : une consigne courte à la fois, valoriser toutes les réussites.',
      'Parcours d’exploration : équilibre, rouler, ramper et se relever. Prévoir une pause boisson.',
      'Jeux à deux majoritairement coopératifs, sans projection ni combat. Prévoir une pause boisson.',
      'Retour au calme, expression des enfants et salut final. Aucun étirement forcé.'
    ] : [
      'Accueil, salut, mobilité et rappel des règles de sécurité.',
      'Jeux d’équilibre, déplacements et réactions. Alterner les situations courtes.',
      'Apprentissages fondamentaux : roulades et chutes adaptées, déplacements, travail au sol ou saisies selon l’objectif. Prévoir une pause boisson.',
      'Oppositions éducatives sous consignes : départ défini, Tori/Uke, arrêt immédiat, changements réguliers. Prévoir une pause boisson.',
      'Retour au calme, retour sur les réussites et salut final.'
    ];
    var candidats = tous.filter(function (e) {
      if (!estExerciceJeuneAdapte(e,groupe) || !compatibleDosageJudo(e,rep)) return false;
      if (e.prerequis && !/^(aucun|sans|néant|neant)$/i.test(String(e.prerequis).trim())) {
        var acquis = sa(rep.prerequisAcquis || '');
        if (!acquis || acquis.indexOf(sa(e.prerequis)) < 0) return false;
      }
      var equip = (e.equipement || '').split(' + ').filter(Boolean);
      return equip.every(function (m) { return ['Tatami','Judogi','Partenaire','Poids du corps'].concat(MATERIEL_JUDO).indexOf(m)>=0; });
    });
    var r = hasard(graine || 1), pris = {}, resultat=[], manques=[];
    if (eveil && minutes > 45) manques.push('Éveil Judo : prévoir plusieurs changements de jeu et pauses si la durée dépasse 45 min');
    if (!candidats.length) manques.push('Aucun exercice ludique compatible trouvé pour ' + groupe + ' : enrichir le catalogue');
    ph.forEach(function (nom,i) {
      var nb = portions[i], pause = (i===2 || i===3) && minutes>=35 ? 1 : 0;
      var reserve = i===0 ? nb : i===4 ? Math.min(3,nb) : 1 + pause;
      var pool = candidats.filter(function (e) { return !pris[e.id] && convientPhaseJeune(e,nom,groupe); });
      pool.sort(function (a,b) {
        var sc = function (e) { return scoreObjectifJeune(e,rep.objectif) + (e.rolePedagogique ? 3 : 0) + (e.dureeBlocMin ? 2 : 0) - ((rep.eviter||{})[e.id] ? 6:0); };
        return sc(b) - sc(a) || r() - 0.5;
      });
      var nombre = (i===0 ? 0 : i===4 ? 1 : Math.min(3,Math.max(1,Math.floor((nb-reserve)/4))));
      var selection = pool.slice(0,nombre), dispo=Math.max(0,nb-reserve);
      var durees = [], temps=0;
      selection.forEach(function (e) {
        var cible = Number(e.dureeBlocMin) || (eveil ? 4 : 6);
        var v = Math.min(eveil ? 5 : 8,Math.max(1,Math.round(cible)),Math.max(0,dispo-temps));
        if (v>0) { durees.push(v); temps+=v; pris[e.id]=1; }
      });
      selection = selection.slice(0,durees.length);
      var transitions = nb-temps;
      if (!selection.length && i!==0 && i!==4) manques.push(nom + ' : aucune situation suffisamment adaptée dans le catalogue');
      if (selection.length && transitions > Math.max(4,Math.round(nb*0.4)) && i!==4) manques.push(nom + ' : ' + transitions + ' min à organiser ou compléter avec d’autres situations');
      resultat.push({nom:nom, minutes:nb, transitions:transitions, repere:repl[i],
        exercices: selection.map(function (e,j) { return {e:e,duree:durees[j]}; })});
    });
    return {phases:resultat,manques:manques,jeunes:true};
  }
  function genererSeanceJudo(rep, tous, tout, graine) {
    function discipline(e) { return e && e.typeFiche !== 'Technique' && Array.isArray(e.public) && e.public.indexOf('Judo') >= 0; }
    tous = tous.filter(discipline);
    tout = tout.filter(discipline);
    if (rep.groupe === 'Éveils (4-5 ans)' || rep.groupe === 'Pré-poussins') return genererSeanceJeunes(rep,tous,tout,graine);
    var r = hasard(graine), minutes = parseInt(rep.duree, 10) || 60, parId = {};
    tout.forEach(function (e) { parId[e.id] = e; });
    var autorise = ['Tatami', 'Judogi', 'Partenaire', 'Poids du corps'].concat(MATERIEL_JUDO);
    var base = tous.filter(function (e) {
      if (sg(e).indexOf(rep.groupe) < 0) return false;
      var eq = (e.equipement || '').split(' + ').filter(Boolean);
      return eq.every(function (x) { return autorise.indexOf(x) >= 0; });
    });
    var routineIDs = rep.routine || [];
    var routine = routineIDs.map(function (id) { return parId[id]; }).filter(function (e) {
      return !!e && estMobilite(e) && (e.equipement || '').split(' + ').filter(Boolean).every(function (m) { return autorise.indexOf(m) >= 0; });
    });
    var minRoutine = Math.max(5, Math.min(12, routine.length));
    var reste = Math.max(15, minutes - minRoutine);
    var phases = [['Mobilité', minRoutine], ['Échauffement', Math.round(reste * .18), 5], ['Corps de séance', Math.round(reste * .47), 7], ['Randori', Math.round(reste * .23), 10], ['Étirement', 0, 4]];
    phases[phases.length - 1][1] = Math.max(5, minutes - phases.slice(0, -1).reduce(function (a, p) { return a + p[1]; }, 0));
    // Les arrondis et la durée minimale de fin de séance ne doivent pas allonger le cours.
    var ecartMinutes = phases.reduce(function (a, p) { return a + p[1]; }, 0) - minutes;
    if (ecartMinutes) phases[2][1] -= ecartMinutes;
    if (phases[2][1] < 1) throw new Error('Durée insuffisante pour les phases choisies');
    var pris = {}, resultat = [], manques = [];
    if (routine.length < routineIDs.length) manques.push('routine de mobilité : exercices manquants ou incompatibles');
    routine.forEach(function (e) { pris[e.id] = 1; });
    var obj = rep.objectif && rep.objectif.indexOf('Vari') !== 0 ? rep.objectif : '';
    if (obj && !base.some(function (e) { return momentsDe(e).indexOf('Corps de séance') >= 0 && scoreObjectifJudo(e, obj) > 0; })) manques.push('objectif « ' + obj + ' » : aucun exercice ciblé dans ce groupe');
    var eviter = rep.eviter || {};
    var phasePedagogique = '';
    function score(e) {
      var s = r() * 1.5;
      if (eviter[e.id]) s -= 3;   // déjà fait ces 14 derniers jours : proposé seulement s'il manque d'autres exercices
      if (rep.technique && sa(techniqueDe(e.nom)) === sa(rep.technique)) s += 6;
      else if (rep.technique && sa(e.nom).indexOf(sa(rep.technique)) >= 0) s += 4;
      if (rep.famille && rep.famille !== 'Variée' && e.technique === rep.famille) s += 3;
      if (obj) s += scoreObjectifJudo(e, obj);
      if ((e.rolePedagogique || e.competenceCiblee || e.dureeBlocMin)) s += bonusPedagogiqueJudo(e, rep, phasePedagogique);
      if (rep.modeTravailJudo && (e.modeDosageJudo || modeDosageJudoDe(e))===rep.modeTravailJudo) s += 9;
      if (rep.illustres && illustre(e)) s += 2.5;
      if (rep.binome && e.format === 'Binôme') s += 2;   // travail à deux demandé : exercices en binôme d'abord   // exercices avec photo ou vidéo d'abord
      return s;
    }
    function choisir(pool, n, diversifier) {
      var tri = melanger(pool.filter(function (e) { return !pris[e.id] && compatibleDosageJudo(e,rep) && (!e.rolePedagogique || roleCompatibleJudo(e, phasePedagogique, rep)); }), r).map(function (e) { return [score(e), e]; }).sort(function (a, b) { return b[0] - a[0]; }).map(function (x) { return x[1]; });
      var out = [], parCat = {};
      tri.forEach(function (e) {
        if (out.length >= n) return;
        if (diversifier && (parCat[e.categorie] || 0) >= Math.ceil(n / 2) && !(obj && scoreObjectifJudo(e, obj) > 0) && e.categorie !== obj && !(rep.technique && sa(e.nom).indexOf(sa(rep.technique)) >= 0)) return;
        out.push(e); parCat[e.categorie] = (parCat[e.categorie] || 0) + 1; pris[e.id] = 1;
      });
      if (out.length < n) tri.forEach(function (e) { if (out.length < n && !pris[e.id]) { out.push(e); pris[e.id] = 1; } });
      return out;
    }
    var mom = function (m) { return function (e) { return momentsDe(e).indexOf(m) >= 0; }; };
    function poolCalme() {
      var fin = base.filter(mom('Fin de séance'));
      if (rep.calme === 'Respiration et relaxation') { var c = fin.filter(function (e) { return MOTS_CALME.test(sa(e.nom + ' ' + e.description)); }); return c.length ? c : fin; }
      if (rep.calme === 'Étirements') { var t = fin.filter(function (e) { return !MOTS_CALME.test(sa(e.nom)); }); return t.length ? t : fin; }
      return fin;
    }
    phases.forEach(function (ph, i) {
      phasePedagogique = ph[0];
      var min = ph[1], ex;
      if (i === 0) { ex = routine; if (!ex.length) manques.push('routine de mobilité (non choisie)'); }
      else {
        var dernier = i === phases.length - 1, n = Math.max(dernier && rep.calme === 'Les deux' ? 2 : 1, Math.round(min / ph[2])), pool;
        if (rep.cibleDureeBlocMin && (ph[0] === 'Corps de séance' || ph[0] === 'Randori')) n = Math.min(6, Math.max(1, Math.round(min / Number(rep.cibleDureeBlocMin))));
        if (dernier) pool = poolCalme();
        else if (i === 1) { pool = base.filter(function (e) { return mom('Échauffement')(e) && !estMobilite(e); }); if (!pool.length) pool = base.filter(mom('Échauffement')); }
        else if (i === 3) {
          pool = base.filter(function (e) { return mom('Corps de séance')(e) && !pris[e.id] && (e.rolePedagogique === 'Opposition' || (e.niveauOpposition && /Opposition dirigée|Opposition libre/.test(e.niveauOpposition)) || MOTS_RANDORI.test(sa(e.nom + ' ' + e.thematique))); });
          if (!pool.length) manques.push('Randori : aucun exercice d’opposition adapté, aucune substitution cardio automatique');
        }
        else pool = base.filter(mom('Corps de séance'));
        if (dernier && rep.calme === 'Les deux' && n >= 2) {
          var calmes = choisir(pool.filter(function (e) { return MOTS_CALME.test(sa(e.nom + ' ' + e.description)); }), 1, false);
          ex = calmes.concat(choisir(pool, n - calmes.length, false));
        } else ex = choisir(pool, n, ph[0] === 'Corps de séance' || ph[0] === 'Randori');
        if (ex.length < n) manques.push(ph[0]);
      }
      if (ex.length > min) ex = ex.slice(0, min);
      var durees = repartirDurees(min, ex.length), transitionsPedagogiques = 0;
      if (i > 0 && ex.length) {
        if (ex.every(function (e) { return Number(e.dureeBlocMin) > 0; })) {
          var prevues = ex.map(function (e) { return Math.round(Number(e.dureeBlocMin)); });
          var somme = prevues.reduce(function (a,b) { return a + b; },0);
          if (somme <= min) { durees = prevues; transitionsPedagogiques = min - somme;
            if (transitionsPedagogiques > Math.max(3, Math.round(min * 0.2))) manques.push(ph[0] + ' : ' + transitionsPedagogiques + ' min non décrites (transitions ou rotations à préciser)');
          } else manques.push(ph[0] + ' : dosage des blocs dépasse le temps disponible ; répartition indicative');
        } else manques.push(ph[0] + ' : temps de phase indicatif, les répétitions du dosage restent prioritaires');
      }
      resultat.push({ nom: ph[0], minutes: min, transitions: transitionsPedagogiques, exercices: ex.map(function (e, k) { return { e: e, duree: durees[k] }; }) });
    });
    if (typeof phasesDe === 'function') { var labelsAge = phasesDe('Judo',rep.groupe); resultat.forEach(function (p,i) { p.libelle = labelsAge[i] || p.nom; }); }
    return { phases: resultat, manques: manques };
  }
    return { genererSeanceJeunes: genererSeanceJeunes, genererSeanceJudo: genererSeanceJudo };
  }
  var api = { creerMoteur: creerMoteur, creerPedagogie: creerPedagogie };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JSBMoteurJudo = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
