'use strict';
const {randomBytes}=require('node:crypto');
const {authorize}=require('../../core/platform-permissions.cjs');
const fail=status=>({ok:false,status});
const idPattern=/^[a-f0-9]{32}$/;
const versionPattern=/^[A-Za-z0-9_.-]{1,80}$/;
const generationPattern=/^[1-9][0-9]{0,18}$/;
const fields='id,revision,title,catalogue_version AS version,catalogue_generation::text AS generation,created_at AS "createdAt",updated_at AS "updatedAt",validated_at AS "validatedAt"';
const clock="floor(extract(epoch FROM clock_timestamp())*1000)::bigint";
function createTaisoDraftStore(pool){
 if(typeof pool?.connect!=='function')throw TypeError('Pool requis');
 async function execute(actor,sessionHash,action,body,prepared){
  const permission=['save','validate'].includes(action)?'write':action==='delete'?'delete':'read';
  if(!authorize(actor,'privateSessions',permission,{ownerId:actor?.id})||!idPattern.test(actor.id))return fail(403);
  if(typeof sessionHash!=='string'||!/^[a-f0-9]{64}$/.test(sessionHash))return fail(401);
  if(!['list','read','save','delete','validate'].includes(action)||!body||body.expectedAccount!==actor.id)return fail(409);
  const {id,revision,offset=0}=body;
  if(action==='list'&&(!Number.isSafeInteger(offset)||offset<0||offset>10000))return fail(400);
  if(['read','delete','validate'].includes(action)&&(typeof id!=='string'||!idPattern.test(id)))return fail(400);
  if(['delete','validate'].includes(action)&&(!Number.isSafeInteger(revision)||revision<1||revision>=2147483647))return fail(400);
  if(action==='save'){
   if(id!==undefined&&(typeof id!=='string'||!idPattern.test(id)||!Number.isSafeInteger(revision)||revision<1||revision>=2147483647))return fail(400);
   if(id===undefined&&revision!==undefined)return fail(400);
   if(typeof body.title!=='string'||!body.title.trim()||body.title.trim().length>120||/[\u0000-\u001f]/.test(body.title)||!prepared||!prepared.settings||!prepared.draft)return fail(400);
   const d=prepared.draft;
   if(d.discipline!=='taiso'||!versionPattern.test(d.version)||!generationPattern.test(d.generation)||d.requiresCoachReview!==true)return fail(400);
   if(Buffer.byteLength(JSON.stringify(prepared.settings))>15000||Buffer.byteLength(JSON.stringify(d))>450000)return fail(400);
  }
  const client=await pool.connect();
  try{
   await client.query('BEGIN');
   // Same discipline lock as publication; always take it before account locks.
   if(['save','validate'].includes(action))await client.query("SELECT pg_advisory_xact_lock(hashtextextended('jsb-catalogue-publish-v1:taiso',0))");
   const a=await client.query("SELECT credential_version FROM jsb_auth.accounts WHERE id=$1 AND role=$2 AND role IN ('coach','individual') AND status='active' AND email_verified=true FOR UPDATE",[actor.id,actor.role]);
   if(a.rowCount!==1){await client.query('ROLLBACK');return fail(403);}
   const session=await client.query(`SELECT hash FROM jsb_auth.sessions WHERE hash=$1 AND account_id=$2 AND role_at_issue=$3 AND credential_version=$4 AND issued_at<=${clock} AND expires_at>${clock} FOR UPDATE`,[sessionHash,actor.id,actor.role,a.rows[0].credential_version]);
   if(session.rowCount!==1){await client.query('ROLLBACK');return fail(401);}
   let response;
   if(action==='list'){
    const rows=await client.query(`SELECT ${fields},count(*) OVER()::integer AS total FROM jsb_private.taiso_drafts WHERE owner_id=$1 ORDER BY updated_at DESC,id LIMIT 30 OFFSET $2`,[actor.id,offset]);
    const total=rows.rows[0]?.total??Number((await client.query('SELECT count(*) FROM jsb_private.taiso_drafts WHERE owner_id=$1',[actor.id])).rows[0].count);
    response={items:rows.rows.map(({total,...r})=>r),total,offset};
   }else if(action==='read'){
    const row=await client.query(`SELECT ${fields},settings,snapshot FROM jsb_private.taiso_drafts WHERE owner_id=$1 AND id=$2`,[actor.id,id]);
    if(row.rowCount!==1){await client.query('ROLLBACK');return fail(409);}
    const current=(await client.query("SELECT version,generation::text AS generation FROM jsb_catalogue.current_release WHERE discipline='taiso'")).rows[0];
    const draft=row.rows[0];response={draft:{...draft,stale:!current||current.version!==draft.version||current.generation!==draft.generation}};
   }else if(action==='validate'){
    if(body.confirmed!==true){await client.query('ROLLBACK');return fail(400);}
    const row=await client.query(`SELECT ${fields},snapshot FROM jsb_private.taiso_drafts WHERE owner_id=$1 AND id=$2 AND revision=$3 FOR UPDATE`,[actor.id,id,revision]);
    if(row.rowCount!==1){await client.query('ROLLBACK');return fail(409);}
    const draft=row.rows[0],d=draft.snapshot;
    const current=(await client.query("SELECT version,generation::text AS generation FROM jsb_catalogue.current_release WHERE discipline='taiso'")).rows[0];
    if(!current||current.version!==draft.version||current.generation!==draft.generation){await client.query('ROLLBACK');return fail(409);}
    if(!Array.isArray(d.missing)||d.missing.length||d.organizationPending!==false||!Array.isArray(d.phases)||d.phases.length!==5||d.phases.some(p=>!Array.isArray(p.exercises)||!p.exercises.length||p.unallocatedMinutes!==0)||!d.phases[2].blocks?.length||d.phases[2].blocks.some(b=>b.organization?.state!=='budgeted')){await client.query('ROLLBACK');return fail(400);}
    const updated=await client.query(`UPDATE jsb_private.taiso_drafts SET validated_at=${clock},updated_at=GREATEST(updated_at,${clock}),revision=revision+1 WHERE owner_id=$1 AND id=$2 AND revision=$3 RETURNING ${fields}`,[actor.id,id,revision]);
    response={saved:updated.rows[0]};
   }else if(action==='delete'){
    const row=await client.query('DELETE FROM jsb_private.taiso_drafts WHERE owner_id=$1 AND id=$2 AND revision=$3 RETURNING id',[actor.id,id,revision]);
    if(row.rowCount!==1){await client.query('ROLLBACK');return fail(409);}
    response={deleted:id};
   }else{
    const d=prepared.draft;
    const current=(await client.query("SELECT version,generation::text AS generation FROM jsb_catalogue.current_release WHERE discipline='taiso'")).rows[0];
    if(!current||current.version!==d.version||current.generation!==d.generation){await client.query('ROLLBACK');return fail(409);}
    const data=[body.title.trim(),d.version,d.generation,JSON.stringify(prepared.settings),JSON.stringify(d)];
    let row;
    if(id===undefined){
     const count=await client.query('SELECT count(*) FROM jsb_private.taiso_drafts WHERE owner_id=$1',[actor.id]);
     if(Number(count.rows[0].count)>=200){await client.query('ROLLBACK');return fail(409);}
     row=await client.query(`INSERT INTO jsb_private.taiso_drafts(owner_id,id,title,catalogue_version,catalogue_generation,settings,snapshot,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,${clock},${clock}) RETURNING ${fields}`,[actor.id,randomBytes(16).toString('hex'),...data]);
    }else{
     row=await client.query(`UPDATE jsb_private.taiso_drafts SET title=$3,catalogue_version=$4,catalogue_generation=$5,settings=$6,snapshot=$7,validated_at=NULL,revision=revision+1,updated_at=GREATEST(updated_at,${clock}) WHERE owner_id=$1 AND id=$2 AND revision=$8 RETURNING ${fields}`,[actor.id,id,...data,revision]);
    }
    if(row.rowCount!==1){await client.query('ROLLBACK');return fail(409);}
    response={saved:row.rows[0]};
   }
   const alive=await client.query(`SELECT 1 FROM jsb_auth.sessions WHERE hash=$1 AND expires_at>${clock}`,[sessionHash]);
   if(alive.rowCount!==1){await client.query('ROLLBACK');return fail(401);}
   await client.query('COMMIT');
   return {ok:true,status:200,...response};
  }catch(e){try{await client.query('ROLLBACK');}catch{}throw e;}finally{client.release();}
 }
 return Object.freeze({execute});
}
module.exports=Object.freeze({createTaisoDraftStore});
