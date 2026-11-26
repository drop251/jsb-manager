'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');

function navigation({ network, offline = null }) {
  const listeners = {};
  const writes = [];
  const self = {
    location: { origin: 'https://jsb.test' },
    addEventListener(name, handler) { listeners[name] = handler; },
    skipWaiting() { return Promise.resolve(); },
    clients: { claim() { return Promise.resolve(); } }
  };
  const caches = {
    match() { throw new Error('Une lecture globale des caches est interdite'); },
    open(name) {
      assert.match(name, /^jsb-manager-/);
      return Promise.resolve({
        match() { return offline instanceof Error ? Promise.reject(offline) : Promise.resolve(offline); },
        put(url, response) { writes.push({ url, response }); return Promise.resolve(); }
      });
    }
  };
  const context = {
    self, caches, URL, Promise,
    Request: class Request { constructor(url) { this.url = url; } },
    Response: { error() { return { tag: 'response-error' }; } },
    fetch() { return network instanceof Error ? Promise.reject(network) : Promise.resolve(network); },
    setTimeout() { return 1; },
    clearTimeout() {}
  };
  vm.runInNewContext(source, context, { filename: 'sw.js' });
  const event = {
    request: { url: 'https://jsb.test/app/', method: 'GET', mode: 'navigate' },
    respondWith(promise) { this.result = promise; }
  };
  listeners.fetch(event);
  return { response: event.result, writes };
}

test('PWA : une erreur HTTP 503 sert la copie locale existante', async () => {
  const cached = { tag: 'index-cached' };
  const result = navigation({ network: { ok: false, status: 503 }, offline: cached });
  assert.equal(await result.response, cached);
  assert.equal(result.writes.length, 0);
});

test('PWA : une erreur HTTP sans copie locale reste visible, sans faux succès', async () => {
  const serverError = { ok: false, status: 404 };
  const result = navigation({ network: serverError });
  assert.equal(await result.response, serverError);
  assert.equal(result.writes.length, 0);
});

test('PWA : une navigation 200 reste prioritaire et actualise le cache', async () => {
  const online = { ok: true, status: 200, clone() { return { tag: 'network-copy' }; } };
  const result = navigation({ network: online, offline: { tag: 'ancien-index' } });
  assert.equal(await result.response, online);
  // La mise en cache est asynchrone par conception ; on vérifie son déclenchement.
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(result.writes.length, 1);
  assert.equal(result.writes[0].url, './index.html');
});

test('PWA : perte de connexion avec copie disponible conserve la navigation', async () => {
  const cached = { tag: 'offline-after-network-failure' };
  assert.equal(await navigation({ network: new Error('hors ligne'), offline: cached }).response, cached);
});

test('PWA : échec simultané du réseau et du cache ne laisse pas la navigation suspendue', {timeout:1000}, async () => {
  const result = navigation({ network: new Error('hors ligne'), offline: new Error('cache indisponible') });
  assert.equal((await result.response).tag, 'response-error');
  assert.equal(result.writes.length, 0);
});

test('PWA : erreur HTTP et cache indisponible conservent la vraie réponse HTTP', {timeout:1000}, async () => {
  const serverError = { ok: false, status: 503 };
  const result = navigation({ network: serverError, offline: new Error('cache indisponible') });
  assert.equal(await result.response, serverError);
});

test('PWA : le secours ne consulte jamais les caches globaux', async () => {
  const result = navigation({ network: new Error('hors ligne'), offline: { tag: 'local' } });
  assert.equal((await result.response).tag, 'local');
});
