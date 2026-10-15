// Service worker JSB Manager : garde une copie complète de l'app sur l'appareil pour fonctionner hors ligne.
// f318ff5500 change à chaque construction : l'iPhone récupère la nouvelle version à la prochaine ouverture avec réseau.
var CACHE = 'jsb-manager-f318ff5500';
var FICHIERS = ['./', './index.html', './manifest.webmanifest', './icone-192.png', './icone-512.png', './icone-maskable-512.png', './apple-touch-icon.png'];
self.addEventListener('install', function (ev) {
  ev.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FICHIERS.map(function (f) { return new Request(f, { cache: 'reload' }); })); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (ev) {
  ev.waitUntil(caches.keys().then(function (cles) {
    return Promise.all(cles.filter(function (k) { return k.indexOf('jsb-') === 0 && k !== CACHE && k !== 'jsb-polices'; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (ev) {
  var req = ev.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  // Polices Google : mises en cache au premier passage, réutilisées hors ligne
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    ev.respondWith(caches.open('jsb-polices').then(function (c) {
      return c.match(req).then(function (r) { return r || fetch(req).then(function (rep) { c.put(req, rep.clone()); return rep; }); });
    }));
    return;
  }
  if (url.origin !== self.location.origin) return;
  // Page de l'app : réseau d'abord (pour la mise à jour), copie locale si pas de réseau
  if (req.mode === 'navigate') {
    // Réseau d'abord pour recevoir les mises à jour, mais copie locale au bout de 3 s (réseau faible au dojo)
    ev.respondWith(new Promise(function (ok) {
      var fini = false;
      function locale() { return caches.match('./index.html', { ignoreSearch: true }); }
      var minuteur = setTimeout(function () { locale().then(function (r) { if (r && !fini) { fini = true; ok(r); } }); }, 3000);
      fetch(req, { cache: 'no-cache' }).then(function (rep) {
        if (rep.ok) { var copie = rep.clone(); caches.open(CACHE).then(function (c) { c.put('./index.html', copie); }); }
        if (!fini) { fini = true; clearTimeout(minuteur); ok(rep); }
      }).catch(function () {
        locale().then(function (r) { if (!fini) { fini = true; clearTimeout(minuteur); ok(r || Response.error()); } });
      });
    }));
    return;
  }
  ev.respondWith(caches.match(req, { ignoreSearch: true }).then(function (r) { return r || fetch(req); }));
});
