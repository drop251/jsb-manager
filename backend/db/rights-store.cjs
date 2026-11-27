'use strict';
const {randomBytes}=require('node:crypto');
const {authorize}=require('../../core/platform-permissions.cjs');
const fail=status=>({ok:false,status});
const id=/^[a-f0-9]{32}$/;
const kinds=new Set(['access','rectification','erasure','restriction','objection','portability','withdrawal']);
const clock="floor(extract(epoch FROM clock_timestamp())*1000)::bigint";
const cols='id,kind,status,created_at AS "createdAt",updated_at AS "updatedAt",revision';
const clean=r=>({...r,createdAt:Number(r.createdAt),updatedAt:Number(r.updatedAt)});
function createRightsStore(pool){
 async function execute(actor,sessionHash,action,body){
  const admin=['rights-queue','rights-update'].includes(action);
  if(!['rights-submit','rights-mine','rights-queue','rights-update'].includes(action))return fail(400);
  if(!authorize(actor,admin?'privacyAdministration':'privacyRights',admin?(action==='rights-queue'?'read':'write'):(action==='rights-mine'?'read':'write'),{ownerId:actor?.id}))return fail(403);
  if(!body||body.expectedAccount!==actor.id||!id.test(actor.id))return fail(409);
  if(typeof sessionHash!=='string'||!/^[a-f0-9]{64}$/.test(sessionHash))return fail(401);
  const keys=action==='rights-submit'?['expectedAccount','kind']:action==='rights-update'?['expectedAccount','id','revision','status','confirmed']:['expectedAccount'];
  if(Object.keys(body).some(k=>!keys.includes(k)))return fail(400);
  if(action==='rights-submit'&&!kinds.has(body.kind))return fail(400);
  if(action==='rights-update'&&(!id.test(body.id)||typeof body.id!=='string'||!Number.isSafeInteger(body.revision)||body.revision<1||body.revision>=2147483647||!['in_progress','responded'].includes(body.status)||body.confirmed!==true))return fail(400);
  const c=await pool.connect();
  try{
   await c.query('BEGIN');
   const a=await c.query("SELECT credential_version FROM jsb_auth.accounts WHERE id=$1 AND role=$2 AND status='active' AND email_verified=true FOR UPDATE",[actor.id,actor.role]);
   if(a.rowCount!==1){await c.query('ROLLBACK');return fail(403);}
   const s=await c.query(`SELECT hash FROM jsb_auth.sessions WHERE hash=$1 AND account_id=$2 AND role_at_issue=$3 AND credential_version=$4 AND issued_at<=${clock} AND expires_at>${clock} FOR UPDATE`,[sessionHash,actor.id,actor.role,a.rows[0].credential_version]);
   if(s.rowCount!==1){await c.query('ROLLBACK');return fail(401);}
   let response;
   if(action==='rights-submit'){
    let r=(await c.query(`SELECT ${cols} FROM jsb_legal.rights_requests WHERE account_id=$1 AND kind=$2 AND status<>'responded'`,[actor.id,body.kind])).rows[0];
    if(!r)r=(await c.query(`INSERT INTO jsb_legal.rights_requests(id,account_id,kind,created_at,updated_at) VALUES($1,$2,$3,${clock},${clock}) RETURNING ${cols}`,[randomBytes(16).toString('hex'),actor.id,body.kind])).rows[0];
    response={request:clean(r)};
   }else if(action==='rights-mine'){
    const r=await c.query(`SELECT ${cols} FROM jsb_legal.rights_requests WHERE account_id=$1 ORDER BY (status='responded'),created_at DESC,id LIMIT 100`,[actor.id]);
    response={requests:r.rows.map(clean)};
   }else if(action==='rights-queue'){
    const r=await c.query(`SELECT r.id,r.kind,r.status,r.created_at AS "createdAt",r.updated_at AS "updatedAt",r.revision,r.account_id AS "accountId",a.email FROM jsb_legal.rights_requests r JOIN jsb_auth.accounts a ON a.id=r.account_id WHERE r.status<>'responded' ORDER BY r.created_at,r.id LIMIT 100`);
    response={requests:r.rows.map(clean),limit:100};
   }else{
    const old=(await c.query('SELECT status,revision FROM jsb_legal.rights_requests WHERE id=$1 FOR UPDATE',[body.id])).rows[0];
    if(!old||old.revision!==body.revision||!(old.status==='submitted'&&body.status==='in_progress'||old.status==='in_progress'&&body.status==='responded')){await c.query('ROLLBACK');return fail(409);}
    const r=(await c.query(`UPDATE jsb_legal.rights_requests SET status=$2,updated_at=GREATEST(updated_at,${clock}),revision=revision+1,handled_by=$3 WHERE id=$1 RETURNING ${cols}`,[body.id,body.status,actor.id])).rows[0];
    response={request:clean(r)};
   }
   const alive=await c.query(`SELECT 1 FROM jsb_auth.sessions WHERE hash=$1 AND expires_at>${clock}`,[sessionHash]);
   if(alive.rowCount!==1){await c.query('ROLLBACK');return fail(401);}
   await c.query('COMMIT');return {ok:true,status:200,...response};
  }catch(e){try{await c.query('ROLLBACK');}catch{}throw e;}finally{c.release();}
 }
 return Object.freeze({execute});
}
module.exports=Object.freeze({createRightsStore});
