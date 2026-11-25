'use strict';
// encryptDelivery must return an authenticated encrypted Buffer with key-version
// metadata and bind accountId/purpose to its associated data. No plaintext storage.
// All operations that alter an existing account or its tokens lock account first.
function createRegistrationStore({pool,encryptDelivery}={}){
 if(!pool||typeof pool.connect!=='function'||typeof encryptDelivery!=='function')throw new TypeError('Adaptateurs inscription requis');
 const purpose='email-verification';
 async function transaction(fn){
  const c=await pool.connect();let discard=false;
  try{await c.query('BEGIN');const result=await fn(c);await c.query('COMMIT');return result;}
  catch(e){try{await c.query('ROLLBACK');}catch(_){discard=true;}throw e;}
  finally{c.release(discard);}
 }
 async function queue(c,id,v,delivery){
  const payload=await encryptDelivery({...delivery,accountId:id,purpose});
  if(!Buffer.isBuffer(payload)||!payload.length)throw Error('Chiffrement requis');
  await c.query('INSERT INTO jsb_auth.action_tokens(purpose,hash,account_id,issued_at,expires_at) VALUES ($1,$2,$3,$4,$5)',[purpose,v.hash,id,v.issuedAt,v.expiresAt]);
  await c.query('INSERT INTO jsb_auth.delivery_outbox(account_id,purpose,encrypted_payload,created_at,expires_at) VALUES ($1,$2,$3,$4,$5)',[id,purpose,payload,v.issuedAt,v.expiresAt]);
 }
 async function createPendingAccount({account:a,verification:v,delivery:d}){
  if(!['coach','individual'].includes(a.role)||a.status!=='pending'||a.emailVerified!==false||v.accountId!==a.id||d.accountId!==a.id||d.email!==a.email||d.expiresAt!==v.expiresAt)throw Error('Inscription invalide');
  return transaction(async c=>{
   const r=await c.query("INSERT INTO jsb_auth.accounts(id,email,password_hash,role,status,email_verified,created_at) VALUES ($1,$2,$3,$4,'pending',false,$5) ON CONFLICT(email) DO NOTHING RETURNING id",[a.id,a.email,a.passwordHash,a.role,v.issuedAt]);
   if(r.rowCount!==1)return 'duplicate';
   await queue(c,a.id,v,d);return 'created';
  });
 }
 async function replacePendingVerification({email,verification:v,delivery:d}){
  if(d.email!==email||d.expiresAt!==v.expiresAt)throw Error('Livraison invalide');
  return transaction(async c=>{
   const r=await c.query("SELECT id FROM jsb_auth.accounts WHERE email=$1 AND role IN ('coach','individual') AND status='pending' AND email_verified=false FOR UPDATE",[email]);
   if(r.rowCount!==1)return 'ineligible';
   const id=r.rows[0].id;
   await c.query('DELETE FROM jsb_auth.action_tokens WHERE account_id=$1 AND purpose=$2',[id,purpose]);
   await c.query('DELETE FROM jsb_auth.delivery_outbox WHERE account_id=$1 AND purpose=$2',[id,purpose]);
   await queue(c,id,v,d);return 'replaced';
  });
 }
 async function consumeAndActivate({hash,now}){
  return transaction(async c=>{
   const lookup=await c.query('SELECT account_id FROM jsb_auth.action_tokens WHERE purpose=$1 AND hash=$2',[purpose,hash]);
   if(lookup.rowCount!==1)return 'invalid';
   const id=lookup.rows[0].account_id;
   const a=await c.query("SELECT id FROM jsb_auth.accounts WHERE id=$1 AND role IN ('coach','individual') AND status='pending' AND email_verified=false FOR UPDATE",[id]);
   if(a.rowCount!==1)return 'invalid';
   const t=await c.query("DELETE FROM jsb_auth.action_tokens WHERE purpose=$1 AND hash=$2 AND account_id=$3 AND issued_at<=$4 AND expires_at>$4 AND issued_at<=floor(extract(epoch FROM clock_timestamp())*1000)::bigint AND expires_at>floor(extract(epoch FROM clock_timestamp())*1000)::bigint RETURNING hash",[purpose,hash,id,now]);
   if(t.rowCount!==1)return 'invalid';
   await c.query("UPDATE jsb_auth.accounts SET status='active',email_verified=true WHERE id=$1",[id]);
   await c.query('DELETE FROM jsb_auth.delivery_outbox WHERE account_id=$1 AND purpose=$2',[id,purpose]);
   return 'activated';
  });
 }
 return Object.freeze({createPendingAccount,replacePendingVerification,consumeAndActivate});
}
module.exports=Object.freeze({createRegistrationStore});
