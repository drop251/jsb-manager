const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { attach } = require('../jsb-edge-swipe.js');

function harness(options={}) {
  const handlers={}; let commits=0, cancels=0, progress=[]; let clock=1000;
  const listenerTarget={addEventListener(n,cb){handlers[n]=cb;},removeEventListener(n){delete handlers[n];}};
  let enabled=options.enabled ?? true, blocked=options.blocked ?? false, back=options.back ?? true;
  const dispose=attach({listenerTarget,now:()=>clock,getEnabled:()=>enabled,isBlocked:()=>blocked,canGoBack:()=>back,
    getRoot:()=>({contains:(node)=>node.allowed!==false}),onCommit:()=>{commits++;},onCancel:()=>{cancels++;},
    onProgress:(p)=>progress.push(p),...options.overrides});
  const target={allowed:true,closest:()=>options.ignored ? true : false};
  const t=(x,y=100,id=1)=>({clientX:x,clientY:y,identifier:id});
  function e(type,points,targetOverride=target){handlers[type]?.({target:targetOverride,touches:type==='touchend'?[]:points,changedTouches:points});}
  return {handlers,target,t,e,dispose,clock(v){clock=v;},enabled(v){enabled=v;},blocked(v){blocked=v;},back(v){back=v;},
    stats:()=>({commits,cancels,progress})};
}
function swipe(h,end=145,y=100){h.e('touchstart',[h.t(12)]);h.e('touchmove',[h.t(end,y)]);h.e('touchend',[h.t(end,y)]);}
test('long edge swipe commits once',()=>{const h=harness();swipe(h);assert.equal(h.stats().commits,1);h.dispose();});
test('short swipe cancels',()=>{const h=harness();swipe(h,40);assert.equal(h.stats().commits,0);assert.equal(h.stats().cancels,1);h.dispose();});
test('vertical scroll does not navigate',()=>{const h=harness();swipe(h,22,180);assert.equal(h.stats().commits,0);h.dispose();});
test('start outside left edge ignored',()=>{const h=harness();h.e('touchstart',[h.t(55)]);h.e('touchmove',[h.t(180)]);h.e('touchend',[h.t(180)]);assert.equal(h.stats().commits,0);h.dispose();});
test('interactive control excluded',()=>{const h=harness({ignored:true});swipe(h);assert.equal(h.stats().commits,0);h.dispose();});
test('modal blocks swipe',()=>{const h=harness({blocked:true});swipe(h);assert.equal(h.stats().commits,0);h.dispose();});
test('home with no back target blocks swipe',()=>{const h=harness({back:false});swipe(h);assert.equal(h.stats().commits,0);h.dispose();});
test('gesture disabled remains disabled',()=>{const h=harness({enabled:false});swipe(h);assert.equal(h.stats().commits,0);h.dispose();});
test('horizontal movement reports progress',()=>{const h=harness();swipe(h,70);assert(h.stats().progress.some(p=>p.distancePx===58));h.dispose();});
test('touchcancel resets active swipe',()=>{const h=harness();h.e('touchstart',[h.t(12)]);h.e('touchmove',[h.t(130)]);h.e('touchcancel',[h.t(130)]);assert.equal(h.stats().commits,0);assert.equal(h.stats().cancels,1);h.dispose();});
test('end with wrong identifier is ignored',()=>{const h=harness();h.e('touchstart',[h.t(12)]);h.e('touchmove',[h.t(145)]);h.e('touchend',[h.t(145,100,2)]);assert.equal(h.stats().commits,0);h.e('touchend',[h.t(145)]);assert.equal(h.stats().commits,1);h.dispose();});
test('duration beyond threshold cancels',()=>{const h=harness();h.e('touchstart',[h.t(12)]);h.clock(2400);h.e('touchmove',[h.t(145)]);h.e('touchend',[h.t(145)]);assert.equal(h.stats().commits,0);h.dispose();});
test('context blocked mid gesture cancels',()=>{const h=harness();h.e('touchstart',[h.t(12)]);h.e('touchmove',[h.t(60)]);h.blocked(true);h.e('touchend',[h.t(145)]);assert.equal(h.stats().commits,0);h.dispose();});
test('second finger mid gesture cancels',()=>{const h=harness();h.e('touchstart',[h.t(12)]);h.e('touchmove',[h.t(65),h.t(90,110,2)]);h.e('touchend',[h.t(145)]);assert.equal(h.stats().commits,0);h.dispose();});
test('reverse swipe does not navigate',()=>{const h=harness();h.e('touchstart',[h.t(12)]);h.e('touchmove',[h.t(0)]);h.e('touchend',[h.t(0)]);assert.equal(h.stats().commits,0);h.dispose();});
test('no DOM-like target inside root is ignored',()=>{const h=harness();const disallowed={allowed:false,closest:()=>false};h.e('touchstart',[h.t(12)],disallowed);h.e('touchmove',[h.t(145)],disallowed);h.e('touchend',[h.t(145)],disallowed);assert.equal(h.stats().commits,0);h.dispose();});
test('disposal removes listeners',()=>{const h=harness();h.dispose();assert.equal(Object.keys(h.handlers).length,0);h.dispose();assert.equal(Object.keys(h.handlers).length,0);});
test('fresh gesture after cancellation works',()=>{const h=harness();swipe(h,40);swipe(h,145);assert.equal(h.stats().commits,1);h.dispose();});
test('application uses one new controller and no legacy touchstart registration',()=>{
  const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  assert.match(html, /<script src="\.\/jsb-edge-swipe\.js"><\/script>/);
  assert.equal((html.match(/window\.JSBEdgeSwipe\.attach\(/g)||[]).length,1);
  assert.doesNotMatch(html,/window\.addEventListener\('touchstart', debut/);
  assert.match(html,/if \(retourRef\.current\) retourRef\.current\(\)/);
});
test('PWA pre-caches the edge-swipe module',()=>{
  const sw=fs.readFileSync(path.join(__dirname,'..','sw.js'),'utf8');
  assert.match(sw,/\.\/jsb-edge-swipe\.js/);
});

test('toutes les zones contenteditable excluent le retour tactile, y compris les variantes non true',()=>{
  const { IGNORE_SELECTOR }=require('../jsb-edge-swipe.js');
  assert.match(IGNORE_SELECTOR,/\[contenteditable\]/);
  const h=harness();
  const editable={allowed:true,closest:selector=>selector.includes('[contenteditable]')?{}:null};
  h.e('touchstart',[h.t(12)],editable);
  h.e('touchmove',[h.t(145)],editable);
  h.e('touchend',[h.t(145)],editable);
  assert.equal(h.stats().commits,0);
  h.dispose();
});
