'use strict';
// A reviewed, operator-only closure of a test account. Pseudonymization is
// not anonymization. Immutable legal records and rights history remain.
const {randomBytes}=require('node:crypto');
const id=/^[a-f0-9]{32}$/;
const TARGETS=[['jsb_auth.sessions','account_id'],['jsb_auth.delivery_outbox','account_id'],['jsb_auth.action_tokens','account_id'],['jsb_auth.mfa_factors','account_id'],['jsb_private.taiso_drafts','owner_id'],['jsb_private.attendance_registers','owner_id']];
async function closeTestAccount(pool,{accountId,requestId,revision,apply=false,approved=false,expectedDatabase='jsb_preprod'}={}){
 if(typeof accountId!=='string'||!id.test(accountId)||typeof requestId!=='string'||!id.test(requestId)||!Number.isSafeInteger(revision)||revision<1||typeof apply!=='boolean'||typeof approved!=='boolean'||apply&&!approved||!['jsb_preprod','jsb_ci'].includes(expectedDatabase))throw Error('Paramètres de clôture invalides');
 const c=await pool.connect();
 try{
  await c.query('BEGIN');
  if((await c.query('SELECT current_database() AS name')).rows[0].name!==expectedDatabase)throw Error('Base dédiée requise');
  await c.query("SET LOCAL lock_timeout='3s'");
  await c.query("SET LOCAL statement_timeout='15s'");
  const a=(await c.query("SELECT role,status FROM jsb_auth.accounts WHERE id=$1 FOR UPDATE",[accountId])).rows[0];
  if(!a||!['coach','individual'].includes(a.role)||!['active','suspended'].includes(a.status))throw Error('Compte non éligible');
  // Require a separately reviewed request, with the response already sent
  // securely to the person; the operation will remove the contact address.
  const r=(await c.query("SELECT kind,status,revision FROM jsb_legal.rights_requests WHERE id=$1 AND account_id=$2 FOR UPDATE",[requestId,accountId])).rows[0];
  if(!r||r.kind!=='erasure'||r.status!=='responded'||r.revision!==revision)throw Error('Demande de clôture non confirmée');
  const pending=(await c.query("SELECT count(*)::int AS n FROM jsb_legal.rights_requests WHERE account_id=$1 AND status<>'responded'",[accountId])).rows[0].n;
  if(pending)throw Error('Autres demandes en cours : clôture refusée');
  const leases=(await c.query("SELECT count(*)::int AS n FROM jsb_auth.delivery_outbox WHERE account_id=$1 AND lease_until>floor(extract(epoch FROM clock_timestamp())*1000)::bigint",[accountId])).rows[0].n;
  if(leases)throw Error('Envoi en cours : clôture refusée');
  const counts={};
  for(const [table,column] of TARGETS){
   const q=apply?'DELETE FROM '+table+' WHERE '+column+'=$1':'SELECT count(*)::int AS n FROM '+table+' WHERE '+column+'=$1';
   const result=await c.query(q,[accountId]);counts[table]=apply?result.rowCount:result.rows[0].n;
  }
  const retained={};
  for(const table of ['acceptances','rights_requests'])retained[table]=(await c.query('SELECT count(*)::int AS n FROM jsb_legal.'+table+' WHERE account_id=$1',[accountId])).rows[0].n;
  if(apply){
   const tombstone='closed-'+randomBytes(24).toString('hex')+'@invalid.invalid';
   await c.query("UPDATE jsb_auth.accounts SET email=$2,password_hash='closed-no-credential',status='deleted',email_verified=false,credential_version=credential_version+1 WHERE id=$1",[accountId,tombstone]);
  }
  await c.query('COMMIT');
  return {mode:apply?'applied':'preview',counts,retained,limitation:'Compte et preuves pseudonymisés, pas anonymisés. Copies locales, sauvegardes et journaux externes non effacés.'};
 }catch(e){try{await c.query('ROLLBACK');}catch{}throw e;}finally{c.release();}
}
module.exports=Object.freeze({closeTestAccount});
