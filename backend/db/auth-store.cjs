'use strict';
// Adapter for a trusted node-postgres compatible pool. No client access.
// Session insertion compares the credential version under an account row lock.
// Club memberships intentionally remain empty until a dedicated store exists.
function createAuthStore(pool){
 if(!pool||typeof pool.query!=='function'||typeof pool.connect!=='function')throw new TypeError('Pool PostgreSQL requis');
 const integer=value=>{const n=Number(value);if(!Number.isSafeInteger(n)||n<0)throw Error('Entier SQL invalide');return n;};
 function account(row,withPassword=false){
  if(!row)return null;
  const a={id:row.id,role:row.role,status:row.status,emailVerified:row.email_verified,credentialVersion:integer(row.credential_version),clubIds:[]};
  if(withPassword)a.passwordHash=row.password_hash;
  return a;
 }
 async function loadAccount(id){
  const r=await pool.query('SELECT id,role,status,email_verified,credential_version FROM jsb_auth.accounts WHERE id=$1',[id]);
  return account(r.rows[0]);
 }
 async function findAccountByEmail(email){
  const r=await pool.query('SELECT id,role,status,email_verified,credential_version,password_hash FROM jsb_auth.accounts WHERE email=$1',[email]);
  return account(r.rows[0],true);
 }
 async function insert(record){
  if(!Number.isSafeInteger(record.credentialVersion)||record.credentialVersion<1)return false;
  const client=await pool.connect();
  try{
   await client.query('BEGIN');
   const r=await client.query("SELECT id FROM jsb_auth.accounts WHERE id=$1 AND role=$2 AND credential_version=$3 AND status='active' AND email_verified=true FOR UPDATE",[record.accountId,record.roleAtIssue,record.credentialVersion]);
   if(r.rowCount!==1){await client.query('ROLLBACK');return false;}
   await client.query('INSERT INTO jsb_auth.sessions(hash,account_id,role_at_issue,credential_version,issued_at,expires_at) VALUES ($1,$2,$3,$4,$5,$6)',[record.hash,record.accountId,record.roleAtIssue,record.credentialVersion,record.issuedAt,record.expiresAt]);
   await client.query('COMMIT');return true;
  }catch(e){try{await client.query('ROLLBACK');}catch(_){/* preserve original error */}throw e;}finally{client.release();}
 }
 async function find(hash){
  const r=await pool.query('SELECT hash,account_id,role_at_issue,credential_version,issued_at,expires_at FROM jsb_auth.sessions WHERE hash=$1',[hash]);
  const s=r.rows[0];return s?{hash:s.hash,accountId:s.account_id,roleAtIssue:s.role_at_issue,credentialVersion:integer(s.credential_version),issuedAt:integer(s.issued_at),expiresAt:integer(s.expires_at)}:null;
 }
 async function remove(hash){await pool.query('DELETE FROM jsb_auth.sessions WHERE hash=$1',[hash]);}
 async function removeAccount(id){await pool.query('DELETE FROM jsb_auth.sessions WHERE account_id=$1',[id]);}
 return Object.freeze({loadAccount,findAccountByEmail,store:Object.freeze({insert,find,remove,removeAccount})});
}
module.exports=Object.freeze({createAuthStore});
