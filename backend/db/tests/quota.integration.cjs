'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Pool}=require('pg');
const {createQuotaStore}=require('../quota-store.cjs');
const {createLoginLimiter}=require('../../login-limiter.cjs');
test('PostgreSQL : quotas concurrents, atomicité, fenêtre et nettoyage',async()=>{
 assert.equal(process.env.PGDATABASE,'jsb_ci');
 const pools=[new Pool({max:8}),new Pool({max:8})];
 const pool=pools[0], stores=pools.map(createQuotaStore);
 const keys=['a','b','c','d','e'].map(x=>x.repeat(64));
 const [a,b,c,d,e]=keys;
 try{
  assert.equal((await pool.query('SELECT current_database() AS name')).rows[0].name,'jsb_ci');
  const count=async key=>Number((await pool.query('SELECT count(*) AS n FROM jsb_auth.quota_events WHERE bucket=$1',[key])).rows[0].n);
  const results=await Promise.all(Array.from({length:24},(_,i)=>stores[i%2].reserve([{key:a,limit:5},{key:b,limit:20}],Date.now(),900000)));
  assert.equal(results.filter(Boolean).length,5);
  assert.equal(await count(a),5);assert.equal(await count(b),5);
  assert.equal(await stores[0].reserve([{key:c,limit:10},{key:a,limit:5}],Date.now(),900000),false);
  assert.equal(await count(c),0);
  const reverse=await Promise.all(Array.from({length:12},(_,i)=>stores[i%2].reserve(i%2?[{key:d,limit:4},{key:c,limit:4}]:[{key:c,limit:4},{key:d,limit:4}],Date.now(),900000)));
  assert.equal(reverse.filter(Boolean).length,4);
  assert.equal(await count(c),4);assert.equal(await count(d),4);
  await pool.query("INSERT INTO jsb_auth.quota_events(bucket,occurred_at) VALUES ($1,floor(extract(epoch FROM clock_timestamp())*1000)::bigint-86400001)",[e]);
  assert.equal(await stores[0].reserve([{key:e,limit:1}],0,900000),true);
  assert.equal(await stores[1].reserve([{key:e,limit:1}],Number.MAX_SAFE_INTEGER,900000),false);
  assert.equal(await stores[0].purgeExpired(),1);assert.equal(await count(e),1);
  assert.equal(await stores[0].reserve([{key:a,limit:5},{key:a,limit:6}],Date.now(),900000),false);
  assert.equal(await count(a),5);
  const limiters=stores.map(store=>createLoginLimiter({store,secret:Buffer.alloc(32,9),accountLimit:3,sourceLimit:6}));
  const real=await Promise.all(Array.from({length:12},(_,i)=>limiters[i%2].reserve({accountKey:'quota@example.test',sourceId:'synthetic-source'})));
  assert.equal(real.filter(Boolean).length,3);
 }finally{
  try{await pool.query('DELETE FROM jsb_auth.quota_events');}finally{await Promise.all(pools.map(p=>p.end()));}
 }
});
