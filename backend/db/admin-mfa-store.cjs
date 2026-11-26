'use strict';
// Only enabled factors of active, verified administrators can be decrypted.
// Account-first locking matches the session and credential stores.
function createAdminMfaStore({pool,vault}={}){
 if(!pool||typeof pool.query!=='function'||typeof pool.connect!=='function'||typeof vault?.open!=='function')throw TypeError('Adaptateurs MFA PostgreSQL requis');
 async function loadFactor(accountId){
  const r=await pool.query("SELECT f.factor_version,f.encrypted_secret FROM jsb_auth.mfa_factors f JOIN jsb_auth.accounts a ON a.id=f.account_id WHERE a.id=$1 AND a.role='admin' AND a.status='active' AND a.email_verified=true AND f.enabled=true",[accountId]);
  if(r.rowCount!==1)return null;
  const f=r.rows[0],secret=await vault.open({accountId,factorVersion:f.factor_version,envelope:f.encrypted_secret});
  return {version:f.factor_version,enabled:true,secret};
 }
 async function consumeStep({accountId,version,step}){
  if(typeof accountId!=='string'||typeof version!=='string'||!Number.isSafeInteger(step)||step<0)return false;
  const c=await pool.connect();let discard=false;
  try{
   await c.query('BEGIN');
   const a=await c.query("SELECT id FROM jsb_auth.accounts WHERE id=$1 AND role='admin' AND status='active' AND email_verified=true FOR UPDATE",[accountId]);
   if(a.rowCount!==1){await c.query('ROLLBACK');return false;}
   const r=await c.query("UPDATE jsb_auth.mfa_factors SET last_step=$3 WHERE account_id=$1 AND factor_version=$2 AND enabled=true AND last_step<$3 AND abs($3::bigint-floor(extract(epoch FROM clock_timestamp())/30)::bigint)<=1 RETURNING account_id",[accountId,version,step]);
   await c.query('COMMIT');return r.rowCount===1;
  }catch(e){try{await c.query('ROLLBACK');}catch(_){discard=true;}throw e;}finally{c.release(discard);}
 }
 return Object.freeze({loadFactor,consumeStep});
}
module.exports=Object.freeze({createAdminMfaStore});
