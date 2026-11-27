'use strict';
// A separate operational command, disabled by default. Never purge business,
// account, legal proof or rights-request records under this technical policy.
const clock="floor(extract(epoch FROM clock_timestamp())*1000)::bigint";
const TARGETS=Object.freeze([
 {name:'sessions',where:'expires_at <= $1'},
 {name:'delivery_outbox',where:'(expires_at <= $1 OR attempts >= 10) AND (lease_until IS NULL OR lease_until <= $1)'},
 {name:'action_tokens',where:'expires_at <= $1'},
 {name:'quota_events',where:'occurred_at <= $1 - 86400000'}
]);
async function technicalRetention(pool,{apply=false,expectedDatabase='jsb_preprod'}={}){
 if(typeof apply!=='boolean'||!['jsb_preprod','jsb_ci'].includes(expectedDatabase))throw TypeError('Configuration de purge invalide');
 const c=await pool.connect();
 try{
  await c.query('BEGIN');
  if((await c.query('SELECT current_database() AS name')).rows[0].name!==expectedDatabase)throw Error('Base dédiée requise');
  // One bounded transaction and one server clock. Concurrent maintenance is refused.
  await c.query("SET LOCAL lock_timeout='3s'");
  await c.query("SET LOCAL statement_timeout='15s'");
  const lock=await c.query('SELECT pg_try_advisory_xact_lock(183201773,91) AS acquired');
  if(!lock.rows[0].acquired)throw Error('Maintenance déjà en cours');
  const now=Number((await c.query('SELECT '+clock+' AS now')).rows[0].now);
  const counts={};
  for(const {name,where} of TARGETS){
   // Names and predicates are static constants, never user input.
   const query=apply?'DELETE FROM jsb_auth.'+name+' WHERE '+where:'SELECT count(*)::int AS n FROM jsb_auth.'+name+' WHERE '+where;
   const r=await c.query(query,[now]);counts[name]=apply?r.rowCount:r.rows[0].n;
  }
  await c.query('COMMIT');
  return {mode:apply?'applied':'preview',counts};
 }catch(e){try{await c.query('ROLLBACK');}catch{}throw e;}finally{c.release();}
}
module.exports=Object.freeze({technicalRetention});
