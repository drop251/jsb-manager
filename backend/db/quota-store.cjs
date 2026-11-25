'use strict';
// All quota writers must use the same advisory-lock namespace and lock order.
// Use a consistent clock across server instances. The DB clock is authoritative
// for the window; the caller's timestamp is validated but not trusted for expiry.
function createQuotaStore(pool){
 if(!pool||typeof pool.connect!=='function')throw new TypeError('Pool PostgreSQL requis');
 async function reserve(quotas,time,windowMs){
  if(!Array.isArray(quotas)||quotas.length<1||quotas.length>8||!Number.isSafeInteger(time)||time<0||!Number.isSafeInteger(windowMs)||windowMs<1||windowMs>86400000)return false;
  if(quotas.some(q=>!q||typeof q.key!=='string'||!/^[a-f0-9]{64}$/.test(q.key)||!Number.isSafeInteger(q.limit)||q.limit<1||q.limit>10000))return false;
  if(new Set(quotas.map(q=>q.key)).size!==quotas.length)return false;
  const ordered=[...quotas].sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0);
  const client=await pool.connect();
  let discard=false;
  try{
   await client.query('BEGIN');
   // A single ordered numeric lock key per bucket; sort actual lock IDs
   // rather than hashes to avoid deadlocks even on advisory-key collisions.
   const keys=await client.query("SELECT DISTINCT hashtextextended('jsb-quota-v1:' || k,0) AS lock_id FROM unnest($1::text[]) AS u(k) ORDER BY lock_id",[ordered.map(q=>q.key)]);
   for(const row of keys.rows)await client.query('SELECT pg_advisory_xact_lock($1::bigint)',[row.lock_id]);
   const clock=await client.query("SELECT floor(extract(epoch FROM clock_timestamp())*1000)::bigint AS now");
   const now=Number(clock.rows[0].now);
   if(!Number.isSafeInteger(now)||now<0)throw Error('Horloge SQL invalide');
   for(const q of ordered){
    const r=await client.query('SELECT count(*)::bigint AS total FROM jsb_auth.quota_events WHERE bucket=$1 AND occurred_at>$2',[q.key,now-windowMs]);
    if(BigInt(r.rows[0].total)>=BigInt(q.limit)){await client.query('ROLLBACK');return false;}
   }
   await client.query('INSERT INTO jsb_auth.quota_events(bucket,occurred_at) SELECT k,$2::bigint FROM unnest($1::text[]) AS u(k)',[ordered.map(q=>q.key),now]);
   await client.query('COMMIT');return true;
  }catch(e){try{await client.query('ROLLBACK');}catch(_){discard=true;}throw e;}finally{client.release(discard);}
 }
 // All configured windows are at most 24 hours. Do not purge younger events.
 async function purgeExpired(){
  const client=await pool.connect();
  try{
   const r=await client.query("DELETE FROM jsb_auth.quota_events WHERE occurred_at <= floor(extract(epoch FROM clock_timestamp())*1000)::bigint - 86400000");
   return r.rowCount;
  }finally{client.release();}
 }
 return Object.freeze({reserve,purgeExpired});
}
module.exports=Object.freeze({createQuotaStore});
