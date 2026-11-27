'use strict';
const {authorize}=require('../../core/platform-permissions.cjs');
const {verifyPassword,validPassword}=require('../passwords.cjs');
const fail=status=>({ok:false,status});
const clock="floor(extract(epoch FROM clock_timestamp())*1000)::bigint";
function createPersonalExport(pool){
 async function execute(actor,sessionHash,body){
  if(!authorize(actor,'privacyRights','read',{ownerId:actor?.id}))return fail(403);
  if(!body||body.expectedAccount!==actor.id||Object.keys(body).some(k=>!['expectedAccount','password'].includes(k)))return fail(409);
  if(!validPassword(body.password))return fail(400);
  if(typeof sessionHash!=='string'||!/^[a-f0-9]{64}$/.test(sessionHash))return fail(401);
  // Expensive password check before taking SQL locks. Recheck exact hash
  // and credential version under the account lock before exporting.
  const before=(await pool.query("SELECT password_hash,credential_version FROM jsb_auth.accounts WHERE id=$1 AND role=$2 AND status='active' AND email_verified=true",[actor.id,actor.role])).rows[0];
  if(!await verifyPassword(body.password,before?.password_hash)||!before)return fail(401);
  const c=await pool.connect();
  try{
   await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
   const a=(await c.query("SELECT id,email,role,status,email_verified,created_at,credential_version,password_hash FROM jsb_auth.accounts WHERE id=$1 AND role=$2 AND status='active' AND email_verified=true FOR UPDATE",[actor.id,actor.role])).rows[0];
   if(!a||a.credential_version!==before.credential_version||a.password_hash!==before.password_hash){await c.query('ROLLBACK');return fail(401);}
   const s=await c.query(`SELECT 1 FROM jsb_auth.sessions WHERE hash=$1 AND account_id=$2 AND role_at_issue=$3 AND credential_version=$4 AND expires_at>${clock} AND issued_at<=${clock} FOR UPDATE`,[sessionHash,actor.id,actor.role,a.credential_version]);
   if(s.rowCount!==1){await c.query('ROLLBACK');return fail(401);}
   const own=async sql=>(await c.query(sql,[actor.id])).rows;
   const account={id:a.id,email:a.email,role:a.role,status:a.status,emailVerified:a.email_verified,createdAt:Number(a.created_at)};
   const data={schema:'JSB-PERSONAL-EXPORT-1',account,generatedAt:Date.now(),
    sessions:await own('SELECT role_at_issue AS role,issued_at AS "issuedAt",expires_at AS "expiresAt" FROM jsb_auth.sessions WHERE account_id=$1 ORDER BY issued_at'),
    legalRecords:await own('SELECT type,version,hash,kind,recorded_at AS "recordedAt" FROM jsb_legal.acceptances WHERE account_id=$1 ORDER BY recorded_at,type,version'),
    rightsRequests:await own('SELECT id,kind,status,created_at AS "createdAt",updated_at AS "updatedAt" FROM jsb_legal.rights_requests WHERE account_id=$1 ORDER BY created_at,id'),
    sessionDrafts:await own('SELECT id,title,revision,catalogue_version AS version,catalogue_generation::text AS generation,settings,snapshot,created_at AS "createdAt",updated_at AS "updatedAt",validated_at AS "validatedAt" FROM jsb_private.taiso_drafts WHERE owner_id=$1 ORDER BY created_at,id'),
    scope:'Données du compte et brouillons serveur. Ne comprend pas les registres de licenciés (données de tiers), les coffres locaux, les journaux d’hébergement ou les données conservées par les prestataires. Pour un accès complémentaire, déposer une demande RGPD.'
   };
   // Explicitly refuse an oversized export rather than silently truncating it.
   if(Buffer.byteLength(JSON.stringify(data),'utf8')>16000000){await c.query('ROLLBACK');return fail(409);}
   const alive=await c.query(`SELECT 1 FROM jsb_auth.sessions WHERE hash=$1 AND expires_at>${clock}`,[sessionHash]);
   if(alive.rowCount!==1){await c.query('ROLLBACK');return fail(401);}
   await c.query('COMMIT');return {ok:true,status:200,export:data};
  }catch(e){try{await c.query('ROLLBACK');}catch{}if(e.code==='40001')return fail(409);throw e;}finally{c.release();}
 }
 return Object.freeze({execute});
}
module.exports=Object.freeze({createPersonalExport});
