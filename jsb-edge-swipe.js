/* JSB Manager — contrôle de retour tactile, sans modification des données métier.
 * Le geste ne gère pas l'historique et ne doit remplacer qu'un écouteur existant.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.JSBEdgeSwipe = api;
}(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  var IGNORE_SELECTOR = 'button,a,input,select,textarea,[contenteditable="true"],[role="dialog"],[role="slider"],[data-sans-glisse],[data-jsb-no-swipe],.pr-tableau,.pr-puces';
  function num(v, d) { return Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d; }
  function noop() {}
  function safe(fn, fallback) { try { return typeof fn === 'function' ? fn() : fallback; } catch (_err) { return fallback; } }
  function touchWithId(list, id) {
    if (!list) return null;
    for (var i = 0; i < list.length; i++) if (list[i].identifier === id) return list[i];
    return null;
  }
  function ignored(node, selector) {
    if (!node) return false;
    if (node.nodeType === 3) node = node.parentElement;
    return Boolean(node && node.closest && node.closest(selector || IGNORE_SELECTOR));
  }
  function attach(options) {
    options = options || {};
    var listenerTarget = options.listenerTarget || (typeof window !== 'undefined' ? window : null);
    if (!listenerTarget || !listenerTarget.addEventListener || !listenerTarget.removeEventListener) throw Error('listenerTarget requis');
    var edgePx = num(options.edgePx, 28);
    var commitPx = num(options.commitPx, 90);
    var maxDurationMs = num(options.maxDurationMs, 1200);
    var axisRatio = num(options.axisRatio, 1.35);
    var getEnabled = options.getEnabled || function () { return true; };
    var isBlocked = options.isBlocked || function () { return false; };
    var canGoBack = options.canGoBack || function () { return false; };
    var getRoot = options.getRoot || function () { return null; };
    var onProgress = options.onProgress || noop;
    var onCancel = options.onCancel || noop;
    var onCommit = options.onCommit || noop;
    var now = options.now || function () { return Date.now(); };
    var state = null;
    var disposed = false;
    function clear(notify) {
      if (!state) return;
      var wasActive = state.active;
      state = null;
      if (notify && wasActive) onCancel();
    }
    function validContext() {
      return !disposed && !!safe(getEnabled, false) && !safe(isBlocked, true) && !!safe(canGoBack, false);
    }
    function start(ev) {
      if (state) clear(true);
      if (!validContext() || !ev.touches || ev.touches.length !== 1) return;
      var point = ev.touches[0];
      if (!point || point.clientX > edgePx || point.clientX < 0) return;
      var target = ev.target;
      if (ignored(target, options.ignoreSelector)) return;
      var host = safe(getRoot, null);
      if (host && typeof host.contains === 'function' && !host.contains(target)) return;
      state = { id: point.identifier, x: point.clientX, y: point.clientY, started: now(), active: false };
    }
    function move(ev) {
      if (!state) return;
      if (!validContext() || !ev.touches || ev.touches.length !== 1) { clear(true); return; }
      var point = touchWithId(ev.touches, state.id);
      if (!point) { clear(true); return; }
      var dx = point.clientX - state.x;
      var dy = Math.abs(point.clientY - state.y);
      if (dx < -8 || (dy > 16 && dy > Math.max(dx, 0) / axisRatio)) { clear(true); return; }
      if (dx > 10 && dx > dy * axisRatio) state.active = true;
      if (state.active && dx >= 0) onProgress({ distancePx: dx, progress: Math.min(dx / commitPx, 1) });
    }
    function end(ev) {
      if (!state) return;
      var point = touchWithId(ev.changedTouches, state.id);
      if (!point) return;
      var dx = point.clientX - state.x;
      var dy = Math.abs(point.clientY - state.y);
      var duration = now() - state.started;
      var shouldCommit = state.active && dx >= commitPx && dx > dy * axisRatio && duration <= maxDurationMs && validContext();
      clear(!shouldCommit);
      if (shouldCommit) onCommit();
    }
    function cancel() { clear(true); }
    listenerTarget.addEventListener('touchstart', start, { passive: true });
    listenerTarget.addEventListener('touchmove', move, { passive: true });
    listenerTarget.addEventListener('touchend', end, { passive: true });
    listenerTarget.addEventListener('touchcancel', cancel, { passive: true });
    return function dispose() {
      if (disposed) return;
      disposed = true;
      listenerTarget.removeEventListener('touchstart', start);
      listenerTarget.removeEventListener('touchmove', move);
      listenerTarget.removeEventListener('touchend', end);
      listenerTarget.removeEventListener('touchcancel', cancel);
      clear(true);
    };
  }
  return { attach: attach, IGNORE_SELECTOR: IGNORE_SELECTOR };
}));
