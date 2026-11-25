/* JSB Manager V32 — moteur taiso, sans DOM ni stockage. Les services métier sont injectés. */
(function (root) {
  'use strict';
  function creerMoteur(deps) {
    var hasard = deps.hasard,
        niveauEffectifTaiso = deps.niveauEffectifTaiso,
        niveauOk = deps.niveauOk,
        estImpact = deps.estImpact,
        okTaiso = deps.okTaiso,
        sg = deps.sg,
        estMobilite = deps.estMobilite,
        illustre = deps.illustre,
        melanger = deps.melanger,
        momentsDe = deps.momentsDe,
        formatsDe = deps.formatsDe,
        formatParDefaut = deps.formatParDefaut,
        construireBlocs = deps.construireBlocs,
        zonesTravaillees = deps.zonesTravaillees,
        cibleZones = deps.cibleZones,
        MOTS_CALME = deps.MOTS_CALME,
        sa = deps.sa,
        repartirDurees = deps.repartirDurees;
  function genererSeanceTaiso(rep, tous, tout, graine) {
    function discipline(e) { return e && e.typeFiche !== 'Technique' && Array.isArray(e.public) && e.public.indexOf('Taïso') >= 0; }
    var r = hasard(graine), minutes = parseInt(rep.duree, 10) || 60, parId = {};
    tout.filter(discipline).forEach(function (e) { parId[e.id] = e; });
    var doux = rep.groupe === 'Gym douce', niveauT = niveauEffectifTaiso(rep);
    function compatible(e) {
      return niveauOk(e, niveauT) && (!doux || (!estImpact(e) && e.accessibilite !== 'Publics entraînés uniquement')) && okTaiso(e, rep);
    }
    var base = tous.filter(discipline).filter(function (e) { return sg(e).indexOf(rep.groupe) >= 0 && compatible(e); });
    var routineIDs = rep.routine || [], routine = routineIDs.map(function (id) { return parId[id]; }).filter(function (e) { return e && estMobilite(e) && compatible(e); });
    var minRoutine = Math.max(5, Math.min(12, routine.length)), reste = Math.max(15, minutes - minRoutine);
    var phases = [['Mobilité', minRoutine], ['Échauffement', Math.round(reste * .14), 4], ['Corps de séance', Math.round(reste * .64), 6],
      ['Retour au calme', Math.max(3, Math.round(reste * (rep.calme === 'Respiration et relaxation' ? .12 : rep.calme === 'Étirements' ? .05 : .08))), 4], ['Étirements', 0, 4]];
    phases[4][1] = Math.max(5, minutes - phases.slice(0, -1).reduce(function (a, p) { return a + p[1]; }, 0));
    phases[2][1] -= phases.reduce(function (a, p) { return a + p[1]; }, 0) - minutes;
    if (phases[2][1] < 1) throw new Error('Durée insuffisante pour les phases choisies');
    var pris = {}, resultat = [], manques = [], eviter = rep.eviter || {};
    if (routine.length < routineIDs.length) manques.push('routine de mobilité : exercices manquants ou incompatibles');
    routine.forEach(function (e) { pris[e.id] = 1; });
    var obj = rep.objectif && rep.objectif.indexOf('Vari') !== 0 ? rep.objectif : '';
    function score(e) {
      var s = r() * 1.5;
      if (eviter[e.id]) s -= 3;
      if (obj && e.categorie === obj) s += 2.5;
      if (rep.illustres && illustre(e)) s += 2.5;
      if (rep.binome && e.format === 'Binôme') s += 2;
      return s;
    }
    function choisir(pool, n, diversifier) {
      var tri = melanger(pool.filter(function (e) { return !pris[e.id]; }), r).map(function (e) { return [score(e), e]; }).sort(function (a, b) { return b[0] - a[0]; }).map(function (x) { return x[1]; });
      var out = [], parCat = {};
      tri.forEach(function (e) {
        if (out.length >= n || (diversifier && (parCat[e.categorie] || 0) >= Math.ceil(n / 2) && e.categorie !== obj)) return;
        out.push(e); parCat[e.categorie] = (parCat[e.categorie] || 0) + 1; pris[e.id] = 1;
      });
      if (out.length < n) tri.forEach(function (e) { if (out.length < n && !pris[e.id]) { out.push(e); pris[e.id] = 1; } });
      return out;
    }
    var mom = function (m) { return function (e) { return momentsDe(e).indexOf(m) >= 0; }; };
    var formatT = rep.format && formatsDe(rep.groupe).indexOf(rep.format) >= 0 ? rep.format : formatParDefaut(rep.groupe);
    var blocsCorps = construireBlocs(formatT, base.filter(mom('Corps de séance')), phases[2][1], doux, choisir, niveauT, { intensite: rep.intensite || 0, participants: rep.participants || 0 });
    var zones = zonesTravaillees(blocsCorps);
    function cible(pool, n) {
      var top = pool.filter(function (e) { return cibleZones(e, zones) > 0; }).sort(function (a, b) { return cibleZones(b, zones) - cibleZones(a, zones); });
      var a = choisir(top.slice(0, Math.max(n * 2, 4)), Math.ceil(n / 2), false);
      return a.concat(choisir(pool, n - a.length, false));
    }
    phases.forEach(function (ph, i) {
      var min = ph[1], ex;
      if (i === 2) {
        var items = [].concat.apply([], blocsCorps.map(function (b) { return b.items; })), occupe = blocsCorps.reduce(function (t, b) { return t + b.minutes; }, 0);
        if (!items.length) manques.push(ph[0]);
        resultat.push({ nom: ph[0], minutes: min, blocs: blocsCorps, format: formatT, niveau: niveauT, transitions: Math.max(0, Math.round(min - occupe)), exercices: items });
        return;
      }
      if (i === 0) { ex = routine; if (!ex.length) manques.push('routine de mobilité (non choisie)'); }
      else {
        var n = Math.max(1, Math.round(min / ph[2])), pool;
        var fin = base.filter(mom('Fin de séance')), calme = function (e) { return MOTS_CALME.test(sa(e.nom + ' ' + e.description)); };
        if (i === 1) {
          pool = base.filter(function (e) { return mom('Échauffement')(e) && !estMobilite(e); });
          n = Math.min(4, Math.max(3, Math.round(min / 2)));
        } else if (i === 3) { pool = fin.filter(calme); if (!pool.length) pool = fin; }
        else { pool = fin.filter(function (e) { return !calme(e); }); if (!pool.length) pool = fin; }
        ex = i === 1 || i === 4 ? cible(pool, n) : choisir(pool, n, false);
        if (ex.length < n) manques.push(ph[0]);
      }
      if (ex.length > min) ex = ex.slice(0, min);
      var durees = repartirDurees(min, ex.length);
      resultat.push({ nom: ph[0], minutes: min, transitions: 0, exercices: ex.map(function (e, k) { return { e: e, duree: durees[k] }; }) });
    });
    return { phases: resultat, manques: manques };
  }
    return { genererSeanceTaiso: genererSeanceTaiso };
  }
  var api = { creerMoteur: creerMoteur };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JSBMoteurTaiso = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
