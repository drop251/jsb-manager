/* JSB Manager — V31. Adaptateur de stockage web, indépendant de React.
 * Les clés et la base IndexedDB existantes sont conservées.
 * Contrat : lire, ecrire, ecrireLot, fermer, oublierAncien, ancien, proteger.
 * Les API système sont injectées pour permettre des tests et un futur adaptateur mobile.
 */
(function (root) {
  'use strict';
  function creerStockage(env) {
    var BASE = 'jsb-manager', TABLE = 'donnees', ouverture = null, file = Promise.resolve(), persistance = null;
    function ouvrir() {
      if (!ouverture) {
        ouverture = new Promise(function (ok, ko) {
          if (!env.indexedDB) { ko(new Error('indisponible')); return; }
          var r; try { r = env.indexedDB.open(BASE, 1); } catch (err) { ko(err); return; }
          r.onupgradeneeded = function () { r.result.createObjectStore(TABLE); };
          r.onsuccess = function () { ok(r.result); };
          r.onerror = function () { ko(r.error); };
          r.onblocked = function () { ko(new Error('bloque')); };
        }).catch(function (err) { ouverture = null; throw err; });
      }
      return ouverture;
    }
    function requete(mode, action) {
      return ouvrir().then(function (db) {
        return new Promise(function (ok, ko) {
          var tx = db.transaction(TABLE, mode), res; var rq = action(tx.objectStore(TABLE));
          rq.onsuccess = function () { res = rq.result; };
          tx.oncomplete = function () { ok(res); }; tx.onerror = tx.onabort = function () { ko(tx.error); };
        });
      });
    }
    function lireLocal(cle) { try { return JSON.parse(env.localStorage.getItem(cle)); } catch (err) { return null; } }
    function ecrireLocal(cle, val) { try { env.localStorage.setItem(cle, JSON.stringify(val)); return true; } catch (err) { return false; } }
    function cleSecours(cle) { return cle + '-secours'; }
    function retirerSecours(cle) { try { env.localStorage.removeItem(cleSecours(cle)); } catch (err) {} }
    function relire(cle) {
      var secours = lireLocal(cleSecours(cle));
      if (secours !== null) {
        return requete('readwrite', function (t) { return t.put(secours, cle); }).then(function () {
          retirerSecours(cle); return secours;
        }, function () { return secours; });
      }
      return requete('readonly', function (t) { return t.get(cle); }).catch(function () { return lireLocal(cle); });
    }
    return {
      lire: function (cle) { return file.then(function () { return relire(cle); }); },
      ecrire: function (cle, val) {
        file = file.then(function () {
          return requete('readwrite', function (t) { return t.put(val, cle); }).then(function () {
            retirerSecours(cle); return true;
          }, function () { return ecrireLocal(cleSecours(cle), val); });
        });
        return file;
      },
      ecrireLot: function (entrees) {
        var travail = file.then(function () { return ouvrir().then(function (db) {
          return new Promise(function (ok, ko) {
            var tx = db.transaction(TABLE, 'readwrite'), t = tx.objectStore(TABLE);
            tx.oncomplete = function () { ok(true); }; tx.onerror = tx.onabort = function () { ko(tx.error || new Error('stockage')); };
            try { entrees.forEach(function (x) { t.put(x[1], x[0]); }); }
            catch (err) { tx.abort(); ko(err); }
          });
        }); });
        file = travail.catch(function () { return false; });
        return travail.then(function (ok) { entrees.forEach(function (x) { retirerSecours(x[0]); }); return ok; });
      },
      fermer: function () { var o = ouverture; ouverture = null; return o ? o.then(function (db) { db.close(); }, function () {}) : Promise.resolve(); },
      oublierAncien: function (cle) { try { env.localStorage.removeItem(cle); } catch (err) {} },
      ancien: lireLocal,
      proteger: function () {
        if (persistance) return persistance;
        var st = env.navigator && env.navigator.storage;
        persistance = !st || !st.persist ? Promise.resolve(false) : (st.persisted ? st.persisted() : Promise.resolve(false)).then(function (deja) { return deja || st.persist(); }).catch(function () { return false; });
        return persistance;
      }
    };
  }
  var api = { creerStockage: creerStockage };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JSBStockageWeb = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
