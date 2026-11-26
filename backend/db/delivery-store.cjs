'use strict';
const {randomBytes}=require('node:crypto');
// At-least-once delivery: provider idempotency by stable delivery ID is required.
// Never hold database locks while making an external network request.
function createDeliveryStore(pool){
 if(typeof pool?.query!=='function')throw TypeError('Pool requis');
 const clock="floor(extract(epoch FROM clock_timestamp())*1000)::bigint";
 async function claim(){
  const lease=randomBytes(16).toString('hex');
  const r=await pool.query(`WITH picked AS (
   SELECT o.id FROM jsb_auth.delivery_outbox o
   JOIN jsb_auth.accounts a ON a.id=o.account_id
   JOIN jsb_auth.action_tokens t ON t.account_id=o.account_id AND t.purpose=o.purpose AND t.expires_at=o.expires_at
   WHERE o.expires_at>${clock} AND o.next_attempt_at<=${clock}
    AND o.attempts<10 AND (o.lease_until IS NULL OR o.lease_until<=${clock})
    AND a.role IN ('coach','individual')
    AND ((o.purpose='email-verification' AND a.status='pending' AND NOT a.email_verified)
      OR (o.purpose='password-reset' AND a.status='active' AND a.email_verified))
   ORDER BY o.next_attempt_at,o.id LIMIT 1 FOR UPDATE OF o SKIP LOCKED
  ) UPDATE jsb_auth.delivery_outbox o
  SET lease_id=$1,lease_until=${clock}+60000,attempts=o.attempts+1
  FROM picked WHERE o.id=picked.id
  RETURNING o.id,o.account_id,o.purpose,o.encrypted_payload,o.expires_at,o.attempts,o.lease_id`,[lease]);
  const o=r.rows[0];return o?{id:String(o.id),accountId:o.account_id,purpose:o.purpose,encryptedPayload:o.encrypted_payload,expiresAt:Number(o.expires_at),attempts:o.attempts,leaseId:o.lease_id}:null;
 }
 function valid(job){return job&&typeof job.id==='string'&&/^\d+$/.test(job.id)&&typeof job.leaseId==='string'&&/^[a-f0-9]{32}$/.test(job.leaseId);}
 async function current(job,hash,email){
  if(!valid(job)||typeof hash!=='string'||!/^[a-f0-9]{64}$/.test(hash)||typeof email!=='string')return false;
  const r=await pool.query(`SELECT 1 FROM jsb_auth.delivery_outbox o JOIN jsb_auth.accounts a ON a.id=o.account_id
   JOIN jsb_auth.action_tokens t ON t.account_id=o.account_id AND t.purpose=o.purpose AND t.expires_at=o.expires_at
   WHERE o.id=$1 AND o.lease_id=$2 AND o.lease_until>${clock} AND o.expires_at>${clock}
   AND t.hash=$3 AND a.email=$4 AND a.role IN ('coach','individual')
   AND ((o.purpose='email-verification' AND a.status='pending' AND NOT a.email_verified)
      OR (o.purpose='password-reset' AND a.status='active' AND a.email_verified))`,[job.id,job.leaseId,hash,email]);
  return r.rowCount===1;
 }
 async function finish(job){
  if(!valid(job))return false;
  return (await pool.query('DELETE FROM jsb_auth.delivery_outbox WHERE id=$1 AND lease_id=$2',[job.id,job.leaseId])).rowCount===1;
 }
 async function retry(job){
  if(!valid(job)||!Number.isInteger(job.attempts)||job.attempts<1||job.attempts>10)return false;
  const delay=Math.min(120000,1000*2**job.attempts);
  return (await pool.query(`UPDATE jsb_auth.delivery_outbox SET lease_id=NULL,lease_until=NULL,next_attempt_at=${clock}+$3 WHERE id=$1 AND lease_id=$2`,[job.id,job.leaseId,delay])).rowCount===1;
 }
 async function purgeExpired(){
  return (await pool.query(`DELETE FROM jsb_auth.delivery_outbox WHERE (expires_at<=${clock} OR attempts>=10) AND (lease_until IS NULL OR lease_until<=${clock})`)).rowCount;
 }
 return Object.freeze({claim,current,finish,retry,purgeExpired});
}
module.exports=Object.freeze({createDeliveryStore});
