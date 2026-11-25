/* JSB Manager — explicit, network-only version verification. */
(function () {
  'use strict';
  window.jsbVerifierMiseAJour = async function (button) {
    var status = document.getElementById('jsb-maj-etat');
    if (!status || button.disabled) return;
    button.disabled = true;
    status.textContent = 'Vérification en cours…';
    try {
      var installed = document.documentElement.getAttribute('data-jsb-version');
      var url = new URL('./index.html', location.href);
      url.searchParams.set('jsb-version-check', String(Date.now()));
      var response = await fetch(url, { cache: 'no-store' });
      if (!response.ok || response.headers.get('X-JSB-Version-Check') !== 'network') throw new Error('network');
      var html = await response.text();
      var match = html.match(/setAttribute\('data-jsb-version',\s*'([^']+)'\)/);
      if (!match) throw new Error('version');
      var remote = match[1];
      if (remote === installed) { status.textContent = 'Version à jour : ' + installed; return; }
      status.textContent = 'Nouvelle version disponible : ' + remote + '. Actualisation…';
      if (navigator.serviceWorker) {
        var registration = await navigator.serviceWorker.getRegistration();
        if (registration) await registration.update();
      }
      var destination = new URL(location.href);
      destination.searchParams.set('jsb-refresh', String(Date.now()));
      location.replace(destination.href);
    } catch (error) {
      status.textContent = 'Vérification indisponible. Vérifiez votre connexion et réessayez. Vos données sont conservées.';
    } finally { button.disabled = false; }
  };
})();
