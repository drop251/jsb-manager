/* JSB Manager V33a — règles métier de la gestion du club.
 * Catégories, affectation aux cours, bilans et suivi des absences.
 * Aucune dépendance DOM, React ou stockage. Politique d'âge existante conservée.
 */
(function (root) {
  'use strict';
  function creerService(deps) {
    var CATEGORIES = deps.CATEGORIES, COURS_ADULTES = deps.COURS_ADULTES, COURS_TAISO = deps.COURS_TAISO;
    var Date = deps.Date || root.Date, aujourdhui = deps.aujourdhui;
  function debutSaison() { var d = new Date(); return d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; }
  function catDe(j) {
    if (j.naissance) {
      var age = debutSaison() - parseInt(j.naissance.slice(0, 4), 10);
      for (var i = 0; i < CATEGORIES.length; i++) if (age >= CATEGORIES[i][1] && age <= CATEGORIES[i][2]) return CATEGORIES[i][0];
    }
    return j.groupe || 'Sans catégorie';
  }
  function coursDe(j) { var c = catDe(j); return ['Minimes', 'Cadets', 'Juniors', 'Seniors'].indexOf(c) >= 0 ? COURS_ADULTES : c; }
  function ageDe(j) { return j.naissance ? debutSaison() - parseInt(j.naissance.slice(0, 4), 10) : null; }
  function peutTaiso(j) { var a = ageDe(j); return a == null || a >= 13; }
  function coursListe(j) {
    var act = peutTaiso(j) ? (j.activite || 'judo') : 'judo';
    return act === 'taiso' ? [COURS_TAISO] : act === 'les deux' ? [coursDe(j), COURS_TAISO] : [coursDe(j)];
  }
  function rangCat(c) { if (c === COURS_TAISO) return 6; if (c === COURS_ADULTES) return 5; for (var i = 0; i < CATEGORIES.length; i++) if (CATEGORIES[i][0] === c) return i; return 99; }
  function triCat(a, b) { return rangCat(a) - rangCat(b) || a.localeCompare(b, 'fr'); }
  function anneesCat(c) {
    if (c === COURS_ADULTES) return 'nés en ' + (debutSaison() - 12) + ' et avant';
    if (c === COURS_TAISO) return 'nés en ' + (debutSaison() - 13) + ' et avant';
    for (var i = 0; i < CATEGORIES.length; i++) if (CATEGORIES[i][0] === c) {
      var d = debutSaison(), max = d - CATEGORIES[i][1], min = d - CATEGORIES[i][2];
      return CATEGORIES[i][2] > 100 ? 'nés en ' + max + ' et avant' : CATEGORIES[i][1] === 0 ? 'nés en ' + min + ' et après' : min === max ? 'nés en ' + max : 'nés en ' + min + '-' + max;
    }
    return '';
  }
  function triJudokas(a, b) { return (a.nom || '').localeCompare(b.nom || '', 'fr') || (a.prenom || '').localeCompare(b.prenom || '', 'fr'); }
  function suiviDe(d, j) {
    var notes = d.seances.filter(function (s) { return s.statuts && (s.statuts[j.id] === 'P' || s.statuts[j.id] === 'A'); })
      .sort(function (a, b) { return b.date.localeCompare(a.date); });
    var est = function (st) { return function (s) { return s.statuts[j.id] === st; }; };
    var derP = notes.filter(est('P'))[0], mois = aujourdhui().slice(0, 7), deb = debutSaison() + '-09-01', fin = (debutSaison() + 1) + '-09-01';
    // Les alertes sont calculées par cours et par date, pas par nombre de cases cochées le même jour.
    var serie = 0, serieCours = '', cours = coursListe(j);
    cours.forEach(function (c) {
      var derniers = notes.filter(function (s) { return s.groupe === c && s.date >= deb && s.date < fin; }), jours = {}, dates = [];
      derniers.forEach(function (s) {
        if (!Object.prototype.hasOwnProperty.call(jours, s.date)) { jours[s.date] = s.statuts[j.id]; dates.push(s.date); }
        else if (s.statuts[j.id] === 'P') jours[s.date] = 'P';
      });
      var n = 0;
      for (var i = 0; i < dates.length && jours[dates[i]] === 'A'; i++) n++;
      if (n > serie) { serie = n; serieCours = c; }
    });
    function taux(l) { var pr = l.filter(est('P')).length; return l.length ? { p: pr, n: l.length, t: Math.round(100 * pr / l.length) } : null; }
    return { serie: serie, serieCours: serieCours, dernierePresence: derP ? derP.date : '', absences: notes.filter(est('A')).slice(0, 6).map(function (s) { return s.date; }),
      mois: taux(notes.filter(function (s) { return s.date.slice(0, 7) === mois; })), saison: taux(notes.filter(function (s) { return s.date >= deb && s.date < fin; })), total: notes.length };
  }
  function aSurveiller(d) {
    return d.judokas.filter(function (j) { return !j.archive; }).map(function (j) { return { j: j, s: suiviDe(d, j) }; })
      .filter(function (x) { return x.s.serie >= 3; }).sort(function (a, b) { return b.s.serie - a.s.serie; });
  }
  function bilanDe(donnees, cat, inclureArchives) {
    var js = donnees.judokas.filter(function (j) { return (inclureArchives || !j.archive) && (!cat || coursListe(j).indexOf(cat) >= 0); }).sort(triJudokas);
    return js.map(function (j) {
      var c = { P: 0, A: 0 }, nb = 0;
      donnees.seances.forEach(function (s) {
        // Sans filtre de cours : historique complet, y compris catégories des saisons passées.
        if (cat && s.groupe !== cat) return;
        var st = s.statuts && s.statuts[j.id];
        if (st === 'P' || st === 'A') { c[st]++; nb++; }
      });
      return { j: j, P: c.P, A: c.A, nb: nb, taux: nb ? Math.round(c.P * 100 / nb) : null };
    });
  }
    return { debutSaison: debutSaison, catDe: catDe, coursDe: coursDe, ageDe: ageDe, peutTaiso: peutTaiso, coursListe: coursListe, rangCat: rangCat, triCat: triCat, anneesCat: anneesCat, triJudokas: triJudokas, suiviDe: suiviDe, aSurveiller: aSurveiller, bilanDe: bilanDe };
  }
  var api = { creerService: creerService };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JSBClub = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
