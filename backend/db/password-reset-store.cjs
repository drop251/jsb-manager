'use strict';
// Trusted adapters only. Account-first locking is shared with registration
// and session issuance; password update and revocation commit together.
function createPasswordResetStore({pool,encryptDelivery}={}){
 if(!pool||typeof pool.connect!=='function'||typeof encryptDelivery!=='function')throw new TypeError('Adaptateurs récupération requis');
 const purpose='password-reset';
 async function transaction(fn){
  const c=await pool.connect();let discard=false;
  try{await c.query('BEGIN');const result=await fn(c);await c.query('COMMIT');return result;}
  catch(e){try{await c.query('ROLLBACK');}catch(_){discard=true;}throw e;}
  finally{c.release(discard);}
 }
 async function replaceReset({email,reset:r,delivery:d}){
  if(r.purpose!==purpose||d.purpose!==purpose||d.email!==email||d.expiresAt!==r.expiresAt)throw Error('Récupération invalide');
  return transaction(async c=>{
   const a=await c.query("SELECT id FROM jsb_auth.accounts WHERE email=$1 AND role IN ('coach','individual') AND status='active' AND email_verified=true FOR UPDATE",[email]);
   if(a.rowCount!==1)return 'ineligible';
   const id=a.rows[0].id;
   const payload=await encryptDelivery({...d,accountId:id,purpose});
   if(!Buffer.isBuffer(payload)||!payload.length)throw Error('Chiffrement requis');
   await c.query('DELETE FROM jsb_auth.action_tokens WHERE account_id=$1 AND purpose=$2',[id,purpose]);
   await c.query('DELETE FROM jsb_auth.delivery_outbox WHERE account_id=$1 AND purpose=$2',[id,purpose]);
   await c.query('INSERT INTO jsb_auth.action_tokens(purpose,hash,account_id,issued_at,expires_at) VALUES ($1,$2,$3,$4,$5)',[purpose,r.hash,id,r.issuedAt,r.expiresAt]);
   await c.query('INSERT INTO jsb_auth.delivery_outbox(account_id,purpose,encrypted_payload,created_at,expires_at) VALUES ($1,$2,$3,$4,$5)',[id,purpose,payload,r.issuedAt,r.expiresAt]);
   return 'created';
  });
 }
 async function consumeResetAndRevoke({hash,purpose:kind,now,passwordHash}){
  if(kind!==purpose||typeof hash!=='string'||!/^[a-f0-9]{64}$/.test(hash)||!Number.isSafeInteger(now)||now<0||typeof passwordHash!=='string'||!passwordHash) return 'invalid';
  return transaction(async c=>{
   const lookup=await c.query('SELECT account_id FROM jsb_auth.action_tokens WHERE purpose=$1 AND hash=$2',[purpose,hash]);
   if(lookup.rowCount!==1)return 'invalid';
   const id=lookup.rows[0].account_id;
   const a=await c.query("SELECT id FROM jsb_auth.accounts WHERE id=$1 AND role IN ('coach','individual') AND status='active' AND email_verified=true FOR UPDATE",[id]);
   if(a.rowCount!==1)return 'invalid';
   const t=await c.query("DELETE FROM jsb_auth.action_tokens WHERE account_id=$1 AND purpose=$2 AND hash=$3 AND issued_at<=$4 AND expires_at>$4 AND issued_at<=floor(extract(epoch FROM clock_timestamp())*1000)::bigint AND expires_at>floor(extract(epoch FROM clock_timestamp())*1000)::bigint RETURNING hash",[id,purpose,hash,now]);
   if(t.rowCount!==1)return 'invalid';
   await c.query('UPDATE jsb_auth.accounts SET password_hash=$2,credential_version=credential_version+1 WHERE id=$1',[id,passwordHash]);
   await c.query('DELETE FROM jsb_auth.sessions WHERE account_id=$1',[id]);
   await c.query('DELETE FROM jsb_auth.action_tokens WHERE account_id=$1 AND purpose=$2',[id,purpose]);
   await c.query('DELETE FROM jsb_auth.delivery_outbox WHERE account_id=$1 AND purpose=$2',[id,purpose]);
   return 'updated';
  });
 }
 return Object.freeze({replaceReset,consumeResetAndRevoke});
}
module.exports=Object.freeze({createPasswordResetStore});
